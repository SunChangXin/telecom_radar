/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/api/radar": ["./config/**/*.json"],
    "/": ["./config/**/*.json"]
  }
};

module.exports = nextConfig;
