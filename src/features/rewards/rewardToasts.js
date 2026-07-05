const toastListeners = new Set();
const updateListeners = new Set();

export function subscribeToRewardToasts(listener) {
  toastListeners.add(listener);

  return () => {
    toastListeners.delete(listener);
  };
}

export function subscribeToRewardUpdates(listener) {
  updateListeners.add(listener);

  return () => {
    updateListeners.delete(listener);
  };
}

export function notifyRewardUpdate() {
  updateListeners.forEach((listener) => {
    listener();
  });
}

export function showRewardToast(message, type = "coin") {
  const toast = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message,
    type,
  };

  toastListeners.forEach((listener) => {
    listener(toast);
  });

  return toast;
}
