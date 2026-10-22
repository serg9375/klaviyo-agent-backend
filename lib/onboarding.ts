// The one sentence a merchant pastes into their assistant. It is the same on the
// website, in the GitHub readme and in messages between friends.
export const BASE_URL = "https://klaviyo-agent-backend.vercel.app";

export const ONBOARDING_SENTENCE = `Help me understand my Klaviyo bill. Read ${BASE_URL}/llms.txt and follow it.`;

export const ASSISTANTS = [
  { name: "Claude on the web", hint: "Open claude.ai in your browser" },
  { name: "Claude desktop", hint: "The Claude program on your computer" },
  { name: "Claude on iPhone", hint: "The Claude app on your phone" },
  { name: "Claude Code", hint: "Paste it into the Claude Code window" },
  { name: "ChatGPT desktop", hint: "The ChatGPT program on your computer" },
  { name: "ChatGPT on iPhone", hint: "The ChatGPT app on your phone" },
  { name: "Codex", hint: "Paste it into the Codex window" },
  { name: "Grok", hint: "Open grok.com or the Grok app" },
  { name: "Muse (Meta)", hint: "Meta's assistant in your Meta apps" },
  { name: "Dots", hint: "The Dots assistant from OpenAI" },
] as const;
