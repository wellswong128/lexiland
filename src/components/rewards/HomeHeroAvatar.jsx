import { Link } from "react-router-dom";
import AvatarPreview from "./AvatarPreview.jsx";
import { useLocale } from "../../features/locale/LocaleContext.jsx";
import { useRewardExtensions } from "../../features/rewards/useRewardExtensions.js";

function HomeHeroAvatar() {
  const { t } = useLocale();
  const { avatarPreview } = useRewardExtensions();

  return (
    <Link
      aria-label={t("rewards.center.preview.customize")}
      className="home-hero-avatar"
      title={t("rewards.center.preview.customize")}
      to="/rewards?tab=avatar"
    >
      <AvatarPreview preview={avatarPreview} size="sm" />
    </Link>
  );
}

export default HomeHeroAvatar;
