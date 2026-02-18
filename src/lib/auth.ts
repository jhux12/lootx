import { isSignInWithEmailLink, sendSignInLinkToEmail, signInWithEmailLink } from 'firebase/auth';
import { auth } from './firebase';

export const EMAIL_RECOVERY_ERROR_MESSAGE =
  'For security, open this link in the same browser/device you requested it from OR enter your email to continue/resend.';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const sendMagicLink = async (email: string) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error('Please enter a valid email address.');
  }

  localStorage.setItem('emailForSignIn', normalizedEmail);
  sessionStorage.setItem('emailForSignIn', normalizedEmail);
  localStorage.setItem('lastLoginEmail', normalizedEmail);

  await sendSignInLinkToEmail(auth, normalizedEmail, {
    url: `${window.location.origin}/finish-signin`,
    handleCodeInApp: true
  });
};

export const finishMagicLinkSignIn = async (emailOverride?: string) => {
  if (!isSignInWithEmailLink(auth, window.location.href)) {
    throw new Error('Invalid or expired sign-in link.');
  }

  const recoveredEmail =
    emailOverride?.trim().toLowerCase() ||
    localStorage.getItem('emailForSignIn') ||
    sessionStorage.getItem('emailForSignIn') ||
    localStorage.getItem('lastLoginEmail');

  if (!recoveredEmail) {
    throw new Error(EMAIL_RECOVERY_ERROR_MESSAGE);
  }

  const result = await signInWithEmailLink(auth, recoveredEmail, window.location.href);
  localStorage.removeItem('emailForSignIn');
  sessionStorage.removeItem('emailForSignIn');
  localStorage.setItem('lastLoginEmail', recoveredEmail);
  return result;
};
