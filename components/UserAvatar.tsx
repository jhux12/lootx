import React from 'react';
import { getUserInitials } from '../utils/userIdentity';

type UserAvatarProps = {
  username?: string;
  displayName?: string;
  email?: string;
  photoURL?: string | null;
  avatar?: string | null;
  alt: string;
  className?: string;
  initialsClassName?: string;
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  username,
  displayName,
  email,
  photoURL,
  avatar,
  alt,
  className = '',
  initialsClassName = ''
}) => {
  const imageUrl = photoURL || avatar || '';
  if (imageUrl) {
    return <img src={imageUrl} alt={alt} className={className} />;
  }

  const initials = getUserInitials({ username, displayName, email });
  return (
    <div
      aria-label={alt}
      className={`flex items-center justify-center bg-gradient-to-br from-indigo-500/80 via-violet-500/70 to-cyan-500/70 text-white ${className}`}
    >
      <span className={`font-black tracking-wide ${initialsClassName}`}>{initials}</span>
    </div>
  );
};
