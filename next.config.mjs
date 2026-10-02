/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Permite compilar numa pasta separada (npm run build:check), para um build de
  // verificação não apagar o .next que o `next dev` está usando. O dev usa
  // Turbopack e o build usa webpack: compartilhando a mesma pasta, um derruba os
  // manifests do outro e o dev passa a dar ENOENT em build-manifest.json.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
