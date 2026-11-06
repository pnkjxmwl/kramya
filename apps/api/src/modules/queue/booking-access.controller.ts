import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { BookingAccessReview, ReviewBookingAccessRequest } from '@opd/contracts';
import { CurrentAccount, CurrentHospital, Roles } from '../../common/decorators';
import type { AuthedAccount, TenantContext } from '../../common/auth-context';
import { ZodBody } from '../../common/pipes/zod-validation.pipe';
import { BookingAccessService } from './booking-access.service';

@Roles('ADMIN', 'RECEPTION')
@Controller('sessions/:sessionId/booking-access/:entryId')
export class BookingAccessController {
  constructor(private readonly access: BookingAccessService) {}
  @Get()
  read(@Param('sessionId') sessionId: string, @Param('entryId') entryId: string,
    @CurrentHospital() tenant: TenantContext): Promise<BookingAccessReview> {
    return this.access.read(sessionId, entryId, tenant.hospitalId);
  }
  @Post()
  review(@Param('sessionId') sessionId: string, @Param('entryId') entryId: string,
    @CurrentHospital() tenant: TenantContext, @CurrentAccount() account: AuthedAccount,
    @Body(new ZodBody(ReviewBookingAccessRequest)) body: ReviewBookingAccessRequest): Promise<BookingAccessReview> {
    return this.access.review(sessionId, entryId, tenant.hospitalId, account.id, body);
  }
}
