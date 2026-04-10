const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/como-funciona",
        destination: "/#como-funciona",
        permanent: true
      }
    ]
  }
}

export default nextConfig
