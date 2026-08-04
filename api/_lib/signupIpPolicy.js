export const MAX_UNBANNED_ACCOUNTS_PER_SIGNUP_IP = 3;

export const shouldAutoBanSignupIpAccount = (accountsBeforeSignup) => (
  Number(accountsBeforeSignup) >= MAX_UNBANNED_ACCOUNTS_PER_SIGNUP_IP
);
