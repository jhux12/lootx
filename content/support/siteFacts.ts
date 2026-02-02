export const siteFacts = {
  brandName: 'PULLZ.gg',
  productName: 'Pullz',
  platformType: 'mystery box and case opening experience',
  currency: 'coins',
  coinDisplayMultiplier: 100,
  starterCoins: 1000,
  caseBattles: {
    available: false,
    status: 'Coming soon'
  },
  sellBackRates: {
    defaultAdminCaseRate: 0.82,
    defaultUserCaseRate: 0.75,
    caseLabSellBackPercent: 75
  },
  caseLab: {
    publishFeeCoins: 0,
    sellBackPercent: 75
  },
  shipping: {
    coinShippingEnabled: false,
    coinShippingCostCoins: 0,
    cashShippingEnabled: false,
    cashFlatRateCents: 0
  },
  authentication: {
    methods: ['email_password', 'google'],
    requiresAdultConfirmation: true,
    requiresTermsAcceptance: true
  },
  provablyFair: {
    enabled: true,
    algorithm: 'HMAC-SHA256(serverSeed, clientSeed:nonce:boxId)',
    usesServerSeedHash: true
  }
};
