import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { DeploymentIdentityService } from './deployment-identity.service';

@Global()
@Module({
  providers: [PrismaService, DeploymentIdentityService],
  exports: [PrismaService],
})
export class PrismaModule {}
