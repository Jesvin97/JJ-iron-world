import { getSettings, toPublicSettings } from "@/lib/settings";
import { ReviewFlow } from "@/components/review/ReviewFlow";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const settings = toPublicSettings(await getSettings());
  const campaign = typeof c === "string" && /^[a-z0-9][a-z0-9-]{0,39}$/.test(c) ? c : null;
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col px-4 pb-16 pt-8 sm:pt-14">
      <ReviewFlow settings={settings} campaign={campaign} />
    </main>
  );
}
