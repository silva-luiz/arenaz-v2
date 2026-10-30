/** Control characters; browsers strip tabs/newlines inside URLs. */
const CONTROL_CHARS = /\p{Cc}/u;

/**
 * Returns `value` only when it is a same-origin relative path, so a `?next=`
 * parameter cannot turn the login redirect into an open redirect.
 */
export function safeNext(
  value: string | null | undefined,
  fallback = '/conta',
): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    CONTROL_CHARS.test(value)
  ) {
    return fallback;
  }
  return value;
}
