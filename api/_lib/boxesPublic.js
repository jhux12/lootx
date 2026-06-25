const UNAVAILABLE_STATUSES = new Set(['draft', 'disabled', 'deleted', 'archived', 'test', 'admin-only', 'admin_only', 'private']);

export const isPublicBoxDocument = (data = {}) => {
  if (data.draft === true) return false;
  if (data.disabled === true) return false;
  if (data.deleted === true) return false;
  if (data.archived === true) return false;
  if (data.test === true) return false;
  if (data.adminOnly === true) return false;
  if (data.admin_only === true) return false;
  if (data.public === false) return false;
  if (data.visible === false) return false;
  if (data.published === false) return false;
  if (data.active === false) return false;

  const status = typeof data.status === 'string' ? data.status.trim().toLowerCase() : '';
  if (status && UNAVAILABLE_STATUSES.has(status)) return false;

  return true;
};

export const normalizeTimestamp = (value) => {
  if (!value) return undefined;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

export const toSafeLimit = (value, fallback = 120, max = 120) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(numeric)));
};

export const mapPublicBoxSummary = (doc) => {
  const data = doc.data() || {};
  return {
    id: doc.id,
    name: data.name ?? 'Mystery Box',
    price: Number(data.price ?? 0),
    priceXP: data.priceXP != null ? Number(data.priceXP) : undefined,
    currencyType: data.currencyType,
    image: typeof data.image === 'string' ? data.image : '',
    spinnerBackgroundImage: typeof data.spinnerBackgroundImage === 'string' ? data.spinnerBackgroundImage : undefined,
    accentColor: data.accentColor ?? '#3b82f6',
    tag: data.tag,
    tags: Array.isArray(data.tags) ? data.tags.filter((tag) => typeof tag === 'string') : undefined,
    isDaily: data.isDaily === true,
    isPullPassBox: data.isPullPassBox === true,
    pullPassBoxType: typeof data.pullPassBoxType === 'string' ? data.pullPassBoxType : undefined,
    targetEV: data.targetEV !== undefined ? Number(data.targetEV) : undefined,
    riskLevel: data.riskLevel !== undefined ? Number(data.riskLevel) : undefined,
    isUserCreated: data.isUserCreated === true,
    sellBackRate: data.sellBackRate !== undefined ? Number(data.sellBackRate) : undefined,
    createdAt: normalizeTimestamp(data.createdAt),
    updatedAt: normalizeTimestamp(data.updatedAt)
  };
};

const mapPublicPrize = (rawItem, index, boxId) => {
  const item = rawItem && typeof rawItem === 'object' ? rawItem : {};
  const price = Number(item.value ?? item.price ?? 0);
  const image = typeof item.image === 'string' ? item.image : (typeof item.imageUrl === 'string' ? item.imageUrl : '');
  return {
    id: String(item.id ?? `${boxId}-item-${index}`),
    name: item.name ?? 'Mystery Item',
    price,
    image,
    rarity: item.rarity ?? 'common',
    chance: Number(item.weight ?? item.chance ?? 0),
    color: item.color,
    brand: typeof item.brand === 'string' ? item.brand : '',
    category: typeof item.category === 'string' ? item.category : '',
    tags: Array.isArray(item.tags) ? item.tags.filter((tag) => typeof tag === 'string') : [],
    sizes: Array.isArray(item.sizes) ? item.sizes.filter((size) => typeof size === 'string') : [],
    redeemable: item.redeemable ?? true,
    forceFullSellBack: item.forceFullSellBack === true,
    valueUsd: item.valueUsd !== undefined ? Number(item.valueUsd) : undefined,
    valueCoins: item.valueCoins !== undefined ? Number(item.valueCoins) : price,
    sellBackCoins: item.sellBackCoins !== undefined ? Number(item.sellBackCoins) : undefined
  };
};

export const mapPublicBoxDetails = (doc) => {
  const data = doc.data() || {};
  const prizeSource = Array.isArray(data.items) ? data.items : data.prizes;
  return {
    ...mapPublicBoxSummary(doc),
    items: Array.isArray(prizeSource) ? prizeSource.map((item, index) => mapPublicPrize(item, index, doc.id)) : []
  };
};

export const PUBLIC_BOX_SELECT_FIELDS = [
  'name',
  'price',
  'priceXP',
  'currencyType',
  'image',
  'spinnerBackgroundImage',
  'accentColor',
  'tag',
  'tags',
  'isDaily',
  'isPullPassBox',
  'pullPassBoxType',
  'targetEV',
  'riskLevel',
  'isUserCreated',
  'sellBackRate',
  'createdAt',
  'updatedAt',
  'draft',
  'disabled',
  'deleted',
  'archived',
  'test',
  'adminOnly',
  'admin_only',
  'public',
  'visible',
  'published',
  'active',
  'status'
];
