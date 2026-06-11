type ScrollLockOptions = {
  /**
   * Freeze the document at the current scroll offset. This avoids iOS Safari
   * moving the page behind full-screen dialogs while still restoring the
   * previous position when the final lock is released.
   */
  preserveScrollPosition?: boolean;
  /** Disable page-level touch panning while the lock is active. */
  disableTouchAction?: boolean;
};

type OriginalScrollStyles = {
  bodyOverflow: string;
  bodyOverscrollBehavior: string;
  bodyPosition: string;
  bodyTop: string;
  bodyWidth: string;
  bodyTouchAction: string;
  htmlOverflow: string;
  htmlOverscrollBehavior: string;
  scrollY: number;
};

const activeLocks = new Map<symbol, ScrollLockOptions>();
let originalStyles: OriginalScrollStyles | null = null;

const applyActiveScrollLock = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !originalStyles) return;

  const shouldPreserveScroll = Array.from(activeLocks.values()).some((options) => options.preserveScrollPosition);
  const shouldDisableTouchAction = Array.from(activeLocks.values()).some((options) => options.disableTouchAction);

  document.documentElement.style.overflow = 'hidden';
  document.documentElement.style.overscrollBehavior = 'none';
  document.body.style.overflow = 'hidden';
  document.body.style.overscrollBehavior = 'none';

  if (shouldPreserveScroll) {
    document.body.style.position = 'fixed';
    document.body.style.top = `-${originalStyles.scrollY}px`;
    document.body.style.width = '100%';
  } else {
    document.body.style.position = originalStyles.bodyPosition;
    document.body.style.top = originalStyles.bodyTop;
    document.body.style.width = originalStyles.bodyWidth;
  }

  document.body.style.touchAction = shouldDisableTouchAction ? 'none' : originalStyles.bodyTouchAction;
};

export const lockPageScroll = (options: ScrollLockOptions = {}) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => undefined;
  }

  const token = Symbol('page-scroll-lock');

  if (!originalStyles) {
    originalStyles = {
      bodyOverflow: document.body.style.overflow,
      bodyOverscrollBehavior: document.body.style.overscrollBehavior,
      bodyPosition: document.body.style.position,
      bodyTop: document.body.style.top,
      bodyWidth: document.body.style.width,
      bodyTouchAction: document.body.style.touchAction,
      htmlOverflow: document.documentElement.style.overflow,
      htmlOverscrollBehavior: document.documentElement.style.overscrollBehavior,
      scrollY: window.scrollY
    };
  }

  activeLocks.set(token, options);
  applyActiveScrollLock();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeLocks.delete(token);

    if (activeLocks.size > 0) {
      applyActiveScrollLock();
      return;
    }

    const stylesToRestore = originalStyles;
    originalStyles = null;
    if (!stylesToRestore) return;

    document.documentElement.style.overflow = stylesToRestore.htmlOverflow;
    document.documentElement.style.overscrollBehavior = stylesToRestore.htmlOverscrollBehavior;
    document.body.style.overflow = stylesToRestore.bodyOverflow;
    document.body.style.overscrollBehavior = stylesToRestore.bodyOverscrollBehavior;
    document.body.style.position = stylesToRestore.bodyPosition;
    document.body.style.top = stylesToRestore.bodyTop;
    document.body.style.width = stylesToRestore.bodyWidth;
    document.body.style.touchAction = stylesToRestore.bodyTouchAction;
    window.scrollTo(0, stylesToRestore.scrollY);
  };
};
