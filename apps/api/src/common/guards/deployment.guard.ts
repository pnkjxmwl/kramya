import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { env } from '../../config/env';
import { ConflictError } from '../errors';

/** Prevent accidental client/environment mixing. This is additional to JWT/RLS. */
@Injectable()
export class DeploymentGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ path: string; headers: Record<string, string | undefined> }>();
    // Probes and signed legacy payment callbacks cannot supply an app build header.
    if (['/health', '/health/ready', '/webhooks/razorpay', '/webhooks/checkout-complete'].includes(req.path)) return true;
    const expected = env().DEPLOYMENT_ENVIRONMENT;
    const supplied = req.headers['x-kramya-environment'];
    if ((supplied !== undefined && supplied !== expected) || (expected === 'PRODUCTION' && supplied !== 'PRODUCTION')) {
      throw new ConflictError('This app is connected to the wrong Kramya environment. Install the correct release or contact support.');
    }
    return true;
  }
}
