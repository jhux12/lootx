export function isCaseOpeningView(pathname?: string): boolean {
  const path = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  return /\/case(\b|\/|$)/i.test(path);
}
