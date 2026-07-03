import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { applyApiCors } from "./server/api/_cors.js";
import { routeRequest } from "./server/api/router.js";

function readPackageVersion() {
  try {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    return pkg.version && pkg.version !== "0.0.0" ? pkg.version : "1.0.0";
  } catch {
    return "1.0.0";
  }
}

function resolveBuildId(env = process.env) {
  const fromEnv = env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);

  if (fromEnv) {
    return fromEnv;
  }

  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "dev";
  }
}

function resolveAppVersionMetadata(env = process.env) {
  const semver = readPackageVersion();
  const build = resolveBuildId(env);
  const builtAt = new Date().toISOString();

  return {
    semver,
    build,
    builtAt,
  };
}

function appVersionPlugin(versionMetadata) {
  return {
    name: "lexiland-app-version",
    configureServer(server) {
      server.middlewares.use("/version.json", (_request, response) => {
        response.setHeader("Content-Type", "application/json");
        response.setHeader("Cache-Control", "no-cache");
        response.end(JSON.stringify(versionMetadata));
      });
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: `${JSON.stringify(versionMetadata, null, 2)}\n`,
      });
    },
  };
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
    });

    request.on("end", () => {
      resolve(body);
    });

    request.on("error", reject);
  });
}

function localApiPlugin() {
  return {
    name: "lexiland-local-api",
    configureServer(server) {
      server.middlewares.use("/api", async (request, response, next) => {
        const url = new URL(request.url, "http://localhost");
        const path = url.pathname.replace(/^\/api\/?/, "");

        if (!path) {
          next();
          return;
        }

        try {
          if (applyApiCors(request, response)) {
            return;
          }

          request.body = await readRequestBody(request);
          const query = { ...(request.query || {}) };
          for (const [key, value] of url.searchParams.entries()) {
            query[key] = value;
          }
          query.path = path.split("/");
          request.query = query;
          await routeRequest(path, request, response);
        } catch (error) {
          response.statusCode = 500;
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify({ error: error.message }));
        }
      });
    },
  };
}

function applyLocalApiEnv(env) {
  const assignIfMissing = (key, ...sources) => {
    if (String(process.env[key] || "").trim()) {
      return;
    }

    for (const sourceKey of sources) {
      const value = String(env[sourceKey] || "").trim();
      if (value) {
        process.env[key] = value;
        return;
      }
    }
  };

  assignIfMissing("IMPORT_API_KEY", "IMPORT_API_KEY");
  assignIfMissing("AGNES_API_KEY", "AGNES_API_KEY");
  assignIfMissing("AGNES_MODEL", "AGNES_MODEL");
  assignIfMissing("AGNES_IMAGE_MODEL", "AGNES_IMAGE_MODEL");
  assignIfMissing("AGNES_IMAGE_SIZE", "AGNES_IMAGE_SIZE");
  assignIfMissing("AGNES_IMAGE_MAX_ATTEMPTS", "AGNES_IMAGE_MAX_ATTEMPTS");
  assignIfMissing("AGNES_IMAGE_MAX_TEXT_CHECKS", "AGNES_IMAGE_MAX_TEXT_CHECKS");
  assignIfMissing("AGNES_IMAGE_TIMEOUT_MS", "AGNES_IMAGE_TIMEOUT_MS");
  assignIfMissing("SUPABASE_URL", "SUPABASE_URL", "VITE_SUPABASE_URL");
  assignIfMissing("SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY");
  assignIfMissing("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY");
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  applyLocalApiEnv(env);
  const appVersion = resolveAppVersionMetadata(env);

  return {
    define: {
      __APP_VERSION__: JSON.stringify(appVersion.build),
      __APP_SEMVER__: JSON.stringify(appVersion.semver),
      __APP_BUILT_AT__: JSON.stringify(appVersion.builtAt),
    },
    plugins: [
      react(),
      tailwindcss(),
      localApiPlugin(),
      appVersionPlugin(appVersion),
      VitePWA({
        registerType: "prompt",
        includeAssets: [
          "apple-touch-icon.png",
          "pwa-192.png",
          "pwa-512.png",
          "lexi-mascot.svg",
        ],
        manifest: false,
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2,webmanifest}"],
          globIgnores: ["**/version.json"],
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/api\//, /^\/version\.json$/],
          runtimeCaching: [
            {
              urlPattern: /\/version\.json(?:\?.*)?$/,
              handler: "NetworkOnly",
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "lexiland-google-fonts-stylesheets",
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "lexiland-google-fonts-webfonts",
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    build: {
      rolldownOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) {
              if (id.includes("/src/i18n/translations.js")) {
                return "i18n";
              }
              return;
            }

            if (id.includes("react-dom") || id.includes("/react/")) {
              return "vendor-react";
            }

            if (id.includes("react-router")) {
              return "vendor-router";
            }

            if (id.includes("@supabase")) {
              return "vendor-supabase";
            }

            if (id.includes("qrcode")) {
              return "vendor-qrcode";
            }
          },
        },
      },
    },
  };
});
