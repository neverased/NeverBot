/**
 * Splits a long string into parts of a maximum length, attempting to split at spaces.
 * Useful for Discord's 2000 character message limit.
 * @param text The text to split.
 * @param maxLength The maximum length of each part.
 * @returns An array of strings, each no longer than maxLength.
 */
export function splitTextIntoParts(text: string, maxLength: number): string[] {
  const parts: string[] = [];
  let currentPart = '';

  // Split the text by spaces to avoid breaking words
  const words = text.split(' ');

  for (const word of words) {
    if (currentPart.length + word.length + 1 > maxLength) {
      parts.push(currentPart);
      currentPart = word;
    } else {
      currentPart += (currentPart.length > 0 ? ' ' : '') + word;
    }
  }

  if (currentPart.length > 0) {
    parts.push(currentPart);
  }

  return parts;
}
