import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Bundled, licensed fonts: no Google request during builds or patient/staff sessions.
const manrope = localFont({
  src: "../public/fonts/manrope.ttf",
  variable: "--font-manrope",
  weight: "200 800",
  display: "swap",
});
const bricolage = localFont({
  src: "../public/fonts/bricolage_grotesque.ttf",
  variable: "--font-bricolage",
  weight: "200 800",
  display: "swap",
});
export const metadata: Metadata = {
  title: {
    default: "Kramya — Clinic queues, with a clearer wait",
    template: "%s · Kramya",
  },
  description:
    "Booking and live queue visibility for clinics, reception teams and patients. Plan visits with changing time estimates and manage the clinic day in one workspace.",
  // Protected routes must never be indexed; the public homepage opts in separately.
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  themeColor: "#FAF7F2",
  colorScheme: "light",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${manrope.variable} ${bricolage.variable}`}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
