import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A lockfile in the home directory makes Next infer the wrong workspace root.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
