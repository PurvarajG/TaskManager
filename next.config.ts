import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite loads its own .wasm/.data files at runtime; bundling it breaks
  // that wiring ("instantiateWasm is not a function"). Keep it external.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
