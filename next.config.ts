import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Do not enable Cache Components: /shop is deliberately rendered per request,
  // while getCatalog() uses a separate, versioned in-process data cache.
};

export default nextConfig;
