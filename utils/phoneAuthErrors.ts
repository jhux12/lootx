const PHONE_AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/operation-not-allowed': 'Text-message verification is not enabled yet. Please contact support.',
  'auth/invalid-phone-number': 'Enter a valid mobile number in international format, including the + and country code.',
  'auth/missing-phone-number': 'Enter the mobile number you want to verify.',
  'auth/too-many-requests': 'Too many verification attempts were made. Please wait and try again later.',
  'auth/quota-exceeded': 'The text-message verification limit has been reached. Please try again later.',
  'auth/captcha-check-failed': 'The security check failed. Refresh the page, then try again.',
  'auth/invalid-app-credential': 'The security check could not verify this site. Refresh the page or contact support.',
  'auth/missing-app-credential': 'The security check did not finish. Refresh the page, then try again.',
  'auth/unauthorized-domain': 'Phone verification is not configured for this website domain. Please contact support.',
  'auth/requires-recent-login': 'For security, sign out and sign back in before verifying your phone.',
  'auth/credential-already-in-use': 'That phone number is already linked to another account.',
  'auth/provider-already-linked': 'A phone number is already verified on this account.',
  'auth/network-request-failed': 'A network error interrupted verification. Check your connection and try again.',
  'auth/invalid-verification-code': 'The verification code is incorrect. Check the text message and try again.',
  'auth/code-expired': 'The verification code has expired. Request a new code and try again.',
  'auth/session-expired': 'The verification code has expired. Request a new code and try again.',
  'auth/missing-verification-code': 'Enter the 6-digit code from the text message.'
};

export const getPhoneAuthErrorCode = (error: unknown) => {
  if (!error || typeof error !== 'object') return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code.toLowerCase() : null;
};

export const getPhoneAuthErrorMessage = (error: unknown) => {
  const code = getPhoneAuthErrorCode(error);
  return (code && PHONE_AUTH_ERROR_MESSAGES[code])
    || 'Unable to send the verification code. Please refresh the page and try again.';
};

export const getPhoneCodeErrorMessage = (error: unknown) => {
  const code = getPhoneAuthErrorCode(error);
  return (code && PHONE_AUTH_ERROR_MESSAGES[code])
    || 'We could not verify that code. Request a new code and try again.';
};
