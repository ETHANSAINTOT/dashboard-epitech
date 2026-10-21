// same bounds as backend/schemas.py: the back stays the judge (422), this only saves a round trip
export const REFRESH_MIN_SECONDS = 10;
export const REFRESH_MAX_SECONDS = 86400;
// digits, then maybe ONE dot and 1 to 3 digits (ms). parseFloat alone would read "12,5" as 12 and "12abc" as 12
export const FORMAT = /^\d+(\.\d{1,3})?$/;

export type SecondsResult = { seconds: number } | { error: string };

export function parseSeconds(text: string): SecondsResult {
  const t = text.trim();
  if (!FORMAT.test(t))
    return { error: "Use a number with a dot, e.g. 12.5" };
  // safe here, the format is already checked
  const seconds = Number(t);
  if (seconds < REFRESH_MIN_SECONDS || seconds > REFRESH_MAX_SECONDS)
    return { error: `Between ${REFRESH_MIN_SECONDS} and ${REFRESH_MAX_SECONDS} seconds` };
  return { seconds };
}
