export function logInfo(event: string, fields: Record<string, string | number | boolean | null> = {}): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...fields }));
}
