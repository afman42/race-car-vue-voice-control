# Setup & Requirements

## Requirements

- **Chrome browser** (required for the Web Speech API)
- **Microphone access** enabled
- **Earphones** recommended for best audio experience
- **HTTPS** — required by the Web Speech API; the dev server uses a self-signed certificate
- **Node.js 18+** and **pnpm** installed

---

## Quick Start

```bash
pnpm install
pnpm dev            # Start dev server (https://localhost:5173)
pnpm test:run       # Unit tests (Vitest)
pnpm test:e2e       # E2E tests (Playwright)
```

---

## Project Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start dev server with HTTPS on port 5173 |
| `pnpm build` | Production build to `dist/` |
| `pnpm preview` | Preview the production build locally |
| `pnpm test` | Run unit tests in watch mode |
| `pnpm test:run` | Run all unit tests once |
| `pnpm test:ui` | Open Vitest interactive UI dashboard |
| `pnpm test:e2e` | Run Playwright e2e tests (auto-starts dev server) |

---

## Troubleshooting

- **Clear browser cache** if you experience stale state or layout issues
- For best results, use in a **quiet environment** with minimal background noise
- Some commands require the engine to be running first (e.g. DRS, Overtake)
- **Tire compound changes** only work in the pits (engine must be off)
- Language preference is saved across sessions via `localStorage`
- The dev server uses **HTTP/2** with a self-signed SSL certificate — your browser will show a warning the first time; proceed anyway
- E2E tests use `ignoreHTTPSErrors: true` to bypass the self-signed cert
- If the dev server is already running, Playwright reuses it (set `CI=true` to force a fresh start)

---

## Dependencies

### Runtime

| Package | Purpose |
|---|---|
| `vue` | UI framework (Composition API) |

### Dev

| Package | Purpose |
|---|---|
| `vite` | Build tool and dev server |
| `@vitejs/plugin-vue` | Vue SFC compiler for Vite |
| `@vitejs/plugin-basic-ssl` | Auto-generated HTTPS cert for local dev |
| `vitest` | Unit test runner |
| `@vue/test-utils` | Vue component testing utilities |
| `jsdom` | DOM environment for unit tests |
| `@playwright/test` | E2E test runner |
