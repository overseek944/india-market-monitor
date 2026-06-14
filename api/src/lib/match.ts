/**
 * Word-boundary match of a stock against free text (an email subject/body, a custom-feed
 * item). Matches the NSE symbol as a standalone token, a `$SYMBOL` cashtag, or the company
 * name with Indian corporate suffixes stripped.
 */
export function matchesInstrument(text: string, symbol: string, name: string | null): boolean {
  if (!text) return false;
  const safe = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Standalone uppercase token, not glued to other letters/digits (avoids INFY in "INFYTECH").
  if (new RegExp(`(?<![A-Z0-9])${safe}(?![A-Z0-9])`).test(text)) return true;
  // $RELIANCE cashtag, case-insensitive.
  if (new RegExp(`\\$${safe}\\b`, "i").test(text)) return true;
  if (name) {
    const cn = name
      .replace(/\b(Limited|Ltd\.?|Private|Pvt\.?|Industries|Corporation|Corp\.?|Company|Co\.?|The)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    if (cn.length >= 4 && new RegExp(cn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text)) {
      return true;
    }
  }
  return false;
}
