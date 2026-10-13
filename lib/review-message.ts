// The messages a business sends a customer in a chat to ask for a Google review, ready to copy
// from the client's Overview. Fixed wording in the business's own voice, with its name and its
// review link dropped in. Every one says why the review is being asked for: people are more willing
// to do something when they are given a reason. The link sits on a line of its own, which is what
// makes a chat app show the link's preview under the message.
export const REVIEW_MESSAGES = [
  {
    key: "short",
    label: "Short and friendly",
    text: (name: string, link: string) =>
      `Hi! Thank you for choosing ${name}. If you have a minute, we would love a quick review on Google. It helps more people find us.\n${link}`,
  },
  {
    key: "warm",
    label: "Warm thank you",
    text: (name: string, link: string) =>
      `Hi! Thank you so much for trusting ${name}. 😊\n` +
      `Could you rate us on Google? Your words help other customers decide, and they mean a lot to our team. It only takes a minute.\n${link}\n` +
      `Thank you! ⭐`,
  },
  {
    key: "formal",
    label: "Polite and formal",
    text: (name: string, link: string) =>
      `Dear Customer,\n\n` +
      `Thank you for choosing ${name}. We would be grateful if you could share your experience in a Google review. Your feedback helps us improve our service and helps others make an informed choice. It takes about a minute.\n${link}\n\n` +
      `Thank you,\n${name}`,
  },
] as const;

export type ReviewMessageKey = (typeof REVIEW_MESSAGES)[number]["key"];
