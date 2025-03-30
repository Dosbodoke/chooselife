const { Config } = require("next-recompose-plugins");

/** @type {import('next').NextConfig} */
const nextConfig = {
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
    ],
  },
};
const withNextIntl = require("next-intl/plugin");

const config = new Config(nextConfig)
  .applyPlugin((phase, args, config) => {
    return withNextIntl("./i18n.ts")(config);
  }, "next-intl/plugin")
  .build();

module.exports = config;
