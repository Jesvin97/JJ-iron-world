import { requirePageAdmin } from "@/lib/admin-page";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const metadata = { title: "Settings – Admin" };

export default async function SettingsPage() {
  const admin = await requirePageAdmin();
  const s = await getSettings();
  const keys = {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
  };
  return (
    <div className="space-y-5">
      <h1 className="font-serif text-3xl">Settings</h1>
      <SettingsForm
        canEdit={admin.role === "ADMIN"}
        keys={keys}
        initial={{
          businessName: s.businessName,
          googleReviewUrl: s.googleReviewUrl ?? "",
          aiEnabled: s.aiEnabled,
          aiProvider: s.aiProvider as "anthropic" | "openai" | "none",
          aiModel: s.aiModel,
          notificationWebhookUrl: s.notificationWebhookUrl ?? "",
          contactEmail: s.contactEmail ?? "",
          feedbackRetentionDays: s.feedbackRetentionDays,
          analyticsRetentionDays: s.analyticsRetentionDays,
        }}
      />
    </div>
  );
}
