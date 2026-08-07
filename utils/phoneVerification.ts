export const PHONE_VERIFICATION_REQUEST_EVENT = 'pullz:request-phone-verification';

export const requestPhoneVerification = (reason: 'free_box' | 'daily_spin') => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PHONE_VERIFICATION_REQUEST_EVENT, { detail: { reason } }));
};
