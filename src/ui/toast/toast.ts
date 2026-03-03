import { ToastController } from './types';

const noop = () => undefined;

let controller: ToastController = {
  success: noop,
  error: noop,
  info: noop
};

export const bindToastController = (nextController: ToastController) => {
  controller = nextController;
};

export const toast: ToastController = {
  success: (message, durationMs) => controller.success(message, durationMs),
  error: (message, durationMs) => controller.error(message, durationMs),
  info: (message, durationMs) => controller.info(message, durationMs)
};
