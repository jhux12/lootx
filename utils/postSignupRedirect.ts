const POST_SIGNUP_REDIRECT_KEY = 'postSignupRedirect';

export const DEFAULT_POST_SIGNUP_REDIRECT = '/case/free-box';

export const setPostSignupRedirect = (path: string = DEFAULT_POST_SIGNUP_REDIRECT) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(POST_SIGNUP_REDIRECT_KEY, path);
};

export const readPostSignupRedirect = () => {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(POST_SIGNUP_REDIRECT_KEY);
  return value && value.trim() ? value.trim() : null;
};

export const consumePostSignupRedirect = () => {
  if (typeof window === 'undefined') return null;
  const fromStorage = readPostSignupRedirect();
  const url = new URL(window.location.href);
  const fromQuery = url.searchParams.get('postSignupRedirect');
  if (fromQuery && fromQuery.trim()) {
    url.searchParams.delete('postSignupRedirect');
    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
  }
  const nextPath = fromStorage || (fromQuery && fromQuery.trim() ? fromQuery.trim() : null);
  if (nextPath) {
    window.localStorage.removeItem(POST_SIGNUP_REDIRECT_KEY);
  }
  return nextPath;
};
