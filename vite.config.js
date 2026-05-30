import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { resolve } from "node:path"

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    emptyOutDir: true,
    // Use app.html as the Vite source entry so the served root index.html
    // (a built artifact) is never re-ingested as build input.
    rollupOptions: { input: resolve(__dirname, "app.html") },
  },
})
