/** @type {import('next').NextConfig} */
const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https://*.supabase.co;
    font-src 'self' data:;
    connect-src 'self' wss: https://*.supabase.co;
`.replace(/\n/g, '').replace(/\s+/g, ' ').trim();

const nextConfig = {
  output: "standalone", // Required for Docker deployment
  poweredByHeader: false,
  transpilePackages: ["@react-pdf/renderer"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
          {
            key: "Content-Security-Policy",
            value: cspHeader
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()"
          },
        ],
      },
    ];
  },
};

export default nextConfig;
