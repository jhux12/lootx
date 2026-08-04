import { createHash } from 'node:crypto';

import { db } from './firebaseAdmin.js';
import { evaluateSignupFraud } from './fraudPolicy.js';

const getCounterId = (signupIp) => createHash('sha256').update(signupIp).digest('hex');

const normalizeDeviceId = (deviceId) => (
  typeof deviceId === 'string' && /^[a-zA-Z0-9-]{16,128}$/.test(deviceId) ? deviceId : null
);

export const recordSignupIp = async (uid, signupIp, rawDeviceId = null) => {
  const deviceId = normalizeDeviceId(rawDeviceId);
  const userRef = db.collection('users').doc(uid);
  const counterRef = db.collection('signupIpCounters').doc(getCounterId(signupIp));
  const deviceCounterRef = deviceId
    ? db.collection('deviceCounters').doc(getCounterId(deviceId))
    : null;

  return db.runTransaction(async (transaction) => {
    const userSnapshot = await transaction.get(userRef);
    const currentUser = userSnapshot.data() ?? {};
    const needsIp = !currentUser.signupIp;
    const needsDevice = Boolean(deviceId && !currentUser.deviceId);
    if (!needsIp && !needsDevice) {
      return { recorded: false, autoBanned: false, accountNumber: null };
    }

    const counterSnapshot = await transaction.get(counterRef);
    const deviceCounterSnapshot = deviceCounterRef ? await transaction.get(deviceCounterRef) : null;
    const existingIpAccounts = await transaction.get(db.collection('users').where('signupIp', '==', signupIp));
    const existingDeviceAccounts = deviceId
      ? await transaction.get(db.collection('users').where('deviceId', '==', deviceId))
      : null;
    const storedIpCount = counterSnapshot.exists ? Math.max(0, Number(counterSnapshot.data()?.accountCount ?? 0)) : existingIpAccounts.size;
    const accountsBeforeSignup = needsIp ? storedIpCount : Math.max(0, storedIpCount - 1);

    const accountNumber = accountsBeforeSignup + 1;
    const storedDeviceCount = deviceId
      ? (deviceCounterSnapshot?.exists ? Math.max(0, Number(deviceCounterSnapshot.data()?.accountCount ?? 0)) : existingDeviceAccounts.size)
      : 0;
    const accountsBeforeDevice = needsDevice ? storedDeviceCount : Math.max(0, storedDeviceCount - 1);
    const relatedUsers = [...existingIpAccounts.docs, ...(existingDeviceAccounts?.docs ?? [])]
      .filter((snapshot) => snapshot.id !== uid);
    const ipWelcomeBonusClaimed = relatedUsers.some((snapshot) => snapshot.data()?.signupIp === signupIp && snapshot.data()?.welcomeBonusClaimedAt);
    const deviceWelcomeBonusClaimed = Boolean(deviceId && relatedUsers.some((snapshot) => snapshot.data()?.deviceId === deviceId && snapshot.data()?.welcomeBonusClaimedAt));
    const assessment = evaluateSignupFraud({ accountsBeforeDevice, accountsBeforeIp: accountsBeforeSignup, deviceWelcomeBonusClaimed, ipWelcomeBonusClaimed });
    const now = new Date();

    if (needsIp) transaction.set(counterRef, {
      signupIp,
      accountCount: accountNumber,
      updatedAt: now
    }, { merge: true });
    if (deviceCounterRef && needsDevice) transaction.set(deviceCounterRef, {
      deviceIdHash: getCounterId(deviceId),
      accountCount: accountsBeforeDevice + 1,
      updatedAt: now
    }, { merge: true });
    transaction.set(userRef, {
      signupIp,
      signupIpRecordedAt: now,
      signupIpAccountNumber: needsIp ? accountNumber : currentUser.signupIpAccountNumber,
      ...(deviceId ? { deviceId, deviceAccountNumber: accountsBeforeDevice + 1 } : {}),
      fraudScore: assessment.score,
      fraudSignals: assessment.reasons,
      fraudAssessedAt: now,
      ...(assessment.autoBanned ? {
        status: 'banned',
        autoBannedAt: now,
        autoBanReason: assessment.autoBanReason
      } : {}),
      updatedAt: now
    }, { merge: true });

    return { recorded: true, autoBanned: assessment.autoBanned, accountNumber, deviceAccountNumber: deviceId ? accountsBeforeDevice + 1 : null, fraudScore: assessment.score };
  });
};
