import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "gateway.shelby.network" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "explorer.shelby.xyz" },
      { protocol: "https", hostname: "**.shelby.xyz" },
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "@aptos-labs/aptos-client/dist/node/index.node.mjs":
          "@aptos-labs/aptos-client/dist/browser/index.browser.mjs",
      };
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

export default nextConfig;
