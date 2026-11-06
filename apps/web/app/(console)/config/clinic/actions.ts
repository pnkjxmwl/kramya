'use server';
import { apiSend } from '../../../../lib/api';
import { runAction, text } from '../_run';
export async function saveClinicProfile(form: FormData): Promise<void> {
  await runAction('/config/clinic', async hospitalId => {
    await apiSend('PUT', `/hospitals/${hospitalId}/profile`, {
    name: text(form, 'name'), city: text(form, 'city'), area: text(form, 'area') || null, address: text(form, 'address'),
    receptionPhone: text(form, 'receptionPhone') || null, receptionEmail: text(form, 'receptionEmail') || null,
    });
    return 'saved=1';
  });
}
