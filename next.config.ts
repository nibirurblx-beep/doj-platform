import type { NextConfig } from "next";
 
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Uploads go through server actions: documents (20 MB) + photos (2 MB)
      bodySizeLimit: "25mb",
    },
  },
  poweredByHeader: false,
};
 
export default nextConfig;