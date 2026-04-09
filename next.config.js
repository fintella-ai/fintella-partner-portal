/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      "/api/**": ["./prisma/dev.db"],
    },
  },
};

module.exports = nextConfig;
