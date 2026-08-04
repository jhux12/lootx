export const MAX_UNBANNED_ACCOUNTS_PER_SIGNUP_IP = 5;

export const shouldAutoBanSignupIpAccount = (accountsBeforeSignup) => (
  Number(accountsBeforeSignup) >= MAX_UNBANNED_ACCOUNTS_PER_SIGNUP_IP
);
