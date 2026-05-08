# GAT Control Room — Deploy to Vercel

## One-time setup (5 minutes)

Open Terminal in this folder and run these 3 commands:

```bash
npm install
npm install -g vercel
vercel --prod
```

Vercel will open a browser window to log in, then auto-deploy.
You'll get a URL like: `https://gat-control-room.vercel.app`

---

## Option B — Netlify drag-drop (no terminal needed)

1. Run `npm install && npm run build` in this folder
2. Go to https://app.netlify.com/drop
3. Drag the `dist/` folder onto the page — instant URL

---

## Re-deploying after changes

```bash
vercel --prod
```

That's it.
