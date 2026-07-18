import type { NextConfig } from "next";

const config: NextConfig = {
  devIndicators: false,
  transpilePackages: ["@flowproof/core", "@flowproof/fixtures"],
};
export default config;
