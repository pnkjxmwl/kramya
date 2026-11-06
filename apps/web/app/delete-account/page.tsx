import { PasswordDeletionForm } from '../../components/password-deletion-form';
import { PublicAccountPage } from '../../components/public-account-page';
export default function DeleteAccountPage() {
  return <PublicAccountPage title="Delete your Kramya account">
    <p>You can request deletion in the Android app under Profile → Delete account, or use this page without installing or signing into the app.</p>
    <p>Confirm your email and current password below, or use Profile → Delete account in Android. This verifies ownership without sending an email. Eligible upcoming reservations are cancelled through the clinic queue. Active consultations and clinic staff access require review or handover; the request stays recorded until that is resolved.</p>
    <p>Completed deletion removes your login/contact details, family profile details, device registrations and notification history. Limited pseudonymous visit, queue audit and historical payment records may remain for operational, dispute or legitimate retention purposes. Clinic records held outside Kramya must be requested from the clinic.</p>
    <p>If email delivery is unavailable or you cannot access the address, email <a className="underline" href="mailto:pankajsemwal.careers@gmail.com?subject=Kramya%20account%20deletion">pankajsemwal.careers@gmail.com</a> with your account email and a deletion request. We will verify ownership; do not send passwords, OTPs or medical documents.</p>
    <PasswordDeletionForm />
  </PublicAccountPage>;
}
