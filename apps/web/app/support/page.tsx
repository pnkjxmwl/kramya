import { PublicAccountPage } from '../../components/public-account-page';
export default function SupportPage() {
  return <PublicAccountPage title="Kramya support">
    <p>Contact Pankaj Semwal, operating Kramya: <a className="underline" href="mailto:pankajsemwal.careers@gmail.com">pankajsemwal.careers@gmail.com</a>.</p>
    <p>For an app issue, include your app version, clinic, approximate time and reservation reference. Share only what is needed. Never send passwords, payment credentials, OTPs or medical documents.</p>
    <p>The clinic handles clinical care and urgent arrival changes. For online booking payment or refund issues, contact Kramya support with the booking reference and approximate time; do not send payment credentials. Clinic-collected payments remain the clinic’s responsibility. An ETA is an estimate, not a guaranteed appointment or advice to delay urgent care.</p>
    <p>Kramya is not an emergency service. Contact the clinic or seek urgent local medical care when needed.</p>
  </PublicAccountPage>;
}
