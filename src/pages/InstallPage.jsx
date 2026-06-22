import { Link } from "react-router-dom";
import LexiMascot from "../components/LexiMascot.jsx";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import PwaStatusPanel from "../components/PwaStatusPanel.jsx";
import { usePwaInstall } from "../hooks/usePwaInstall.js";
import { useStandaloneDisplay } from "../hooks/useStandaloneDisplay.js";
import { getAppHomeUrl } from "../lib/appUrl.js";
import "../styles/install-page.css";

function InstallPage() {
  const { t } = useLocale();
  const isStandalone = useStandaloneDisplay();
  const { canInstall, isInstalled, promptInstall } = usePwaInstall();
  const homeUrl = getAppHomeUrl();

  return (
    <section className="install-page">
      <div className="install-page-card">
        <div className="install-page-header">
          <LexiMascot size="md" title={t("brand.mascotAlt")} />
          <div>
            <p className="install-qr-eyebrow">{t("install.eyebrow")}</p>
            <h1 className="install-qr-title">{t("install.title")}</h1>
          </div>
        </div>

        <p className="install-qr-description">{t("install.description")}</p>

        <a
          className="install-page-link"
          href={homeUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          {homeUrl}
        </a>

        {isStandalone || isInstalled ? (
          <p className="install-page-notice install-page-notice-success">
            {t("install.alreadyInstalled")}
          </p>
        ) : (
          <div className="install-qr-steps">
            <div className="install-qr-step">
              <h3>{t("install.iosTitle")}</h3>
              <ol>
                <li>{t("install.iosStep1")}</li>
                <li>{t("install.iosStep2")}</li>
                <li>{t("install.iosStep3")}</li>
              </ol>
            </div>
            <div className="install-qr-step">
              <h3>{t("install.androidTitle")}</h3>
              <ol>
                <li>{t("install.androidStep1")}</li>
                <li>{t("install.androidStep2")}</li>
                <li>{t("install.androidStep3")}</li>
              </ol>
            </div>
          </div>
        )}

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

        <PwaStatusPanel showInstallActions={false} />

        <div className="install-test-checklist">
          <h2>{t("install.testChecklistTitle")}</h2>
          <p>{t("install.testChecklistDescription")}</p>
          <ul>
            <li>{t("install.testCheckIos")}</li>
            <li>{t("install.testCheckAndroid")}</li>
            <li>{t("install.testCheckOffline")}</li>
            <li>{t("install.testCheckUpdate")}</li>
          </ul>
        </div>

        <Link className="install-page-home-link" to="/">
          {t("install.openApp")}
        </Link>
      </div>
    </section>
  );
}

export default InstallPage;
