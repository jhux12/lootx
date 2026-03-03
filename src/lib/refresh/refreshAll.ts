export type RefreshAllOptions = {
  syncBalance?: () => void;
  allowHardReload?: boolean;
};

export async function refreshAll(options: RefreshAllOptions = {}): Promise<void> {
  const { syncBalance, allowHardReload = true } = options;

  if (syncBalance) {
    try {
      syncBalance();
    } catch (error) {
      console.warn('refreshAll: failed to sync balance', error);
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pullz:refresh-all'));
  }

  if (allowHardReload && typeof window !== 'undefined') {
    window.location.reload();
  }
}
