/** @type {import('next').NextConfig} */
const isTauri = process.env.TAURI_ENV_ARCH !== undefined;

const nextConfig = {
  output: isTauri ? "export" : "standalone",
  ...(isTauri
    ? {}
    : {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/:path*`,
            },
          ];
        },
      }),
};

module.exports = nextConfig;
