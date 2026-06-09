import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import completeWordHandler from "./api/complete-word.js";

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
    name: "lexiloop-local-api",
    configureServer(server) {
      server.middlewares.use("/api/complete-word", async (request, response) => {
        try {
          request.body = await readRequestBody(request);
          await completeWordHandler(request, response);
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

  process.env.AGNES_API_KEY ||= env.AGNES_API_KEY;
  process.env.AGNES_MODEL ||= env.AGNES_MODEL;

  return {
    plugins: [react(), tailwindcss(), localApiPlugin()],
  };
});
