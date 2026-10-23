import { requirePageAdmin } from "@/lib/admin-page";
import { getSettings } from "@/lib/settings";
import { qrSvg, reviewUrl } from "@/lib/qr";
import { PrintButton } from "@/components/admin/PrintButton";

export const metadata = { title: "Print QR card – Admin" };

export default async function PrintCard({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  await requirePageAdmin();
  const { c } = await searchParams;
  const slug = c && /^[a-z0-9][a-z0-9-]{0,39}$/.test(c) ? c : null;
  const [settings, svg] = await Promise.all([getSettings(), qrSvg(reviewUrl(slug))]);
  return (
    <div className="min-h-screen bg-white">
      <div className="no-print mx-auto flex max-w-md items-center justify-between p-4">
        <a href="/admin/qr" className="text-sm font-semibold underline">← Back</a>
        <PrintButton />
      </div>
      {/* A6-proportioned card; prints cleanly on A4/A5/Letter */}
      <div className="mx-auto my-4 flex w-[105mm] max-w-[calc(100%-2rem)] flex-col items-center rounded-3xl border-2 border-gold px-8 py-10 text-center print:my-0 print:border-gold">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gold-dark">Premium Unisex Salon &amp; Spa</p>
        <h1 className="mt-2 font-serif text-3xl leading-tight">{settings.businessName}</h1>
        <div className="my-4 h-px w-16 bg-gold" />
        <p className="font-serif text-xl">How was your visit?</p>
        <p className="mt-1 text-sm text-cocoa-soft">Scan to share your experience</p>
        <div className="mt-5 w-48 [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="mt-4 text-xs text-cocoa-soft">Point your phone camera at the code. It takes about a minute.</p>
      </div>
    </div>
  );
}
