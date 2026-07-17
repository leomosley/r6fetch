#!/usr/bin/env bun
/**
 * Script to run the Bruno collection with environment variables loaded from .dev.vars
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { spawn } from "child_process";

const ROOT_DIR = resolve(import.meta.dirname, "..");
const DEV_VARS_PATH = resolve(ROOT_DIR, "apps/api/.dev.vars");
const BRUNO_COLLECTION_PATH = resolve(ROOT_DIR, "bruno/r6-stats-api");

function loadDevVars(): Record<string, string> {
  const content = readFileSync(DEV_VARS_PATH, "utf-8");
  const vars: Record<string, string> = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1);
    vars[key] = value;
  }

  return vars;
}

async function main() {
  const devVars = loadDevVars();

  const apiKey = devVars.STATS_CC_API_KEY;

  if (!apiKey) {
    console.error("Error: STATS_CC_API_KEY not found in .dev.vars");
    process.exit(1);
  }

  const env = {
    ...process.env,
    STATS_CC_API_KEY: apiKey,
  };

  console.log("Running Bruno collection...\n");
  console.log(`Collection: ${BRUNO_COLLECTION_PATH}`);
  console.log(`API Key: ${apiKey.slice(0, 8)}...${apiKey.slice(-8)}\n`);

  const brunoProcess = spawn("npx", ["@usebruno/cli", "run", "--env", "local"], {
    env,
    stdio: "inherit",
    cwd: BRUNO_COLLECTION_PATH,
  });

  brunoProcess.on("close", (code) => {
    process.exit(code ?? 0);
  });

  brunoProcess.on("error", (err) => {
    console.error("Failed to run Bruno:", err.message);
    process.exit(1);
  });
}

main();
