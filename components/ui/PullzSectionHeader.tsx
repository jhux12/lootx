import React from 'react';

export type PullzSectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export const PullzSectionHeader: React.FC<PullzSectionHeaderProps> = ({
  eyebrow,
  title,
  description,
  action,
  className = ''
}) => (
  <div className={`mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}>
    <div className="max-w-2xl">
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pullz-primary-hover">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-pullz-text sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 text-sm leading-6 text-pullz-text-secondary sm:text-base">
          {description}
        </p>
      ) : null}
    </div>
    {action}
  </div>
);
