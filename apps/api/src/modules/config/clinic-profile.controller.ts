import { Body, Controller, Get, Put } from '@nestjs/common';
import { UpdateClinicProfileRequest, type ClinicProfile } from '@opd/contracts';
import { CurrentAccount, CurrentHospital, Roles } from '../../common/decorators';
import type { AuthedAccount, TenantContext } from '../../common/auth-context';
import { ZodBody } from '../../common/pipes/zod-validation.pipe';
import { ClinicProfileService } from './clinic-profile.service';

@Roles('ADMIN')
@Controller('hospitals/:hospitalId/profile')
export class ClinicProfileController {
  constructor(private readonly clinic: ClinicProfileService) {}
  @Get()
  get(@CurrentHospital() tenant: TenantContext): Promise<ClinicProfile> { return this.clinic.get(tenant.hospitalId); }
  @Put()
  update(@CurrentHospital() tenant: TenantContext, @CurrentAccount() account: AuthedAccount,
    @Body(new ZodBody(UpdateClinicProfileRequest)) input: UpdateClinicProfileRequest): Promise<ClinicProfile> {
    return this.clinic.update(tenant.hospitalId, account.id, input);
  }
}
