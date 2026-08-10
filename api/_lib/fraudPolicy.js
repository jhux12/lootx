import { MAX_UNBANNED_ACCOUNTS_PER_SIGNUP_IP } from './signupIpPolicy.js';

export const FRAUD_BAN_SCORE = 8;
export const MAX_UNBANNED_ACCOUNTS_PER_DEVICE = 3;

export const FRAUD_POINTS = Object.freeze({
  sharedDevice: 4,
  sharedIp: 3,
  deviceWelcomeBonus: 8,
  ipWelcomeBonus: 4
});

export const evaluateSignupFraud = ({
  accountsBeforeDevice = 0,
  accountsBeforeIp = 0,
  deviceWelcomeBonusClaimed = false,
  ipWelcomeBonusClaimed = false
} = {}) => {
  const deviceAccountCount = Math.max(0, Number(accountsBeforeDevice) || 0);
  const ipAccountCount = Math.max(0, Number(accountsBeforeIp) || 0);
  const reasons = [];
  let score = 0;

  if (deviceAccountCount > 0) {
    score += FRAUD_POINTS.sharedDevice;
    reasons.push('shared_device');
  }
  if (ipAccountCount > 0) {
    score += FRAUD_POINTS.sharedIp;
    reasons.push('shared_ip');
  }
  if (deviceWelcomeBonusClaimed) {
    score += FRAUD_POINTS.deviceWelcomeBonus;
    reasons.push('device_welcome_bonus_claimed');
  }
  if (ipWelcomeBonusClaimed) {
    score += FRAUD_POINTS.ipWelcomeBonus;
    reasons.push('ip_welcome_bonus_claimed');
  }

  const immediateReason = deviceAccountCount >= MAX_UNBANNED_ACCOUNTS_PER_DEVICE
    ? 'device_account_limit'
    : ipAccountCount >= MAX_UNBANNED_ACCOUNTS_PER_SIGNUP_IP
      ? 'signup_ip_account_limit'
      : null;

  return {
    score: Math.min(10, score),
    reasons,
    autoBanned: Boolean(immediateReason) || score >= FRAUD_BAN_SCORE,
    autoBanReason: immediateReason ?? (score >= FRAUD_BAN_SCORE ? 'fraud_score_threshold' : null)
  };
};
