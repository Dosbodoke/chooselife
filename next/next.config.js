import createNextIntlPlugin from "next-intl/plugin";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // `eslint` config option removed in Next.js 16 — lint via `pnpm lint` / ESLint CLI
  // leaflet-defaulticon-compatibility uses webpack-style `~package` CSS urls
  turbopack: {
    resolveAlias: {
      "~*": "*",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "54321",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
        port: "",
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: process.env.NEXT_PUBLIC_SUPABASE_URL.replace(
          /(^\w+:|^)\/\//,
          ""
        ),
        port: "",
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: "*.chooselife.club",
        port: "",
        pathname: "**",
      },
    ],
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
