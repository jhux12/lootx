import React from 'react';
import { ManagedFooterContent } from './FooterManagedContent';
import { HomepageFaqSection } from './HomepageFaqSection';

type TrustPageVariant = 'faq' | 'about' | 'shipping' | 'refund';

const pageKeyMap: Record<TrustPageVariant, 'faq' | 'about' | 'shipping' | 'refund'> = {
  faq: 'faq',
  about: 'about',
  shipping: 'shipping',
  refund: 'refund'
};

export const TrustPage: React.FC<{ variant: TrustPageVariant }> = ({ variant }) => (
  variant === 'faq' ? <HomepageFaqSection standalone /> : <ManagedFooterContent pageKey={pageKeyMap[variant]} />
);
