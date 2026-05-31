/**
 * Helpers to sanitize user input before injecting it into PostgREST filter
 * strings (e.g. `.or("col.ilike.%needle%")`). PostgREST treats `, ( ) . : * "`
 * as metacharacters — leaving them in user input enables filter injection.
 */
export function sanitizePostgrestLike(input: string): string {
  // Strip PostgREST metacharacters and edge whitespace.
  return input.replace(/[,()."*:]/g, "").trim();
}
