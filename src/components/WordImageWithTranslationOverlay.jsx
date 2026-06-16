function WordImageWithTranslationOverlay({
  alt,
  className = "relative overflow-hidden",
  imageClassName = "aspect-square w-full object-cover",
  loading = "lazy",
  src,
  translation,
}) {
  const label = String(translation ?? "").trim();

  return (
    <div className={className}>
      <img alt={alt} className={imageClassName} loading={loading} src={src} />
      {label ? (
        <span className="flashcard-image-translation-overlay review-word-translation">
          {label}
        </span>
      ) : null}
    </div>
  );
}

export default WordImageWithTranslationOverlay;
