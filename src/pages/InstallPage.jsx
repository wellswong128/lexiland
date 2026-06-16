import { Link } from "react-router-dom";
import InstallQrCard from "../components/InstallQrCard.jsx";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import { usePwaInstall } from "../hooks/usePwaInstall.js";
import { useStandaloneDisplay } from "../hooks/useStandaloneDisplay.js";
import { getAppInstallUrl } from "../lib/appUrl.js";
import "../styles/install-page.css";

function InstallPage() {
  const { t } = useLocale();
  const isStandalone = useStandaloneDisplay();
  const { canInstall, isInstalled, promptInstall } = usePwaInstall();
  const installUrl = getAppInstallUrl();

  return (
    <section className="install-page">
      <div className="install-page-card">
        <InstallQrCard installUrl={installUrl} />

        {isStandalone || isInstalled ? (
          <p className="install-page-notice install-page-notice-success">
            {t("install.alreadyInstalled")}
          </p>
        ) : null}

        {canInstall ? (
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

        {!isStandalone && !canInstall ? (
          <p className="install-page-notice">{t("install.scanHint")}</p>
        ) : null}

        <Link className="install-page-home-link" to="/">
          {t("install.openApp")}
        </Link>
      </div>
    </section>
  );
}

export default InstallPage;
