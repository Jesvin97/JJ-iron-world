import { z } from "zod";

export const ratingSchema = z.number().int().min(1).max(5);

/** Strip control characters (keeps \n and \t) and trim. */
function clean(max: number) {
  return z
    .string()
    .transform((s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim())
    .pipe(z.string().max(max));
}

const optionalText = (max: number) =>
  clean(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const campaignSlugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/, "Use lowercase letters, numbers and hyphens");

export const createSessionSchema = z.object({
  anonymousSessionId: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
  campaign: z.string().max(40).optional().nullable(),
});

export const sessionEventSchema = z.object({
  type: z.enum(["rating", "copy", "google_click"]),
  rating: ratingSchema.optional(),
});

export const suggestSchema = z.object({
  sessionId: z.string().min(10).max(40),
  rating: ratingSchema,
  text: z.string().max(1500),
  shorter: z.boolean().optional(),
});

export const feedbackSchema = z
  .object({
    sessionId: z.string().min(10).max(40).optional().nullable(),
    rating: ratingSchema,
    text: clean(2000),
    name: optionalText(100),
    email: optionalText(200),
    phone: optionalText(40),
    contactConsent: z.boolean().default(false),
    campaign: z.string().max(40).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.text.length < 3) ctx.addIssue({ code: "custom", path: ["text"], message: "Please write a short message" });
    if (v.email && !z.string().email().safeParse(v.email).success) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "Enter a valid email address" });
    }
    if (v.phone && !/^[0-9+()\-.\s]{6,40}$/.test(v.phone)) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a valid phone number" });
    }
    if (v.contactConsent && !v.email && !v.phone) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "Add an email or phone number so we can contact you" });
    }
  })
  // Contact details are only retained when the customer explicitly consents to be contacted.
  .transform((v) => (v.contactConsent ? v : { ...v, email: null, phone: null }));

export const loginSchema = z.object({
  email: z.string().email().max(200).transform((s) => s.toLowerCase()),
  password: z.string().min(1).max(200),
});

export const feedbackFilterSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  status: z.enum(["NEW", "REVIEWED", "RESOLVED"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  q: z.string().max(100).optional(),
  campaign: z.string().max(40).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});

export const feedbackUpdateSchema = z
  .object({
    status: z.enum(["NEW", "REVIEWED", "RESOLVED"]).optional(),
    internalNotes: z.string().max(4000).nullable().optional(),
  })
  .refine((v) => v.status !== undefined || v.internalNotes !== undefined, "Nothing to update");

const optionalUrl = z
  .string()
  .max(500)
  .transform((s) => s.trim())
  .nullable()
  .optional()
  .transform((v) => (v ? v : null));

export const settingsSchema = z.object({
  businessName: z.string().trim().min(1).max(120),
  googleReviewUrl: optionalUrl,
  aiEnabled: z.boolean(),
  aiProvider: z.enum(["anthropic", "openai", "none"]),
  aiModel: z.string().trim().min(1).max(80),
  notificationWebhookUrl: optionalUrl,
  contactEmail: z.string().trim().email().max(200).nullable().optional().or(z.literal("").transform(() => null)),
  feedbackRetentionDays: z.number().int().min(30).max(3650),
  analyticsRetentionDays: z.number().int().min(7).max(3650),
});

export const campaignCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  slug: campaignSlugSchema,
});

export const campaignUpdateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  active: z.boolean().optional(),
});

export type FeedbackFilter = z.infer<typeof feedbackFilterSchema>;
