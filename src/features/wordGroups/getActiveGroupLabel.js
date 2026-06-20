export function getActiveGroupLabel(group, locale = "zh-Hant") {
  if (!group) {
    return "";
  }

  if (locale === "en") {
    return group.displayNameEn || group.groupCode || "";
  }

  return group.displayNameZhHant || group.displayNameEn || group.groupCode || "";
}
