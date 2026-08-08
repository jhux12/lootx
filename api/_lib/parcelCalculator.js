const finite = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const fitsDimensions = (pkg, override = {}) => {
  const item = [override.lengthIn, override.widthIn, override.heightIn];
  if (item.every((value) => value == null)) return true;
  if (!item.every(finite)) return false;
  const packageDimensions = [pkg.lengthIn, pkg.widthIn, pkg.heightIn];
  if (!packageDimensions.every(finite)) return false;
  return item.sort((a, b) => a - b).every((value, index) => value <= packageDimensions.sort((a, b) => a - b)[index]);
};

export function calculateShipmentParcel({ items = [], shippingProfiles = [], shippingPackages = [] }) {
  if (!Array.isArray(items) || items.length === 0) return { status: 'invalid_items', reason: 'Select at least one inventory item.', warnings: [] };
  const profiles = new Map(shippingProfiles.map((profile) => [profile.id, profile]));
  const missingItemIds = []; const profileCounts = {}; let itemWeightOz = 0;
  for (const item of items) {
    const profile = profiles.get(item.shippingProfileId);
    if (!profile || !finite(Number(profile.defaultWeightOz))) { missingItemIds.push(String(item.id ?? item.instanceId ?? 'unknown')); continue; }
    const overrideWeight = item.shippingOverride?.weightOz;
    const weight = overrideWeight == null ? Number(profile.defaultWeightOz) : Number(overrideWeight);
    if (!finite(weight)) { missingItemIds.push(String(item.id ?? item.instanceId ?? 'unknown')); continue; }
    itemWeightOz += weight; profileCounts[profile.id] = (profileCounts[profile.id] ?? 0) + 1;
  }
  if (missingItemIds.length) return { status: 'invalid_items', reason: `${missingItemIds.length} selected item${missingItemIds.length === 1 ? ' is' : 's are'} missing a valid shipping profile or weight.`, missingItemIds, warnings: [] };
  const packages = shippingPackages.filter((pkg) => pkg.active === true).sort((a, b) => Number(a.priority) - Number(b.priority));
  for (const pkg of packages) {
    if (![pkg.lengthIn, pkg.widthIn, pkg.heightIn, pkg.emptyWeightOz].every((value) => finite(Number(value)))) continue;
    if (!Object.entries(profileCounts).every(([id, count]) => Number(pkg.capacityByProfileId?.[id] ?? 0) >= count)) continue;
    if (!items.every((item) => fitsDimensions(pkg, item.shippingOverride))) continue;
    const totalWeightOz = itemWeightOz + Number(pkg.emptyWeightOz);
    if (pkg.maxWeightOz != null && (!finite(Number(pkg.maxWeightOz)) || totalWeightOz > Number(pkg.maxWeightOz))) continue;
    return { status: 'ready', packageId: pkg.id, packageName: pkg.name, lengthIn: Number(pkg.lengthIn), widthIn: Number(pkg.widthIn), heightIn: Number(pkg.heightIn), itemWeightOz, packagingWeightOz: Number(pkg.emptyWeightOz), totalWeightOz, profileCounts, warnings: Object.keys(profileCounts).length > 1 ? ['Mixed-profile capacity uses configured per-profile limits; review unusual combinations.'] : [] };
  }
  return { status: 'no_package', reason: 'No configured shipping package can fit the selected items.', warnings: [] };
}
