import { Injectable } from '@nestjs/common';
import type { ClinicProfile, UpdateClinicProfileRequest } from '@opd/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError } from '../../common/errors';

const select = { id: true, name: true, city: true, area: true, address: true, receptionPhone: true, receptionEmail: true, status: true, updatedAt: true } as const;
@Injectable()
export class ClinicProfileService {
  constructor(private readonly db: PrismaService) {}
  async get(hospitalId: string): Promise<ClinicProfile> {
    const row = await this.db.hospital.findUnique({ where: { id: hospitalId }, select });
    if (!row) throw new NotFoundError('Clinic not found');
    return { ...row, updatedAt: row.updatedAt.toISOString() };
  }
  async update(hospitalId: string, actor: string, input: UpdateClinicProfileRequest): Promise<ClinicProfile> {
    const row = await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Hospital" WHERE id=${hospitalId} FOR UPDATE`;
      const row = await tx.hospital.update({ where: { id: hospitalId }, data: input, select });
      await tx.auditLog.create({ data: { hospitalId, actorType: 'STAFF', actorId: actor, action: 'hospital.PROFILE_UPDATED', entityType: 'Hospital', entityId: hospitalId,
        metadata: { fields: Object.keys(input) } } });
      return row;
    });
    return { ...row, updatedAt: row.updatedAt.toISOString() };
  }
}
