export const DEFAULT_APP_URL = 'https://ripza.gg';

/** Returns a stable origin for server-generated customer links. */
export const getAppUrl = () => (process.env.APP_URL || DEFAULT_APP_URL).replace(/\/$/, '');

