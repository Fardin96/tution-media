import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets phones on the local network load dev assets via the LAN IP
  // (e.g. http://192.168.0.147:3000). Dev-only; ignored in production.
  allowedDevOrigins: ["192.168.*.*"],
};

export default nextConfig;
