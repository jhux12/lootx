import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  isIosSafari,
  isStandaloneMode,
  markDismissedPermanently,
  markShownThisSession,
  supportsInstallPromptEvent,
  wasDismissedPermanently,
  wasShownThisSession
} from './installability';

type PromptVariant = 'chromium' | 'ios' | null;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type InstallPromptState = {
  isVisible: boolean;
  variant: PromptVariant;
  canTriggerNativePrompt: boolean;
  promptInstall: () => Promise<void>;
  dismiss: (permanent?: boolean) => void;
};

/**
 * Centralized install prompt logic:
 * - iOS Safari: show instruction sheet (no native install prompt API).
 * - Chromium: capture and defer beforeinstallprompt to custom UI.
 */
export const useInstallPrompt = (): InstallPromptState => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [variant, setVariant] = useState<PromptVariant>(null);
  const [isVisible, setIsVisible] = useState(false);

  const dismiss = useCallback((permanent = true) => {
    if (permanent) {
      markDismissedPermanently();
    }
    markShownThisSession();
    setDeferredPrompt(null);
    setIsVisible(false);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (isStandaloneMode() || wasDismissedPermanently() || wasShownThisSession()) {
      return;
    }

    if (isIosSafari()) {
      setVariant('ios');
      setIsVisible(true);
      markShownThisSession();
      return;
    }

    if (!supportsInstallPromptEvent()) {
      return;
    }

    const onBeforeInstallPrompt = (event: Event) => {
      if (wasDismissedPermanently() || wasShownThisSession() || isStandaloneMode()) return;

      const promptEvent = event as BeforeInstallPromptEvent;
      promptEvent.preventDefault();
      setDeferredPrompt(promptEvent);
      setVariant('chromium');
      setIsVisible(true);
      markShownThisSession();
    };

    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setIsVisible(false);
      setVariant(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } finally {
      setDeferredPrompt(null);
      setIsVisible(false);
      setVariant(null);
      markShownThisSession();
    }
  }, [deferredPrompt]);

  return useMemo(() => ({
    isVisible,
    variant,
    canTriggerNativePrompt: Boolean(deferredPrompt) && variant === 'chromium',
    promptInstall,
    dismiss
  }), [deferredPrompt, dismiss, isVisible, promptInstall, variant]);
};
