import { User } from '../types';

const getEmailPrefix = (email?: string) => {
  if (!email) return '';
  return (email.split('@')[0] ?? '').trim();
};

export const resolveUserDisplayName = (user?: Partial<User> | null) => {
  if (!user) return 'User';
  const firestoreUsername = String(user.username ?? '').trim();
  if (firestoreUsername) return firestoreUsername;
  const firebaseDisplayName = String(user.displayName ?? '').trim();
  if (firebaseDisplayName) return firebaseDisplayName;
  const emailPrefix = getEmailPrefix(user.email);
  if (emailPrefix) return emailPrefix;
  return 'User';
};

export const getUserInitials = (user?: Partial<User> | null) => {
  const displayName = resolveUserDisplayName(user).trim();
  const parts = displayName.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  const emailPrefix = getEmailPrefix(user?.email).slice(0, 2).toUpperCase();
  return emailPrefix || 'U';
};
