// Callers pass only non-secret input (statuses, hashed keys). Error text is message-only: stacks and bodies can echo secrets.
export function logError(operation: string, input: Record<string, unknown>, error: unknown): void {
  console.error(`${operation} failed`, JSON.stringify(input), error instanceof Error ? error.message : "unknown error");
}
