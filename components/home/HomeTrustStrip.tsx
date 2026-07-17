import { Archive, Eye, PackageCheck, Truck } from 'lucide-react';
import { TrustBadge } from '../ui/TrustBadge';
export const HomeTrustStrip=()=> <section className="bg-pullz-canvas px-3 py-6 sm:px-6 lg:px-8"><div className="mx-auto grid max-w-[1250px] gap-3 sm:grid-cols-2 lg:grid-cols-4"><TrustBadge icon={Archive} title="Real Collectibles"/><TrustBadge icon={Eye} title="Visible Item Pools"/><TrustBadge icon={PackageCheck} title="Keep, Ship, or Sell"/><TrustBadge icon={Truck} title="Tracked Fulfillment"/></div></section>;
