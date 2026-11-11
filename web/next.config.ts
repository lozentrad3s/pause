import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// One .env at the repo root serves the contract scripts, agent and web app.
const rootEnv = resolve(__dirname, "../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {};

export default nextConfig;
