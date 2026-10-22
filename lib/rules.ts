// Documented billing rules, in merchant words. Sources are Klaviyo help pages.

export interface Rule {
  text: string;
  source: string;
}

const BILLING = "https://help.klaviyo.com/hc/en-us/articles/115000976672-How-Klaviyo-Bills-Customers";
const USAGE = "https://help.klaviyo.com/hc/en-us/articles/17543571835675-Understanding-your-account-usage";

export const RULES: Record<string, Rule> = {
  emailable_counts: {
    text: "Any contact you can email counts toward your bill, whether or not they agreed to marketing.",
    source: BILLING,
  },
  stopped_contacts: {
    text: "Contacts you have stopped emailing (suppressed) and deleted contacts do not count once Klaviyo has processed it.",
    source: USAGE,
  },
  text_unsubscribe: {
    text: "A contact who only opted out of text messages still counts if you can email them.",
    source: BILLING,
  },
  count_delay: {
    text: "After a large cleanup it can take up to 72 hours for your count to catch up. The number is also refreshed only about twice a day.",
    source: USAGE,
  },
};

export function explainRule(topic: string): Rule | null {
  return RULES[topic] ?? null;
}
