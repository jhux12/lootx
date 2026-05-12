import crypto from 'crypto';

export const sha256 = (value) =>
  crypto.createHash('sha256').update(value).digest('hex');

export const hmacSha256Hex = (key, message) =>
  crypto.createHmac('sha256', key).update(message).digest('hex');

export const randomSeed = () => crypto.randomBytes(32).toString('hex');

export const computeRoll = (serverSeed, clientSeed, nonce, boxId) => {
  const message = `${clientSeed}:${nonce}:${boxId}`;
  const rollHash = hmacSha256Hex(serverSeed, message);
  const intValue = parseInt(rollHash.slice(0, 13), 16);
  const roll = intValue / 0x10000000000000;

  return { roll, rollHash, message };
};

export const computeUpgradeRoll = (serverSeed, clientSeed, nonce, targetItemId, sourceItemInstanceId) => {
  const message = `${clientSeed}:${nonce}:upgrader:${targetItemId}:${sourceItemInstanceId}`;
  const rollHash = hmacSha256Hex(serverSeed, message);
  const intValue = parseInt(rollHash.slice(0, 13), 16);
  const roll = intValue / 0x10000000000000;

  return { roll, rollHash, message };
};

export const pickPrizeByWeight = (prizes, roll) => {
  const normalized = prizes.map((prize) => ({
    ...prize,
    weight: Number(prize.weight ?? prize.chance ?? 0)
  }));
  const totalWeight = normalized.reduce((sum, prize) => sum + prize.weight, 0);
  if (!totalWeight) {
    return normalized[normalized.length - 1];
  }

  let threshold = roll * totalWeight;
  for (const prize of normalized) {
    if (threshold < prize.weight) return prize;
    threshold -= prize.weight;
  }

  return normalized[normalized.length - 1];
};
