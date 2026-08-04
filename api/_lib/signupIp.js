import { createHash } from 'node:crypto';

import { db } from './firebaseAdmin.js';
import { shouldAutoBanSignupIpAccount } from './signupIpPolicy.js';

const getCounterId = (signupIp) => createHash('sha256').update(signupIp).digest('hex');

export const recordSignupIp = async (uid, signupIp) => {
  const userRef = db.collection('users').doc(uid);
  const counterRef = db.collection('signupIpCounters').doc(getCounterId(signupIp));

  return db.runTransaction(async (transaction) => {
    // A user can retry the endpoint, so never count or reassess an address twice.
    const userSnapshot = await transaction.get(userRef);
    if (userSnapshot.data()?.signupIp) {
      return { recorded: false, autoBanned: false, accountNumber: null };
    }

    const counterSnapshot = await transaction.get(counterRef);
    let accountsBeforeSignup;
    if (counterSnapshot.exists) {
      accountsBeforeSignup = Math.max(0, Number(counterSnapshot.data()?.accountCount ?? 0));
    } else {
      // Seed the counter from addresses recorded before counters were introduced.
      // Reading it in this transaction also makes concurrent initialization safe.
      const existingAccounts = await transaction.get(
        db.collection('users').where('signupIp', '==', signupIp)
      );
      accountsBeforeSignup = existingAccounts.size;
    }

    const accountNumber = accountsBeforeSignup + 1;
    const autoBanned = shouldAutoBanSignupIpAccount(accountsBeforeSignup);
    const now = new Date();

    transaction.set(counterRef, {
      signupIp,
      accountCount: accountNumber,
      updatedAt: now
    }, { merge: true });
    transaction.set(userRef, {
      signupIp,
      signupIpRecordedAt: now,
      signupIpAccountNumber: accountNumber,
      ...(autoBanned ? {
        status: 'banned',
        autoBannedAt: now,
        autoBanReason: 'signup_ip_account_limit'
      } : {}),
      updatedAt: now
    }, { merge: true });

    return { recorded: true, autoBanned, accountNumber };
  });
};
