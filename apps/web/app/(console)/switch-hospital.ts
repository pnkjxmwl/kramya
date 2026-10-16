'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getMe } from '../../lib/tenant';

export async function switchHospital(form: FormData): Promise<void> {
  const hospitalId = form.get('hospitalId');
  const me = await getMe();
  const membership = me.memberships.find((m) => m.hospitalId === hospitalId && m.status === 'ACTIVE');
  if (!membership) throw new Error('This clinic is not available to your account.');
  (await cookies()).set('opd_hospital', membership.hospitalId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
  redirect('/overview');
}
