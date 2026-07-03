export const ROLES = Object.freeze({
  OWNER: "owner",
  ADMIN: "admin",
  TEACHER: "teacher",
  STUDENT: "student",
  PARENT: "parent",
  GUEST: "guest",
});

export const PERMISSIONS = Object.freeze({
  WORDS_READ: "words.read",
  WORDS_CREATE: "words.create",
  WORDS_UPDATE: "words.update",
  WORDS_DELETE: "words.delete",
  REVIEW_SUBMIT: "review.submit",
  GAMES_PLAY: "games.play",
  MISTAKES_MANAGE: "mistakes.manage",
  MEMORY_REGEN: "memory.regen",
  WORDBASE_SYNC: "wordbase.sync",
  SETTINGS_UPDATE_SELF: "settings.update_self",
  SETTINGS_MANAGE_USERS: "settings.manage_users",
  SYSTEM_MANAGE_INTEGRATIONS: "system.manage_integrations",
  ANALYTICS_READ: "analytics.read",
});

const LOCAL_LEARNER_PERMISSIONS = [
  PERMISSIONS.WORDS_READ,
  PERMISSIONS.WORDS_CREATE,
  PERMISSIONS.WORDS_UPDATE,
  PERMISSIONS.WORDS_DELETE,
  PERMISSIONS.REVIEW_SUBMIT,
  PERMISSIONS.GAMES_PLAY,
  PERMISSIONS.MISTAKES_MANAGE,
  PERMISSIONS.MEMORY_REGEN,
  PERMISSIONS.SETTINGS_UPDATE_SELF,
  PERMISSIONS.ANALYTICS_READ,
];

const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.GUEST]: LOCAL_LEARNER_PERMISSIONS,
  [ROLES.PARENT]: [PERMISSIONS.ANALYTICS_READ],
  [ROLES.STUDENT]: LOCAL_LEARNER_PERMISSIONS,
  [ROLES.TEACHER]: [
    PERMISSIONS.WORDS_READ,
    PERMISSIONS.WORDS_CREATE,
    PERMISSIONS.WORDS_UPDATE,
    PERMISSIONS.WORDS_DELETE,
    PERMISSIONS.REVIEW_SUBMIT,
    PERMISSIONS.GAMES_PLAY,
    PERMISSIONS.MISTAKES_MANAGE,
    PERMISSIONS.MEMORY_REGEN,
    PERMISSIONS.WORDBASE_SYNC,
    PERMISSIONS.SETTINGS_UPDATE_SELF,
    PERMISSIONS.ANALYTICS_READ,
  ],
  [ROLES.ADMIN]: Object.values(PERMISSIONS).filter(
    (permission) => permission !== PERMISSIONS.SYSTEM_MANAGE_INTEGRATIONS,
  ),
  [ROLES.OWNER]: Object.values(PERMISSIONS),
});

const ROUTE_RULES = [
  { pattern: "/", anyOf: [] },
  { pattern: "/install", anyOf: [] },
  { pattern: "/auth", anyOf: [] },
  { pattern: "/achievements", anyOf: [PERMISSIONS.ANALYTICS_READ] },
  { pattern: "/learning-report", anyOf: [PERMISSIONS.ANALYTICS_READ] },
  { pattern: "/admin/users", anyOf: [PERMISSIONS.SETTINGS_MANAGE_USERS] },
  { pattern: "/admin/wordbase", anyOf: [PERMISSIONS.SETTINGS_MANAGE_USERS] },
  { pattern: "/admin/wordbase-library", anyOf: [PERMISSIONS.SETTINGS_MANAGE_USERS] },
  { pattern: "/words", anyOf: [PERMISSIONS.WORDS_READ] },
  { pattern: "/words/new", anyOf: [PERMISSIONS.WORDS_CREATE] },
  { pattern: "/words/lookup", anyOf: [] },
  { pattern: "/words/:wordId", anyOf: [PERMISSIONS.WORDS_READ] },
  { pattern: "/review/flashcards", anyOf: [PERMISSIONS.REVIEW_SUBMIT] },
  { pattern: "/review/quiz", anyOf: [PERMISSIONS.REVIEW_SUBMIT] },
  { pattern: "/mistakes", anyOf: [PERMISSIONS.MISTAKES_MANAGE] },
  { pattern: "/games/spelling-ninja", anyOf: [PERMISSIONS.GAMES_PLAY] },
  { pattern: "/games/fishing-blast", anyOf: [PERMISSIONS.GAMES_PLAY] },
  { pattern: "/games/deep-sea-fishing", anyOf: [PERMISSIONS.GAMES_PLAY] },
  { pattern: "/games/word-kart", anyOf: [PERMISSIONS.GAMES_PLAY] },
  { pattern: "/games/grammar-arena", anyOf: [PERMISSIONS.GAMES_PLAY] },
  { pattern: "/games/battle-jet", anyOf: [PERMISSIONS.GAMES_PLAY] },
  { pattern: "/games/penalty-twelve", anyOf: [PERMISSIONS.GAMES_PLAY] },
  { pattern: "/games/speed-racing", anyOf: [PERMISSIONS.GAMES_PLAY] },
  { pattern: "/settings", anyOf: [PERMISSIONS.SETTINGS_UPDATE_SELF] },
];

function normalizePath(pathname = "/") {
  return pathname.split("?")[0].replace(/\/+$/, "") || "/";
}

function normalizeRole(role) {
  if (!role || typeof role !== "string") {
    return ROLES.GUEST;
  }

  const lower = role.toLowerCase();
  return Object.values(ROLES).includes(lower) ? lower : ROLES.GUEST;
}

export function getRoleFromUser(user) {
  if (!user) {
    return ROLES.GUEST;
  }

  const candidateRole =
    user?.app_metadata?.role ??
    user?.user_metadata?.role ??
    user?.role ??
    ROLES.STUDENT;

  return normalizeRole(candidateRole);
}

function patternToRegex(pattern) {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const withParams = escaped.replace(/:[^/]+/g, "[^/]+");
  return new RegExp(`^${withParams}$`);
}

function getRuleForPath(pathname) {
  const normalized = normalizePath(pathname);
  return ROUTE_RULES.find((rule) => patternToRegex(rule.pattern).test(normalized));
}

export function getPermissionsForRole(role) {
  const safeRole = normalizeRole(role);
  return ROLE_PERMISSIONS[safeRole] ?? [];
}

export function can(role, permission) {
  return getPermissionsForRole(role).includes(permission);
}

export function canAny(role, permissions = []) {
  return permissions.some((permission) => can(role, permission));
}

export function canAll(role, permissions = []) {
  return permissions.every((permission) => can(role, permission));
}

export function getRequiredPermissionsForRoute(pathname) {
  const rule = getRuleForPath(pathname);
  return rule?.anyOf ?? [];
}

export function canRoute(role, pathname) {
  const required = getRequiredPermissionsForRoute(pathname);
  if (required.length === 0) {
    return true;
  }
  return canAny(role, required);
}
