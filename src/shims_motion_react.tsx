import React from 'react';

type AnyProps = Record<string, unknown>;

const MOTION_PROP_KEYS = new Set([
  'animate',
  'initial',
  'exit',
  'whileHover',
  'whileTap',
  'transition',
  'layout',
  'layoutId',
  'variants',
  'drag',
  'dragConstraints',
  'dragElastic',
  'onAnimationStart',
  'onAnimationComplete'
]);

function stripMotionProps<T extends AnyProps>(props: T): AnyProps {
  const next: AnyProps = {};
  Object.entries(props).forEach(([key, value]) => {
    if (!MOTION_PROP_KEYS.has(key)) {
      next[key] = value;
    }
  });
  return next;
}

function createMotionTag(tag: keyof JSX.IntrinsicElements) {
  return React.forwardRef<HTMLElement, AnyProps>((props, ref) => {
    const passthrough = stripMotionProps(props);
    return React.createElement(tag, { ...passthrough, ref });
  });
}

export const motion = new Proxy(
  {},
  {
    get(_target, prop) {
      return createMotionTag(prop as keyof JSX.IntrinsicElements);
    }
  }
) as Record<string, React.ForwardRefExoticComponent<any>>;

export const AnimatePresence: React.FC<React.PropsWithChildren> = ({ children }) => <>{children}</>;

export const useAnimation = () => ({
  start: async (_definition?: unknown) => Promise.resolve()
});
