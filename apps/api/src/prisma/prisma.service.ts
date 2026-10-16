import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { bindDatabaseIdentity, databaseScope } from "./database-context";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super();
    const transaction = this.$transaction.bind(this);
    const models = new Set(
      Prisma.dmmf.datamodel.models.map(
        (m) => m.name[0]!.toLowerCase() + m.name.slice(1),
      ),
    );
    const delegates = new Map<string, object>();
    // A single scoped query owns a short transaction; existing domain transactions
    // keep their connection, locks and commit boundary. No persistent SET on pools.
    return new Proxy(this, {
      get(target, key, receiver) {
        if (key === "$transaction")
          return (work: unknown, options?: object) => {
            const scope = databaseScope.getStore();
            if (!scope) return transaction(work as never, options);
            if (typeof work !== "function")
              throw new Error("Scoped transactions require a callback");
            if (scope.transaction)
              throw new Error("Nested database transactions are not supported");
            return transaction(async (tx) => {
              await bindDatabaseIdentity(tx, scope.identity);
              return databaseScope.run(
                { identity: scope.identity, transaction: tx },
                () => work(tx),
              );
            }, options);
          };
        if (
          typeof key === "string" &&
          [
            "$queryRaw",
            "$queryRawUnsafe",
            "$executeRaw",
            "$executeRawUnsafe",
          ].includes(key)
        ) {
          return (...args: unknown[]) => {
            const scope = databaseScope.getStore();
            const invoke = (client: object) =>
              Reflect.apply(
                Reflect.get(client, key) as (...values: unknown[]) => unknown,
                client,
                args,
              );
            if (!scope) return invoke(target);
            if (scope.transaction) return invoke(scope.transaction);
            return transaction(async (tx) => {
              await bindDatabaseIdentity(tx, scope.identity);
              return invoke(tx);
            });
          };
        }
        if (typeof key === "string" && models.has(key)) {
          if (!delegates.has(key))
            delegates.set(
              key,
              new Proxy(
                {},
                {
                  get(_delegate, operation: string) {
                    return (...args: unknown[]) => {
                      const scope = databaseScope.getStore();
                      const invoke = (client: object) => {
                        const model = Reflect.get(client, key) as object;
                        return Reflect.apply(
                          Reflect.get(model, operation) as (
                            ...values: unknown[]
                          ) => unknown,
                          model,
                          args,
                        );
                      };
                      if (!scope) return invoke(target);
                      if (scope.transaction) return invoke(scope.transaction);
                      return transaction(async (tx) => {
                        await bindDatabaseIdentity(tx, scope.identity);
                        return databaseScope.run(
                          { identity: scope.identity, transaction: tx },
                          () => invoke(tx),
                        );
                      });
                    };
                  },
                },
              ),
            );
          return delegates.get(key);
        }
        return Reflect.get(target, key, receiver);
      },
    });
  }
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Cheap liveness probe for /health/ready. */
  async isReachable(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
