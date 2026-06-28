import { useLocale } from "../features/locale/LocaleContext.jsx";

function OfflineBanner({ isOnline, offlineReady }) {
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
