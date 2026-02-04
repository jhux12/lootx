import { User } from '../types';

export const getUserDisplayName = (user?: Pick<User, 'username' | 'name'> | null) => {
  if (!user) return 'Player';
  return user.username || user.name || 'Player';
};
