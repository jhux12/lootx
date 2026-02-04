export const sanitizeForFirestore = <T,>(input: T): any => {
  if (Array.isArray(input)) {
    return input
      .map((item) => sanitizeForFirestore(item))
      .filter((item) => item !== undefined);
  }

  if (input && typeof input === 'object') {
    const entries = Object.entries(input as Record<string, unknown>)
      .map(([key, value]) => [key, sanitizeForFirestore(value)] as const)
      .filter(([, value]) => value !== undefined);
    return Object.fromEntries(entries);
  }

  return input;
};
