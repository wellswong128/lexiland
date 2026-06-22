import { usePwaRuntimeStatus } from "../hooks/usePwaRuntimeStatus.js";
import { useLocale } from "../features/locale/LocaleContext.jsx";

function OfflineBanner() {
  const { isOnline, offlineReady } = usePwaRuntimeStatus();
  const { t } = useLocale();

  if (isOnline) {
    return null;
  }

  return (
    <div className="offline-banner" role="status">
      <p>
        {offlineReady ? t("pwa.offlineBannerReady") : t("pwa.offlineBannerLimited")}
      </p>
    </div>
  );
}

export default OfflineBanner;
