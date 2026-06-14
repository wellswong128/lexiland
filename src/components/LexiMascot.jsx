const sizeMap = {
  sm: 36,
  md: 72,
  lg: 108,
  xl: 118,
};

const MASCOT_SRC = "/lexi-dragon-mascot.png?v=3";

function LexiMascot({ className = "", size = "md", title }) {
  const width = sizeMap[size] ?? sizeMap.md;

  return (
    <img
      alt={title ?? ""}
      aria-hidden={title ? undefined : true}
      className={["lexi-mascot", className].filter(Boolean).join(" ")}
      draggable={false}
      src={MASCOT_SRC}
      width={width}
    />
  );
}

export default LexiMascot;
