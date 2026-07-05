function AvatarPreview({ preview, size = "md" }) {
  const avatarIcon = preview?.avatar?.icon ?? "🐉";
  const frameIcon = preview?.frame?.icon;
  const backgroundIcon = preview?.background?.icon;
  const accessoryIcons = preview?.accessories?.map((item) => item.icon) ?? [];
  const effectIcon = preview?.effect?.icon;

  return (
    <div
      className={[
        "reward-avatar-preview",
        size === "sm" ? "reward-avatar-preview-sm" : "",
        size === "lg" ? "reward-avatar-preview-lg" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {backgroundIcon ? (
        <span aria-hidden="true" className="reward-avatar-preview-bg">
          {backgroundIcon}
        </span>
      ) : null}
      {frameIcon ? (
        <span aria-hidden="true" className="reward-avatar-preview-frame">
          {frameIcon}
        </span>
      ) : null}
      <span aria-hidden="true" className="reward-avatar-preview-main">
        {avatarIcon}
      </span>
      {accessoryIcons.map((icon, index) => (
        <span
          aria-hidden="true"
          className="reward-avatar-preview-accessory"
          key={`${icon}-${index}`}
        >
          {icon}
        </span>
      ))}
      {effectIcon ? (
        <span aria-hidden="true" className="reward-avatar-preview-effect">
          {effectIcon}
        </span>
      ) : null}
    </div>
  );
}

export default AvatarPreview;
