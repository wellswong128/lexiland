#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { execSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const envLocalPath = resolve(repoRoot, ".env.local");

function parseEnvFile(path) {
  if (!existsSync(path)) {
    return { lines: [], values: new Map() };
  }

  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  const values = new Map();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  }

  return { lines, values };
}

function upsertEnvValue(path, key, value) {
  const { lines, values } = parseEnvFile(path);
  values.set(key, value);

  const nextLines = [];
  let replaced = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(`${key}=`)) {
      nextLines.push(`${key}=${value}`);
      replaced = true;
      continue;
    }
    nextLines.push(line);
  }

  if (!replaced) {
    if (nextLines.length && nextLines[nextLines.length - 1].trim() !== "") {
      nextLines.push("");
    }
    nextLines.push(`${key}=${value}`);
  }

  writeFileSync(path, `${nextLines.join("\n").replace(/\n*$/, "\n")}`, "utf8");
}

function generateImportApiKey() {
  return randomBytes(32).toString("hex");
}

function hasVercelCli() {
  return spawnSync("vercel", ["--version"], { stdio: "ignore" }).status === 0;
}

function tryVercelWhoami() {
  try {
    return execSync("vercel whoami", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function printVercelSteps() {
  console.log("\nAdd the same key to Vercel:");
  console.log("  1. Open https://vercel.com/dashboard");
  console.log("  2. Select the LexiLand project (learn.lexiland.cc)");
  console.log("  3. Settings → Environment Variables");
  console.log("  4. Add:");
  console.log("       Name: IMPORT_API_KEY");
  console.log("       Value: copy from .env.local (same key as local)");
  console.log("       Environments: Production, Preview, Development");
  console.log("  5. Redeploy the latest production deployment");
  console.log("\nCLI alternative (after `vercel login`):");
  console.log("  vercel env add IMPORT_API_KEY production");
  console.log("  vercel env add IMPORT_API_KEY preview");
  console.log("  vercel --prod");
}

function main() {
  const { values } = parseEnvFile(envLocalPath);
  let importApiKey = String(values.get("IMPORT_API_KEY") || "").trim();
  let created = false;

  if (!importApiKey) {
    importApiKey = generateImportApiKey();
    upsertEnvValue(envLocalPath, "IMPORT_API_KEY", importApiKey);
    created = true;
    console.log(`Created IMPORT_API_KEY in ${envLocalPath}`);
  } else {
    console.log(`IMPORT_API_KEY already set in ${envLocalPath} (${importApiKey.length} chars)`);
  }

  console.log("\nLocal setup: ready.");
  console.log("Import/enrich scripts send it as header: x-lexiland-import-key");

  printVercelSteps();

  if (hasVercelCli()) {
    const whoami = tryVercelWhoami();
    if (whoami) {
      console.log(`\nVercel CLI logged in as ${whoami}.`);
      console.log("Run this to push the key to production (paste when prompted):");
      console.log("  vercel env add IMPORT_API_KEY production");
    } else {
      console.log("\nVercel CLI is installed but not logged in. Run: vercel login");
    }
  }

  if (created) {
    console.log("\nA new local key was generated. You must add this exact value to Vercel before enrich will work.");
  } else {
    console.log("\nYour local key already exists — make sure Vercel uses the same value, then redeploy.");
  }
}

main();
