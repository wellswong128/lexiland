import { useEffect, useState } from "react";
import { subscribeToRewardToasts } from "../../features/rewards/rewardToasts.js";

function RewardToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return subscribeToRewardToasts((toast) => {
      setToasts((current) => [...current, toast]);

      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id));
      }, 3200);
    });
  }, []);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div aria-live="polite" className="reward-toast-stack">
      {toasts.map((toast) => (
        <div className={`reward-toast reward-toast-${toast.type}`} key={toast.id} role="status">
          {toast.message}
        </div>
      ))}
    </div>
  );
}

export default RewardToastHost;
