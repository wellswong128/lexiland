export const APP_INSTALL_URL = "https://learn.lexiland.cc/install";

export function getAppBaseUrl() {
  return APP_INSTALL_URL.replace(/\/install$/, "");
}

export function getAppInstallUrl() {
  return APP_INSTALL_URL;
}
