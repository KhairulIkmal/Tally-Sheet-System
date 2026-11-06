import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Lets Server Actions work when the app is opened from a phone over
      // the LAN IP during local testing, not just localhost.
      allowedOrigins: ["localhost:3200", "172.16.30.119:3200", "*.trycloudflare.com"],
      // A pallet photo is sent to a Server Action: shrunk to under 1.5 MB on the phone (2 MB bucket limit).
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;

import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
