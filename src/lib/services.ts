/** Services a customer can pick. Picked services are facts supplied by the customer, so the AI may mention them. */
export const SERVICES = ["Haircut", "Hair colour", "Hair spa / treatment", "Facial", "Massage / spa", "Manicure / pedicure", "Beard & grooming", "Bridal / makeup", "Waxing / threading"] as const;
export type Service = (typeof SERVICES)[number];
