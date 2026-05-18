import React from 'react';
import { User } from '../types';
import { getUserInitials } from '../utils/userIdentity';

type UserAvatarProps = {
  user: Partial<User>;
  className?: string;
  initialsClassName?: string;
};

export const UserAvatar: React.FC<UserAvatarProps> = ({ user, className = '', initialsClassName = '' }) => {
  const photoUrl = String(user.photoURL ?? '').trim();
  const initials = getUserInitials(user);
  if (photoUrl) {
    return <img src={photoUrl} alt={String(user.name ?? 'User')} className={className} width={40} height={40} decoding="async" />;
  }
  return (
    <div className={`grid place-items-center rounded-full border border-white/10 bg-[#1a1f2e] text-white ${className}`}>
      <span className={`font-bold uppercase tracking-wide ${initialsClassName}`}>{initials || 'U'}</span>
    </div>
  );
};
