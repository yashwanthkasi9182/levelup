const KEY = 'levelup-invite';
export function validInvite(value: string | null): string | null {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}
export function rememberInvite(): string | null {
  const incoming = validInvite(new URLSearchParams(window.location.search).get('invite'));
  if (incoming) localStorage.setItem(KEY, incoming);
  return incoming || validInvite(localStorage.getItem(KEY));
}
export function clearInvite() {
  localStorage.removeItem(KEY);
}
export function authRedirect(path: string) {
  const url = new URL(path, window.location.origin);
  const invite = rememberInvite();
  if (invite) url.searchParams.set('invite', invite);
  return url.toString();
}
