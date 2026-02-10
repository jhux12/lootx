const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/missing-password': 'Enter your password.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/email-already-in-use': 'An account already exists with this email.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/too-many-requests': 'Too many attempts. Try again later.',
  'auth/network-request-failed': 'Network error. Check your connection.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/unauthorized-domain': 'Login is not available from this domain.',
  'auth/invalid-credential': 'Incorrect email or password.',
};

const DEFAULT_AUTH_ERROR_MESSAGE = 'Something went wrong. Please try again.';

const extractAuthCode = (error: unknown): string | null => {
  if (!error) return null;

  if (typeof error === 'string') {
    const match = error.match(/(auth\/[a-z-]+)/i);
    return match ? match[1].toLowerCase() : null;
  }

  if (typeof error === 'object') {
    const maybeCode = (error as { code?: unknown }).code;
    if (typeof maybeCode === 'string' && maybeCode.trim().length > 0) {
      return maybeCode.toLowerCase();
    }

    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === 'string') {
      const match = maybeMessage.match(/(auth\/[a-z-]+)/i);
      return match ? match[1].toLowerCase() : null;
    }
  }

  return null;
};

export const getAuthErrorMessage = (error: unknown): string => {
  const authCode = extractAuthCode(error);

  if (authCode && AUTH_ERROR_MESSAGES[authCode]) {
    return AUTH_ERROR_MESSAGES[authCode];
  }

  if (typeof error === 'string') {
    return authCode ? DEFAULT_AUTH_ERROR_MESSAGE : error;
  }

  if (typeof error === 'object') {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === 'string') {
      return authCode ? DEFAULT_AUTH_ERROR_MESSAGE : maybeMessage;
    }
  }

  return DEFAULT_AUTH_ERROR_MESSAGE;
};
