import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import completeWordHandler from "./api/complete-word.js";
import extractWordsHandler from "./api/extract-words-from-image.js";
import wordMemoryTipsHandler from "./api/word-memory-tips.js";
import wordMemoryImageHandler from "./api/word-memory-image.js";

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

      server.middlewares.use("/api/extract-words-from-image", async (request, response) => {
        try {
          request.body = await readRequestBody(request);
          await extractWordsHandler(request, response);
        } catch (error) {
          response.statusCode = 500;
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify({ error: error.message }));
        }
      });

      server.middlewares.use("/api/word-memory-tips", async (request, response) => {
        try {
          request.body = await readRequestBody(request);
          await wordMemoryTipsHandler(request, response);
        } catch (error) {
          response.statusCode = 500;
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify({ error: error.message }));
        }
      });

      server.middlewares.use("/api/word-memory-image", async (request, response) => {
        try {
          request.body = await readRequestBody(request);
          await wordMemoryImageHandler(request, response);
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
  process.env.AGNES_IMAGE_MODEL ||= env.AGNES_IMAGE_MODEL;
  process.env.AGNES_IMAGE_SIZE ||= env.AGNES_IMAGE_SIZE;

  return {
    plugins: [react(), tailwindcss(), localApiPlugin()],
  };
});
