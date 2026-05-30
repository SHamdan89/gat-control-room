// Deploy: copy the Vite build output into the repo root, which is what
// GitHub Pages serves (main branch / root folder, custom domain gat.trading).
// Run via `npm run deploy` (build + this script), then commit & push.
import { readdirSync, rmSync, copyFileSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname)
const dist = resolve(root, "dist")
const distAssets = resolve(dist, "assets")
const rootAssets = resolve(root, "assets")

// 1. Replace root assets/ with freshly built assets (clears old hashed bundles).
rmSync(rootAssets, { recursive: true, force: true })
mkdirSync(rootAssets, { recursive: true })
for (const f of readdirSync(distAssets)) copyFileSync(resolve(distAssets, f), resolve(rootAssets, f))

// 2. Served entry: root index.html is the built app.html.
writeFileSync(resolve(root, "index.html"), readFileSync(resolve(dist, "app.html"), "utf8"))

// 3. Copy any other top-level static assets (logo, etc.) emitted by the build.
for (const f of readdirSync(dist)) {
  if (f === "assets" || f === "app.html" || f === "index.html") continue
  const dest = resolve(root, f)
  rmSync(dest, { force: true })  // overwrite even if existing copy is read-only
  copyFileSync(resolve(dist, f), dest)
}

console.log("Deployed dist/ -> repo root. Served assets:", readdirSync(rootAssets).join(", "))
