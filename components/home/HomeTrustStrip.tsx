import { Eye, PackageCheck, Scale, ShieldCheck } from 'lucide-react';
import { PullzTrustBadge } from '../ui/PullzTrustBadge';

export const HomeTrustStrip = () => (
  <section className="pullz-home-trust-grid mt-5 px-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
    <div className="mx-auto grid max-w-[1180px] grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
      <PullzTrustBadge icon={PackageCheck} title="Authentic Collectibles" body="Physical items" />
      <PullzTrustBadge icon={Eye} title="Visible Item Pools" body="Review before opening" />
      <PullzTrustBadge icon={Scale} title="Keep, Ship, or Sell" body="Choose after reveal" />
      <PullzTrustBadge icon={ShieldCheck} title="Provably Fair" body="Verifiable results" />
    </div>
  </section>
);
