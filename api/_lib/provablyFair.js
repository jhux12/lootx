import crypto from 'crypto';

const sha256 = (value) =>
  crypto.createHash('sha256').update(value).digest('hex');

const hmacSha256Hex = (key, message) =>
  crypto.createHmac('sha256', key).update(message).digest('hex');

const randomSeed = () => crypto.randomBytes(32).toString('hex');

const computeRoll = (serverSeed, clientSeed, nonce, caseId) => {
  const message = `${clientSeed}:${nonce}:${caseId}`;
  const hash = hmacSha256Hex(serverSeed, message);
  const roll = parseInt(hash.slice(0, 13), 16) / 2 ** 52;
  return { roll, hash, message };
};

const pickPrizeByWeight = (prizes, roll) => {
  const totalWeight = prizes.reduce((sum, prize) => sum + Number(prize.weight ?? 0), 0);
  let threshold = roll * totalWeight;

  for (const prize of prizes) {
    const weight = Number(prize.weight ?? 0);
    if (threshold < weight) {
      return prize;
    }
    threshold -= weight;
  }

  return prizes[prizes.length - 1];
};

export {
  sha256,
  hmacSha256Hex,
  randomSeed,
  computeRoll,
  pickPrizeByWeight
};
