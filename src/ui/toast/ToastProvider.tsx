import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { bindToastController } from './toast';
import { ToastRecord, ToastVariant } from './types';
import './styles.css';

const DEFAULT_DURATION_MS = 3500;

type ToastContextValue = {
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue>({ dismiss: () => undefined });

const variantStyles: Record<ToastVariant, string> = {
  success: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100',
  error: 'border-rose-400/40 bg-rose-500/10 text-rose-100',
  info: 'border-cyan-400/40 bg-cyan-500/10 text-cyan-100'
};

const variantIcon: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-emerald-300" />,
  error: <XCircle className="h-4 w-4 text-rose-300" />,
  info: <Info className="h-4 w-4 text-cyan-300" />
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timers = useRef<Record<string, number>>({});

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    if (timers.current[id]) {
      window.clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const schedule = useCallback((id: string, durationMs = DEFAULT_DURATION_MS) => {
    if (timers.current[id]) window.clearTimeout(timers.current[id]);
    timers.current[id] = window.setTimeout(() => dismiss(id), durationMs);
  }, [dismiss]);

  const push = useCallback((variant: ToastVariant, message: string, durationMs = DEFAULT_DURATION_MS) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, variant, message, durationMs, createdAt: Date.now() }]);
    schedule(id, durationMs);
  }, [schedule]);

  useEffect(() => {
    bindToastController({
      success: (message, durationMs) => push('success', message, durationMs),
      error: (message, durationMs) => push('error', message, durationMs),
      info: (message, durationMs) => push('info', message, durationMs)
    });
  }, [push]);

  useEffect(() => {
    const originalAlert = window.alert.bind(window);
    const inferVariant = (message: string): ToastVariant => {
      const normalized = message.toLowerCase();
      if (/(success|updated|created|saved|copied|claimed|published|following|sent)/.test(normalized)) {
        return 'success';
      }
      if (/(error|unable|fail|invalid|expired|cannot|can not|could not|required|must|please)/.test(normalized)) {
        return 'error';
      }
      return 'info';
    };

    window.alert = (message?: string) => {
      const nextMessage = typeof message === 'string' && message.trim() ? message : 'Notice';
      push(inferVariant(nextMessage), nextMessage);
    };

    return () => {
      window.alert = originalAlert;
    };
  }, [push]);

  useEffect(() => () => {
    Object.values(timers.current).forEach((timer) => window.clearTimeout(timer));
  }, []);

  const value = useMemo(() => ({ dismiss }), [dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pullz-toast-stack" role="region" aria-live="polite" aria-label="Notifications">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} onResume={schedule} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const ToastItem: React.FC<{ toast: ToastRecord; onDismiss: (id: string) => void; onResume: (id: string, durationMs?: number) => void; }> = ({ toast, onDismiss, onResume }) => {
  const { dismiss } = useContext(ToastContext);
  const startX = useRef<number | null>(null);

  return (
    <div
      className={`pullz-toast-enter touch-pan-y rounded-xl border backdrop-blur-md shadow-[0_10px_24px_rgba(0,0,0,0.45)] ${variantStyles[toast.variant]}`}
      style={{ ['--pullz-toast-duration' as string]: `${toast.durationMs ?? DEFAULT_DURATION_MS}ms` }}
      onMouseEnter={() => onResume(toast.id, 999999)}
      onMouseLeave={() => onResume(toast.id, 1200)}
      onTouchStart={(event) => {
        startX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchMove={(event) => {
        if (startX.current == null) return;
        const delta = Math.abs((event.touches[0]?.clientX ?? startX.current) - startX.current);
        if (delta > 90) {
          onDismiss(toast.id);
          startX.current = null;
        }
      }}
    >
      <div className="flex items-start gap-2 px-3 py-2.5">
        <span className="mt-0.5">{variantIcon[toast.variant]}</span>
        <p className="flex-1 text-sm font-medium leading-snug">{toast.message}</p>
        <button type="button" onClick={() => dismiss(toast.id)} className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Dismiss notification">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="pullz-toast-progress" aria-hidden="true" />
    </div>
  );
};
