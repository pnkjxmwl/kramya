import type { ClinicProfile } from '@opd/contracts';
import { requireAdminHospital } from '../../../../lib/tenant';
import { apiGet } from '../../../../lib/api';
import { Card, ErrorBanner, SuccessBanner, btn, input, label } from '../../../../components/ui';
import { saveClinicProfile } from './actions';
import { FormSubmit } from '../../../../components/form-submit';

export default async function ClinicProfilePage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const hospital = await requireAdminHospital();
  const profile = await apiGet<ClinicProfile>(`/hospitals/${hospital.id}/profile`);
  const feedback = await searchParams;
  return <>
    <ErrorBanner message={feedback.error} />
    <SuccessBanner message={feedback.saved === '1' ? 'Clinic details saved.' : undefined} />
    <Card title="Clinic details">
      <p className="mb-5 text-body text-ink-muted">Listing status: {profile.status.toLowerCase()}. Kramya reviews listing approval separately; saving this form does not publish a pending or suspended clinic. Verified clinics’ saved contact details are visible to patients.</p>
      <form action={saveClinicProfile} className="grid gap-5 sm:grid-cols-2">
        <label className={label}>Clinic name<input className={input} name="name" defaultValue={profile.name} required minLength={2} maxLength={160} autoComplete="organization" /></label>
        <label className={label}>City<input className={input} name="city" defaultValue={profile.city} required maxLength={80} autoComplete="address-level2" /></label>
        <label className={label}>Area<input className={input} name="area" defaultValue={profile.area ?? ''} maxLength={120} /></label>
        <label className={label}>Reception phone<input className={input} type="tel" name="receptionPhone" defaultValue={profile.receptionPhone ?? ''} maxLength={24} autoComplete="tel" /></label>
        <label className={label}>Reception email<input className={input} type="email" name="receptionEmail" defaultValue={profile.receptionEmail ?? ''} maxLength={254} autoComplete="email" /></label>
        <label className={`${label} sm:col-span-2`}>Reception address<textarea className={input} name="address" defaultValue={profile.address ?? ''} required minLength={5} maxLength={600} rows={3} autoComplete="street-address" /></label>
        <p className="text-body text-ink-muted sm:col-span-2">Use the clinic’s public reception contact, with permission to publish it. Include no patient information. Set arrival instructions and grace/recall rules under Queue policy.</p>
        <FormSubmit className={btn('primary')}>Save clinic details</FormSubmit>
      </form>
    </Card>
  </>;
}
