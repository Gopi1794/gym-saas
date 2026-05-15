/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["html5-qrcode"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "v2.exercisedb.io" },
      { protocol: "https", hostname: "api.workoutxapp.com" },
      { protocol: "https", hostname: "raw.githubusercontent.com" },
    ],
  },
}

export default nextConfig
