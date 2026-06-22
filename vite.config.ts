import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: {
    preset: "vercel",
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      manifest: false, // use your existing public/manifest.json
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
      },
    }),
  ],
});
2. Install the package — in your terminal run:

npm install vite-plugin-pwa -D
Or in your package.json devDependencies add:

"vite-plugin-pwa": "^0.21.0"
After committing both changes and redeploying, the install button will work on Android Chrome.

a minute ago

