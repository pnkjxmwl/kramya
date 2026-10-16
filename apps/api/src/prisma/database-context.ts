import { AsyncLocalStorage } from "node:async_hooks";
import type { Prisma } from "@prisma/client";

/** Set only by verified server paths. Never copy request headers/body into this. */
export interface DatabaseIdentity {
  accountId?: string;
  hospitalId?: string;
  role?: string;
  purpose?: string;
  email?: string;
  refreshHash?: string;
  inviteHash?: string;
  invitationId?: string;
  deviceToken?: string;
  sessionId?: string;
}
interface DatabaseScope {
  identity: DatabaseIdentity;
  transaction?: Prisma.TransactionClient;
}
export const databaseScope = new AsyncLocalStorage<DatabaseScope>();
export function withDatabaseIdentity<T>(
  identity: DatabaseIdentity,
  work: () => T,
): T {
  const parent = databaseScope.getStore();
  if (parent?.transaction && Object.entries(identity).some(([key, value]) => parent.identity[key as keyof DatabaseIdentity] !== value)) {
    throw new Error('Cannot change database identity inside an existing transaction');
  }
  return databaseScope.run(
    { ...parent, identity: { ...parent?.identity, ...identity } },
    work,
  );
}
export function setDatabaseIdentity(identity: DatabaseIdentity): void {
  const scope = databaseScope.getStore();
  if (!scope)
    throw new Error("Database identity requires an isolated server scope");
  if (scope.transaction)
    throw new Error("Cannot change identity inside an existing transaction");
  scope.identity = { ...scope.identity, ...identity };
}

/** Method boundaries for auth/token operations, including callers outside HTTP. */
export function DatabaseIdentityFor<A extends unknown[]>(
  resolve: (...args: A) => DatabaseIdentity,
): MethodDecorator {
  return (_target, _name, descriptor: PropertyDescriptor) => {
    const method = descriptor.value as (...args: A) => unknown;
    descriptor.value = function (this: unknown, ...args: A) {
      return withDatabaseIdentity(resolve(...args), () =>
        method.apply(this, args),
      );
    };
  };
}

export async function bindDatabaseIdentity(
  tx: Prisma.TransactionClient,
  identity: DatabaseIdentity,
): Promise<void> {
  await tx.$executeRaw`SELECT
    set_config('kramya.account_id', ${identity.accountId ?? ""}, true),
    set_config('kramya.hospital_id', ${identity.hospitalId ?? ""}, true),
    set_config('kramya.role', ${identity.role ?? ""}, true),
    set_config('kramya.purpose', ${identity.purpose ?? ""}, true),
    set_config('kramya.email', ${identity.email ?? ""}, true),
    set_config('kramya.refresh_hash', ${identity.refreshHash ?? ""}, true),
    set_config('kramya.invite_hash', ${identity.inviteHash ?? ""}, true),
    set_config('kramya.invitation_id', ${identity.invitationId ?? ""}, true),
    set_config('kramya.device_token', ${identity.deviceToken ?? ""}, true),
    set_config('kramya.session_id', ${identity.sessionId ?? ""}, true)`;
}
