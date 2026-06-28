import { useState } from "react";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import { applyServiceWorkerUpdate } from "../lib/pwaRuntimeState.js";

function UpdateBanner({ isOnline, latestVersion, needsRefresh }) {
  const { t } = useLocale();
  const [isUpdating, setIsUpdating] = useState(false);

  if (!needsRefresh) {
    return null;
  }

  // Avoid flashing a generic message before the version label is loaded.
  if (isOnline && !latestVersion) {
    return null;
  }

  const updateMessage = latestVersion
    ? t("pwa.updateBannerMessageWithVersion", { version: latestVersion })
    : t("pwa.updateBannerMessage");

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

    window.setTimeout(() => {
      setIsUpdating(false);
    }, 5000);
  }

  return (
    <div className="update-banner" role="status">
      <p className="update-banner-text">{updateMessage}</p>
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
