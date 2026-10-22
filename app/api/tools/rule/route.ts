import { explainRule } from "@/lib/rules";

export async function POST(request: Request) {
  const { topic } = (await request.json().catch(() => ({}))) as { topic?: string };
  const rule = topic ? explainRule(topic) : null;
  return rule ? Response.json(rule) : Response.json({ error: "unknown_topic" }, { status: 404 });
}
