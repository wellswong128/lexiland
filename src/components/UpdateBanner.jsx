import { useState } from "react";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import { usePwaRuntimeStatus } from "../hooks/usePwaRuntimeStatus.js";
import { applyServiceWorkerUpdate } from "../lib/pwaRuntimeState.js";

function UpdateBanner() {
  const { t } = useLocale();
  const { needsRefresh } = usePwaRuntimeStatus();
  const [isUpdating, setIsUpdating] = useState(false);

  if (!needsRefresh) {
    return null;
  }

  async function handleUpdate() {
    if (isUpdating) {
      return;
    }

    setIsUpdating(true);

    try {
      await applyServiceWorkerUpdate();
    } catch {
      setIsUpdating(false);
    }
  }

  return (
    <div className="update-banner" role="status">
      <p className="update-banner-text">{t("pwa.updateBannerMessage")}</p>
      <button
        className="update-banner-button"
        disabled={isUpdating}
        onClick={() => {
          void handleUpdate();
        }}
        type="button"
      >
        {isUpdating ? t("pwa.updateButtonLoading") : t("pwa.updateButton")}
      </button>
    </div>
  );
}

export default UpdateBanner;
