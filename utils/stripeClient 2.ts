import type { Stripe } from '@stripe/stripe-js';

type ViteImportMeta = ImportMeta & { env: Record<string, string | undefined> };

let stripePromise: Promise<Stripe | null> | null = null;

export const getStripe = () => {
  if (!stripePromise) {
    const publishableKey = (import.meta as ViteImportMeta).env.VITE_STRIPE_PUBLISHABLE_KEY;
    stripePromise = import('@stripe/stripe-js/pure').then(({ loadStripe }) =>
      loadStripe(publishableKey)
    );
  }

  return stripePromise;
};
