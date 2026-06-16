import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import LexiMascot from "./LexiMascot.jsx";
import { useLocale } from "../features/locale/LocaleContext.jsx";

function InstallQrCard({
  compact = false,
  installUrl,
  showInstructions = true,
  showTitle = true,
}) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(installUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={["install-qr-card", compact ? "install-qr-card-compact" : ""].filter(Boolean).join(" ")}>
      {showTitle ? (
        <div className="install-qr-header">
          <LexiMascot size={compact ? "sm" : "md"} title={t("brand.mascotAlt")} />
          <div>
            <p className="install-qr-eyebrow">{t("install.eyebrow")}</p>
            <h2 className="install-qr-title">{t("install.title")}</h2>
          </div>
        </div>
      ) : null}

      <p className="install-qr-description">{t("install.description")}</p>

      <a
        className="install-qr-frame install-qr-frame-link"
        aria-label={t("install.openLink")}
        href={installUrl}
        rel="noopener noreferrer"
        target="_blank"
      >
        <QRCodeSVG
          bgColor="#ffffff"
          fgColor="#1f2a44"
          includeMargin
          level="M"
          size={compact ? 168 : 220}
          value={installUrl}
        />
      </a>

      <a className="install-qr-url" href={installUrl} rel="noopener noreferrer" target="_blank">
        {installUrl}
      </a>

      <button className="install-qr-copy" onClick={handleCopyLink} type="button">
        {copied ? t("install.linkCopied") : t("install.copyLink")}
      </button>

      {showInstructions ? (
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
      ) : null}
    </div>
  );
}

export default InstallQrCard;
