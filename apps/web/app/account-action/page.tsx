import { AccountActionForm } from '../../components/account-action-form';
import { PublicAccountPage } from '../../components/public-account-page';
export default function AccountActionPage() {
  return <PublicAccountPage title="Manage your Kramya account"><p>Confirm a verification, password-reset or deletion link you requested. Automatic account emails are currently disabled. For recovery help, contact <a className="underline" href="mailto:pankajsemwal.careers@gmail.com">Kramya support</a>; never send your password or OTP.</p><AccountActionForm /></PublicAccountPage>;
}
