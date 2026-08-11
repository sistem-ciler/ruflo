/** @type {import('next').NextConfig} */
const config = {
  async rewrites() {
    const api = process.env.API_URL || "http://localhost:4000";
    return [
      { source: "/api/:path*", destination: `${api}/api/:path*` },
      { source: "/health/:path*", destination: `${api}/health/:path*` },
    ];
  },
};

export default config;
