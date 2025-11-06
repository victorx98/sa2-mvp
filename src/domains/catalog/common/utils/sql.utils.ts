/**
 * SQL utility functions for safe query construction
 */

/**
 * Escape special characters in LIKE pattern to prevent SQL injection
 * Escapes: %, _, \
 *
 * @param pattern - The user input string to be used in LIKE query
 * @returns Escaped string safe for LIKE queries
 *
 * @example
 * escapeLikePattern('test%') => 'test\\%'
 * escapeLikePattern('test_name') => 'test\\_name'
 */
export function escapeLikePattern(pattern: string): string {
  if (!pattern) {
    return "";
  }

  return pattern
    .replace(/\\/g, "\\\\") // Escape backslash first
    .replace(/%/g, "\\%") // Escape % wildcard
    .replace(/_/g, "\\_"); // Escape _ wildcard
}

/**
 * Build a safe LIKE pattern for search
 *
 * @param input - User input string
 * @param position - Where to place wildcards: 'both' | 'start' | 'end' | 'none'
 * @returns Safe LIKE pattern
 *
 * @example
 * buildLikePattern('test', 'both') => '%test%'
 * buildLikePattern('test%', 'both') => '%test\\%%'
 */
export function buildLikePattern(
  input: string,
  position: "both" | "start" | "end" | "none" = "both",
): string {
  const escaped = escapeLikePattern(input);

  switch (position) {
    case "both":
      return `%${escaped}%`;
    case "start":
      return `%${escaped}`;
    case "end":
      return `${escaped}%`;
    case "none":
      return escaped;
    default:
      return `%${escaped}%`;
  }
}
