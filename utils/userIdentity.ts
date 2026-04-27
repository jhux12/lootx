type UserIdentityInput = {
  username?: string | null;
  displayName?: string | null;
  email?: string | null;
};

const normalizeWhitespace = (value: string) => value.trim().replace(/\s+/g, ' ');

const getEmailPrefix = (email?: string | null) => {
  if (!email) return '';
  return email.split('@')[0]?.trim() ?? '';
};

export const resolveUserDisplayName = ({ username, displayName, email }: UserIdentityInput) => {
  const usernameValue = normalizeWhitespace(username ?? '');
  if (usernameValue) return usernameValue;

  const displayNameValue = normalizeWhitespace(displayName ?? '');
  if (displayNameValue) return displayNameValue;

  const emailPrefix = normalizeWhitespace(getEmailPrefix(email));
  if (emailPrefix) return emailPrefix;

  return 'User';
};

export const getUserInitials = ({ username, displayName, email }: UserIdentityInput) => {
  const candidate = normalizeWhitespace(username || displayName || '');

  if (candidate) {
    const words = candidate.split(' ').filter(Boolean);
    if (words.length >= 2) {
      const first = words[0]?.charAt(0) ?? '';
      const last = words[words.length - 1]?.charAt(0) ?? '';
      const combined = `${first}${last}`.trim().toUpperCase();
      if (combined) return combined;
    }

    const twoChars = candidate.replace(/\s+/g, '').slice(0, 2).toUpperCase();
    if (twoChars) return twoChars;
  }

  const emailPrefix = getEmailPrefix(email).replace(/\s+/g, '').slice(0, 2).toUpperCase();
  if (emailPrefix) return emailPrefix;

  return 'U';
};
