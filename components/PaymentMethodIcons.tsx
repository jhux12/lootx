import React from 'react';
import applePayIcon from '../assets/svgicons/Size=lg, Payment method=ApplePay.png';
import discoverIcon from '../assets/svgicons/Size=lg, Payment method=Discover.png';
import googlePayIcon from '../assets/svgicons/Size=lg, Payment method=GooglePay.png';
import klarnaIcon from '../assets/svgicons/Size=lg, Payment method=Klarna.png';
import mastercardIcon from '../assets/svgicons/Size=lg, Payment method=Mastercard.png';
import shopPayIcon from '../assets/svgicons/Size=lg, Payment method=Shop Pay.png';
import stripeIcon from '../assets/svgicons/Size=lg, Payment method=Stripe.png';
import visaIcon from '../assets/svgicons/Size=lg, Payment method=Visa.png';

const paymentMethods = [
  { src: visaIcon, label: 'Visa' },
  { src: mastercardIcon, label: 'Mastercard' },
  { src: applePayIcon, label: 'Apple Pay' },
  { src: googlePayIcon, label: 'Google Pay' },
  { src: shopPayIcon, label: 'Shop Pay' },
  { src: discoverIcon, label: 'Discover' },
  { src: stripeIcon, label: 'Stripe' },
  { src: klarnaIcon, label: 'Klarna' }
];

type PaymentMethodIconsProps = {
  className?: string;
  iconClassName?: string;
};

export const PaymentMethodIcons: React.FC<PaymentMethodIconsProps> = ({
  className = '',
  iconClassName = 'h-6 sm:h-7'
}) => (
  <div className={`flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 ${className}`} aria-label="Accepted payment methods">
    {paymentMethods.map(({ src, label }) => (
      <img
        key={label}
        src={src}
        alt={label}
        className={`w-auto object-contain ${iconClassName}`}
        loading="lazy"
      />
    ))}
  </div>
);
