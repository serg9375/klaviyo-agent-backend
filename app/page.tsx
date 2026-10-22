import { ASSISTANTS, ONBOARDING_SENTENCE } from "@/lib/onboarding";
import { CopyButton } from "./CopyButton";

const STEPS = [
  "Paste the sentence into your assistant.",
  "It gives you a link. Open it and press Allow on Klaviyo's own page.",
  "Tell the assistant: done.",
  "It explains your real bill in plain words. Ask “Why did it go up?” any time.",
];

const DETAILS = [
  {
    question: "What can it see?",
    answer: "Only the usage numbers on your bill: how much of your plan you have used. It cannot see your customers, emails or messages.",
  },
  {
    question: "Is it safe?",
    answer: "It can only read. You sign in on Klaviyo's own page, so your password never goes to the assistant. To stop, tell the assistant: disconnect.",
  },
  {
    question: "Something went wrong",
    answer: "Ask your assistant: “Write a short summary of this problem for Klaviyo support.” Send that summary to Klaviyo.",
  },
];

export default function Home() {
  return (
    <main>
      <h1>Understand your Klaviyo bill</h1>
      <p className="lead">Your assistant does the work. You only paste one sentence.</p>

      <CopyButton text={ONBOARDING_SENTENCE} />
      <p className="hint">Paste it into any assistant below.</p>

      <h2>How it works</h2>
      <ol>
        {STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <h2>Works with</h2>
      <ul className="grid">
        {ASSISTANTS.map((assistant) => (
          <li key={assistant.name}>
            <strong>{assistant.name}</strong>
            <span>{assistant.hint}</span>
          </li>
        ))}
      </ul>

      <h2>Good to know</h2>
      {DETAILS.map((detail) => (
        <details key={detail.question}>
          <summary>{detail.question}</summary>
          <p>{detail.answer}</p>
        </details>
      ))}

      <footer>Not affiliated with Klaviyo.</footer>
      <p className="agents">Assistants reading this page: open /llms.txt and follow it.</p>
    </main>
  );
}
