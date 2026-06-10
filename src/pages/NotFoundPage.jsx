import PageCard from "../components/PageCard.jsx";
import { useLocale } from "../features/locale/LocaleContext.jsx";

function NotFoundPage() {
  const { t } = useLocale();

  return (
    <PageCard
      description={t("notFound.description")}
      eyebrow={t("notFound.eyebrow")}
      title={t("notFound.title")}
    />
  );
}

export default NotFoundPage;
