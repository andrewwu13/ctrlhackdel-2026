import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(configDir, "..");

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: workspaceRoot,
  },
};

export default nextConfig;
