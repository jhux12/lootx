const finite = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const positive = (value) => finite(value) && value > 0;
const itemId = (item) => String(item.id ?? item.instanceId ?? 'unknown');
const dimensionsFrom = (value = {}) => {
  const raw = [value.lengthIn, value.widthIn, value.heightIn];
  if (raw.some((entry) => entry == null || entry === '')) return null;
  const dimensions = raw.map(Number);
  return dimensions.every(positive) ? dimensions : null;
};
const fitsDimensions = (pkg, dimensions) => {
  if (!dimensions) return true;
  const packageDimensions = [pkg.lengthIn, pkg.widthIn, pkg.heightIn].map(Number);
  if (!packageDimensions.every(positive)) return false;
  const sortedItem = [...dimensions].sort((a, b) => a - b);
  const sortedPackage = packageDimensions.sort((a, b) => a - b);
  return sortedItem.every((value, index) => value <= sortedPackage[index]);
};
const failure = (errorCode, reason, missingItemIds = []) => ({
  status: 'invalid_items', errorCode, reason, ...(missingItemIds.length ? { missingItemIds } : {}), warnings: []
});

export function calculateShipmentParcel({ items = [], shippingProfiles = [], shippingPackages = [] }) {
  if (!Array.isArray(items) || items.length === 0) return failure('SHIPPING_PROFILE_REQUIRED', 'Select at least one inventory item.');
  const profiles = new Map(shippingProfiles.map((profile) => [profile.id, profile]));
  const profileCounts = {}; const itemDimensions = []; let itemWeightOz = 0;
  const missingProfiles = []; const missingWeights = []; const missingDimensions = [];

  for (const item of items) {
    const profile = profiles.get(item.shippingProfileId);
    if (!profile) { missingProfiles.push(itemId(item)); continue; }
    const overrideWeight = item.shippingOverride?.weightOz;
    const weight = Number(overrideWeight == null ? profile.defaultWeightOz : overrideWeight);
    if (!finite(weight)) { missingWeights.push(itemId(item)); continue; }
    const override = item.shippingOverride ?? {};
    const hasAnyDimension = [override.lengthIn, override.widthIn, override.heightIn].some((value) => value != null && value !== '');
    const dimensions = dimensionsFrom(override);
    if ((profile.requiresCustomDimensions || hasAnyDimension) && !dimensions) { missingDimensions.push(itemId(item)); continue; }
    if (dimensions) itemDimensions.push(dimensions);
    itemWeightOz += weight;
    profileCounts[profile.id] = (profileCounts[profile.id] ?? 0) + 1;
  }

  if (missingProfiles.length) return failure('SHIPPING_PROFILE_REQUIRED', `${missingProfiles.length} selected item${missingProfiles.length === 1 ? ' needs' : 's need'} a shipping profile.`, missingProfiles);
  if (missingWeights.length) return failure('ITEM_WEIGHT_REQUIRED', `${missingWeights.length} selected item${missingWeights.length === 1 ? ' needs' : 's need'} a valid shipping weight.`, missingWeights);
  if (missingDimensions.length) return failure('ITEM_DIMENSIONS_REQUIRED', `${missingDimensions.length} selected item${missingDimensions.length === 1 ? ' needs' : 's need'} individual shipping dimensions.`, missingDimensions);

  // Existing profile-specific capacities remain optional restrictions. A
  // missing entry means unrestricted; explicit zero still excludes a profile.
  const explicitCapacity = (pkg, profileId) => {
    const profile = profiles.get(profileId); const capacities = pkg.capacityByProfileId ?? pkg.capacity ?? {};
    const value = capacities[profileId] ?? (profile?.slug ? capacities[profile.slug] : undefined);
    return value == null || value === '' ? null : Number(value);
  };
  const bufferValue = Number(process.env.PACKING_WEIGHT_BUFFER_OZ ?? 0);
  const bufferWeightOz = finite(bufferValue) ? bufferValue : 0;
  const packages = shippingPackages.filter((pkg) => pkg.active !== false).sort((a, b) => (Number(a.priority) || Number.MAX_SAFE_INTEGER) - (Number(b.priority) || Number.MAX_SAFE_INTEGER));
  for (const pkg of packages) {
    if (![pkg.lengthIn, pkg.widthIn, pkg.heightIn].every((value) => positive(Number(value))) || !finite(Number(pkg.emptyWeightOz))) continue;
    if (pkg.maxItemCount != null && (!finite(Number(pkg.maxItemCount)) || items.length > Number(pkg.maxItemCount))) continue;
    if (!Object.entries(profileCounts).every(([id, count]) => { const capacity = explicitCapacity(pkg, id); return capacity == null || (finite(capacity) && capacity >= count); })) continue;
    if (!itemDimensions.every((dimensions) => fitsDimensions(pkg, dimensions))) continue;
    const totalWeightOz = itemWeightOz + Number(pkg.emptyWeightOz) + bufferWeightOz;
    if (pkg.maxWeightOz != null && (!finite(Number(pkg.maxWeightOz)) || totalWeightOz > Number(pkg.maxWeightOz))) continue;
    return { status: 'ready', packageId: pkg.id, packageName: pkg.name, lengthIn: Number(pkg.lengthIn), widthIn: Number(pkg.widthIn), heightIn: Number(pkg.heightIn), itemWeightOz, packagingWeightOz: Number(pkg.emptyWeightOz), bufferWeightOz, totalWeightOz, profileCounts, warnings: Object.keys(profileCounts).length > 1 ? ['Mixed items were evaluated against package weight, item-count, dimension, and explicit profile restrictions.'] : [] };
  }
  return { status: 'no_package', errorCode: 'NO_PACKAGE_AVAILABLE', reason: 'No configured shipping package can fit the selected items.', warnings: [] };
}
