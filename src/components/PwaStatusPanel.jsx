import { Link } from "react-router-dom";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import { usePwaInstall } from "../hooks/usePwaInstall.js";
import { usePwaRuntimeStatus } from "../hooks/usePwaRuntimeStatus.js";

function StatusRow({ label, value, tone = "default" }) {
  return (
    <div className={`pwa-status-row pwa-status-row-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PwaStatusPanel({ showInstallActions = true }) {
  const { t } = useLocale();
  const { canInstall, isInstalled, promptInstall } = usePwaInstall();
  const {
    currentVersion,
    isOnline,
    offlineReady,
    platform,
    serviceWorkerState,
    serviceWorkerSupported,
  } = usePwaRuntimeStatus();

  const platformLabel = t(`pwa.platform.${platform}`);
  const serviceWorkerLabel = serviceWorkerSupported
    ? t(`pwa.serviceWorker.${serviceWorkerState}`)
    : t("pwa.serviceWorker.unsupported");

  return (
    <section aria-labelledby="pwa-status-title" className="pwa-status-panel">
      <h2 className="pwa-status-title" id="pwa-status-title">
        {t("pwa.statusTitle")}
      </h2>
      <p className="pwa-status-description">{t("pwa.statusDescription")}</p>

      <div className="pwa-status-grid">
        <StatusRow label={t("pwa.statusPlatform")} value={platformLabel} />
        <StatusRow
          label={t("pwa.statusInstalled")}
          tone={isInstalled ? "success" : "default"}
          value={isInstalled ? t("pwa.yes") : t("pwa.no")}
        />
        <StatusRow
          label={t("pwa.statusOnline")}
          tone={isOnline ? "success" : "warning"}
          value={isOnline ? t("pwa.yes") : t("pwa.no")}
        />
        <StatusRow
          label={t("pwa.statusServiceWorker")}
          tone={
            serviceWorkerState === "active" || serviceWorkerState === "native"
              ? "success"
              : serviceWorkerState === "unsupported" || serviceWorkerState === "error"
                ? "warning"
                : "default"
          }
          value={
            serviceWorkerSupported ? serviceWorkerLabel : t("pwa.serviceWorker.unsupported")
          }
        />
        <StatusRow
          label={t("pwa.statusOfflineReady")}
          tone={offlineReady ? "success" : "default"}
          value={offlineReady ? t("pwa.yes") : t("pwa.no")}
        />
        {currentVersion && !currentVersion.startsWith("dev") ? (
          <StatusRow label={t("pwa.statusCurrentVersion")} value={currentVersion} />
        ) : null}
      </div>

      {!isOnline ? (
        <p className="pwa-status-note pwa-status-note-warning">{t("pwa.offlineNote")}</p>
      ) : null}

      {showInstallActions && canInstall ? (
        <button
          className="install-page-button"
          onClick={() => {
            void promptInstall();
          }}
          type="button"
        >
          {t("install.installButton")}
        </button>
      ) : null}

      {showInstallActions && !isInstalled ? (
        <Link className="install-page-home-link" to="/install">
          {t("pwa.openInstallGuide")}
        </Link>
      ) : null}
    </section>
  );
}

export default PwaStatusPanel;
