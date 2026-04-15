import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent click-jacking
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  // Prevent MIME sniffing
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  // Referrer policy — don't leak URL to third parties
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  // Disable FLoC / interest-cohort tracking
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // HSTS — enforce HTTPS for 1 year (production only; dev ignores it)
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  // Content Security Policy
  // dev: includes 'unsafe-eval' so React dev tools work (stack traces, HMR)
  // prod: 'unsafe-eval' is omitted — React never uses eval() in production
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      process.env.NODE_ENV === "development"
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
        : "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",

  turbopack: {
    root: __dirname,
  },

  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
