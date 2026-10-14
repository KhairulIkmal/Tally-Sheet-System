import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Lets Server Actions work when the app is opened from a phone over
      // the LAN IP during local testing, not just localhost.
      allowedOrigins: ["localhost:3200", "172.16.30.119:3200", "*.trycloudflare.com"],
    },
  },
};

export default nextConfig;

import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
