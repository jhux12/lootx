import React from 'react';
import { ManagedFooterContent } from './FooterManagedContent';

type TrustPageVariant = 'faq' | 'about' | 'shipping' | 'refund';

const pageKeyMap: Record<TrustPageVariant, 'faq' | 'about' | 'shipping' | 'refund'> = {
  faq: 'faq',
  about: 'about',
  shipping: 'shipping',
  refund: 'refund'
};

export const TrustPage: React.FC<{ variant: TrustPageVariant }> = ({ variant }) => (
  <ManagedFooterContent pageKey={pageKeyMap[variant]} />
);
