import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Nodemailer node: imports webpack bundle mein nahi jane chahiye.
  serverExternalPackages: ["nodemailer"],
};

export default nextConfig;
