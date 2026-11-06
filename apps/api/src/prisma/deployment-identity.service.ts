import { Injectable, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { env } from '../config/env';

@Injectable()
export class DeploymentIdentityService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}
  async onModuleInit(): Promise<void> {
    if (env().DEPLOYMENT_ENVIRONMENT === 'PRODUCTION' && env().REMOTE_BOOKING_ACCESS === 'OPEN_TEST') {
      throw new Error('Production refuses OPEN_TEST booking access. Use APPROVED_ONLY for the controlled pilot or VERIFIED_EMAIL after verified sign-in/delivery is operational.');
    }
    const identity = await this.prisma.deploymentIdentity.findUnique({ where: { id: 'singleton' } });
    if (identity?.environment !== env().DEPLOYMENT_ENVIRONMENT) {
      throw new Error('API/database deployment environments do not match. Refusing to start. Use a separate initialized production database; never relabel staging data.');
    }
  }
}
