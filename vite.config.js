import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { applyApiCors } from "./server/api/_cors.js";
import { routeRequest } from "./server/api/router.js";

function resolveAppVersion(env = process.env) {
  const fromEnv = env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);

  if (fromEnv) {
    return fromEnv;
  }

  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    try {
      const pkg = JSON.parse(readFileSync("package.json", "utf8"));
      return pkg.version && pkg.version !== "0.0.0" ? pkg.version : "dev";
    } catch {
      return "dev";
    }
  }
}

function appVersionPlugin(appVersion) {
  return {
    name: "lexiland-app-version",
    configureServer(server) {
      server.middlewares.use("/version.json", (_request, response) => {
        response.setHeader("Content-Type", "application/json");
        response.setHeader("Cache-Control", "no-cache");
        response.end(JSON.stringify({ version: appVersion }));
      });
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: `${JSON.stringify({ version: appVersion }, null, 2)}\n`,
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
          request.query = { ...(request.query || {}), path: path.split("/") };
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const appVersion = resolveAppVersion(env);

  process.env.AGNES_API_KEY ||= env.AGNES_API_KEY;
  process.env.AGNES_MODEL ||= env.AGNES_MODEL;
  process.env.AGNES_IMAGE_MODEL ||= env.AGNES_IMAGE_MODEL;
  process.env.AGNES_IMAGE_SIZE ||= env.AGNES_IMAGE_SIZE;

  return {
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    plugins: [
      react(),
      tailwindcss(),
      localApiPlugin(),
      appVersionPlugin(appVersion),
      VitePWA({
        registerType: "autoUpdate",
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
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
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
