/** Keep a card transcription only when it contains real letters or digits. */
export function readableCardText(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.replace(/\u0000/g, "").trim();
  const letters = trimmed.replace(/[^\p{Script=Han}\p{L}\p{N}]/gu, "");
  if (letters.length < 2) return null;
  return trimmed;
}
