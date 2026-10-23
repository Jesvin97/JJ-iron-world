import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Privacy notice" };

export default async function Privacy() {
  const s = await getSettings();
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 leading-relaxed">
      <h1 className="font-serif text-4xl">Privacy notice</h1>
      <p className="mt-2 text-cocoa-soft">{s.businessName}</p>

      <h2 className="mt-8 font-serif text-2xl">What we collect</h2>
      <ul className="mt-2 list-disc space-y-2 pl-6">
        <li>
          <strong>Anonymous visit statistics.</strong> When you open the review page we record that a visit happened, the QR code
          location (if any), and whether you used the rating, suggestion, copy and Google-link buttons. A random identifier held only
          in your browser tab&rsquo;s temporary storage is used to avoid double counting. We do not store your IP address or any
          device fingerprint.
        </li>
        <li>
          <strong>Private feedback (only if you send it).</strong> Your rating and message. Name is optional. Email or phone is kept
          only if you tick the box allowing us to contact you.
        </li>
      </ul>

      <h2 className="mt-8 font-serif text-2xl">AI-assisted wording</h2>
      <p className="mt-2">
        If you ask for a suggestion, the text you typed (with any email addresses, phone numbers and links removed) and your star
        rating are sent to an AI service to help rephrase your own words. Your name and contact details are never sent. Nothing is
        posted for you &ndash; you decide what to copy and publish.
      </p>

      <h2 className="mt-8 font-serif text-2xl">Google reviews</h2>
      <p className="mt-2">
        Reviews are written and posted by you on Google while signed in to your Google account, under Google&rsquo;s own terms and
        privacy policy. We never see your Google credentials and cannot post on your behalf.
      </p>

      <h2 className="mt-8 font-serif text-2xl">How we use and keep it</h2>
      <p className="mt-2">
        Feedback is used to improve our service and, only if you consented, to reply to you. Anonymous statistics are deleted after{" "}
        {s.analyticsRetentionDays} days. Resolved feedback is deleted after {s.feedbackRetentionDays} days. You can ask us to delete
        your feedback sooner.
      </p>

      <h2 className="mt-8 font-serif text-2xl">Your rights and contact</h2>
      <p className="mt-2">
        {s.contactEmail ? (
          <>
            To access, correct or delete your information, contact <a className="underline" href={`mailto:${s.contactEmail}`}>{s.contactEmail}</a>.
          </>
        ) : (
          <>To access, correct or delete your information, please ask the salon team.</>
        )}
      </p>
      <p className="mt-8"><a className="underline" href="/review">&larr; Back to the review page</a></p>
    </main>
  );
}
