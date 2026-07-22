const avatarModules = import.meta.glob<string>('./pfp/*.png', {
  eager: true,
  import: 'default'
});

/** The curated profile pictures available in the account editor. */
export const profileAvatars = Object.entries(avatarModules)
  .sort(([firstPath], [secondPath]) => firstPath.localeCompare(secondPath))
  .map(([path, src]) => ({
    id: path.split('/').pop()?.replace(/\.png$/, '') ?? path,
    src
  }));
