import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { BookingAccessReview } from '@opd/contracts';
import { requireStaffHospital } from '../../../../../../lib/tenant';
import { Card, ErrorBanner, SuccessBanner, btn, input, label } from '../../../../../../components/ui';
import { queueGet } from '../../../_run';
import { reviewBookingAccess } from './actions';
import { FormSubmit } from '../../../../../../components/form-submit';

export default async function BookingAccessPage({ params, searchParams }: {
  params: Promise<{ sessionId: string; entryId: string }>; searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const hospital = await requireStaffHospital();
  if (hospital.role === 'DOCTOR') notFound();
  const { sessionId, entryId } = await params;
  const result = await queueGet<BookingAccessReview>(`/sessions/${sessionId}/booking-access/${entryId}`);
  const feedback = await searchParams;
  return <div className="mx-auto flex max-w-2xl flex-col gap-6">
    <Link href={`/queue/${sessionId}`} className="underline">Back to session</Link>
    <h1 className="text-page-title">Booking access · {result.patientName}</h1>
    <ErrorBanner message={feedback.error} />
    <SuccessBanner message={feedback.saved === '1' ? 'Booking access decision saved.' : undefined} />
    <Card title="Review the circumstances first">
      <p>In the last 30 days at this clinic: {result.manuallyMarkedNoShowsIn30Days} staff-marked no-show visit(s), and {result.sessionEndNoShowsIn30Days} visit(s) marked absent at session closure.</p>
      <p className="mt-3">These counts do not prove misuse. Check clinic disruption, arrival records and the patient’s explanation. Closing early does not count as patient misuse. Explain any pause and how reception can review it.</p>
      <p className="mt-3">A pause applies only to new online reservations for this patient profile at this clinic. Existing tokens, other family profiles, other clinics and walk-in care remain available.</p>
    </Card>
    <Card title="Temporary remote-booking access">
      <p className="mb-4">{result.pausedUntil && Date.parse(result.pausedUntil) > Date.now() ? `Currently paused until ${new Date(result.pausedUntil).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST.` : 'No active pause.'}</p>
      {result.reviewAllowed ? <form action={reviewBookingAccess} className="flex flex-col gap-4">
        <input type="hidden" name="sessionId" value={sessionId} /><input type="hidden" name="entryId" value={entryId} />
        <label className={label}>Action<select name="hours" className={input} defaultValue="0">
          <option value="0">Allow online bookings / lift pause</option><option value="1">Pause for 1 hour</option>
          <option value="24">Pause for 24 hours</option><option value="72">Pause for 3 days</option><option value="168">Pause for 7 days</option>
        </select></label>
        <label className={label}>Reason and review outcome<textarea name="reason" className={input} required minLength={10} maxLength={500} rows={4} /></label>
        <p>Write a brief operational reason that can be explained to the patient. Include no medical details, identity documents or allegations. Every change is recorded with your account and time.</p>
        <FormSubmit className={btn('primary')}>Save reviewed decision</FormSubmit>
      </form> : <p>This profile was deleted. Historical information is available, but a new booking restriction cannot be created.</p>}
    </Card>
  </div>;
}
