import { Link } from "react-router-dom";
import { useLocale } from "../features/locale/LocaleContext.jsx";

function HomeIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6 9.5V20h12V9.5" />
      <path d="M10 20v-6h4v6" />
    </svg>
  );
}

function GameHomeButton({ className = "", variant = "dark", fixed = false }) {
  const { t } = useLocale();

  const variantClass =
    variant === "light"
      ? "border-blue-200 bg-white/95 text-blue-700 shadow-sm hover:bg-blue-50"
      : "border-white/25 bg-slate-950/55 text-slate-100 shadow-sm hover:bg-slate-900/75";

  return (
    <Link
      aria-label={t("common.home")}
      className={[
        fixed ? "game-home-btn-fixed" : "relative z-50",
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full border backdrop-blur transition",
        variantClass,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      to="/"
    >
      <HomeIcon />
    </Link>
  );
}

export default GameHomeButton;
