/**
 * Starting points for public replies to Google reviews. Staff must read and personalise them before posting:
 * replies are public, must not reveal the customer's private details, and must never offer an incentive
 * in exchange for changing or removing a review (Google prohibits that).
 */
export type ReplyTemplate = { id: string; label: string; body: (salon: string, name: string | null) => string };

const hi = (name: string | null) => (name ? `Hi ${name.split(/\s+/)[0]},` : "Hello,");

export const REPLY_TEMPLATES: ReplyTemplate[] = [
  {
    id: "thanks",
    label: "Thank you (4–5★)",
    body: (salon, name) => `${hi(name)}\n\nThank you for taking the time to review ${salon}. We're delighted you enjoyed your visit and look forward to welcoming you back.\n\nThe ${salon} team`,
  },
  {
    id: "sorry",
    label: "Apology + invite to talk (1–3★)",
    body: (salon, name) => `${hi(name)}\n\nThank you for your honest feedback, and we're sorry your visit with us fell short. We'd like to understand what happened and put it right. Please contact us directly so we can look into it properly.\n\nThe ${salon} team`,
  },
  {
    id: "no-record",
    label: "Can't match this to a visit",
    body: (salon, name) => `${hi(name)}\n\nThank you for your review. We take every review seriously, but we can't find a visit or booking that matches this description. Could you contact us with the date and service so we can look into it?\n\nThe ${salon} team`,
  },
];

/** Suggested next step for each status, shown to staff. */
export const NEXT_STEP: Record<string, string> = {
  NEW: "Read it, assign an owner, then either draft a reply or mark it as suspected fake.",
  REPLY_DRAFTED: "Have a second person check the reply, post it on Google, then mark it Replied.",
  REPLIED: "Nothing more to do unless the reviewer responds.",
  SUSPECTED_FAKE: "Write down why (not a customer, wrong business, spam, competitor, harassment), then report it on Google.",
  REPORTED: "Google decides. Check the Business Profile after a few days; mark Removed or Kept.",
  REMOVED: "Done.",
  KEPT: "Google kept it, so reply publicly and calmly instead.",
};
