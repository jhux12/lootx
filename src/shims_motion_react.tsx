import React from 'react';

type AnyProps = Record<string, unknown>;
type MotionDefinition = {
  rotate?: number;
  scale?: number;
  opacity?: number;
  transition?: {
    duration?: number;
    ease?: string | number[];
  };
};

type MotionControls = {
  __isMotionControls: true;
  start: (definition?: MotionDefinition) => Promise<void>;
  set: (definition?: MotionDefinition) => Promise<void>;
  stop: () => void;
  subscribe: (listener: (definition: MotionDefinition) => void) => () => void;
};

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

const isMotionControls = (value: unknown): value is MotionControls =>
  Boolean(value) && typeof value === 'object' && (value as MotionControls).__isMotionControls === true;

const easingToCss = (ease?: string | number[]) => {
  if (!ease) return 'ease';
  if (Array.isArray(ease) && ease.length === 4) {
    return `cubic-bezier(${ease.join(',')})`;
  }
  return typeof ease === 'string' ? ease : 'ease';
};

const buildStyleFromDefinition = (definition?: MotionDefinition): React.CSSProperties => {
  if (!definition) return {};

  const transforms: string[] = [];
  if (typeof definition.rotate === 'number') {
    transforms.push(`rotate(${definition.rotate}deg)`);
  }
  if (typeof definition.scale === 'number') {
    transforms.push(`scale(${definition.scale})`);
  }

  const duration = definition.transition?.duration ?? 0;
  const ease = easingToCss(definition.transition?.ease);

  const transitionParts: string[] = [];
  if (typeof definition.rotate === 'number' || typeof definition.scale === 'number') {
    transitionParts.push(`transform ${duration}s ${ease}`);
  }
  if (typeof definition.opacity === 'number') {
    transitionParts.push(`opacity ${duration}s ${ease}`);
  }

  return {
    ...(transforms.length ? { transform: transforms.join(' ') } : {}),
    ...(typeof definition.opacity === 'number' ? { opacity: definition.opacity } : {}),
    ...(transitionParts.length ? { transition: transitionParts.join(', ') } : {})
  };
};

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
    const { animate, initial, style, ...rest } = props;
    const passthrough = stripMotionProps(rest);
    const [animatedStyle, setAnimatedStyle] = React.useState<React.CSSProperties>(() => buildStyleFromDefinition(initial as MotionDefinition));

    React.useEffect(() => {
      if (isMotionControls(animate)) {
        const unsubscribe = animate.subscribe((definition) => {
          setAnimatedStyle(buildStyleFromDefinition(definition));
        });
        return unsubscribe;
      }

      if (animate && typeof animate === 'object') {
        setAnimatedStyle(buildStyleFromDefinition(animate as MotionDefinition));
      }

      return undefined;
    }, [animate]);

    const mergedStyle = {
      ...(style as React.CSSProperties | undefined),
      ...animatedStyle
    };

    return React.createElement(tag, { ...passthrough, style: mergedStyle, ref });
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

export const useAnimation = (): MotionControls => {
  const listenersRef = React.useRef(new Set<(definition: MotionDefinition) => void>());

  return React.useMemo(
    () => ({
      __isMotionControls: true,
      subscribe: (listener) => {
        listenersRef.current.add(listener);
        return () => listenersRef.current.delete(listener);
      },
      start: async (definition) => {
        const payload = definition ?? {};
        listenersRef.current.forEach((listener) => listener(payload));
        const durationMs = Math.max(0, (payload.transition?.duration ?? 0) * 1000);
        if (!durationMs) return;
        await new Promise((resolve) => setTimeout(resolve, durationMs));
      },
      set: async (definition) => {
        listenersRef.current.forEach((listener) => listener(definition ?? {}));
      },
      stop: () => {
        // No-op for shimmed motion runtime.
      }
    }),
    []
  );
};

export const useAnimationControls = useAnimation;
