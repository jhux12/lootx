export type ToastVariant = 'success' | 'error' | 'info';

export type ToastInput = {
  message: string;
  durationMs?: number;
};

export type ToastRecord = ToastInput & {
  id: string;
  variant: ToastVariant;
  createdAt: number;
};

export type ToastController = {
  success: (message: string, durationMs?: number) => void;
  error: (message: string, durationMs?: number) => void;
  info: (message: string, durationMs?: number) => void;
};
