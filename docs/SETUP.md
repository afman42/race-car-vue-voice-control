# Setup & Requirements

## Prerequisites

| Requirement | Why |
|---|---|
| **Chrome browser** | Required for Web Speech API (recognition + synthesis) |
| **Microphone access** | Needed for voice commands |
| **Earphones** | Recommended for best audio feedback experience |
| **HTTPS** | Required by Web Speech API — dev server auto-configures with a self-signed certificate |
| **Node.js 18+** | Runtime |
| **pnpm** | Package manager |

---

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd race-car-vue-voice-control

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Open **https://localhost:5173** in Chrome. Your browser will show a security warning about the self-signed certificate — proceed anyway.

---

## Available Scripts

| Script | What It Does |
|---|---|
| `pnpm dev` | Start dev server with HTTPS on port 5173 |
| `pnpm build` | Production build to `dist/` |
| `pnpm preview` | Preview the production build locally |
| `pnpm test` | Run unit tests in watch mode |
| `pnpm test:run` | Run all unit tests once (236 tests) |
| `pnpm test:ui` | Open Vitest interactive UI dashboard |
| `pnpm test:e2e` | Run Playwright e2e tests (67 tests, auto-starts dev server) |

---

## Troubleshooting

### Common Issues

| Problem | Solution |
|---|---|
| **Microphone not working** | Check browser permissions (🔒 → Microphone → Allow). Reload the page. |
| **Voice recognition doesn't start** | Use HTTPS — Web Speech API won't work on HTTP. The dev server auto-configures SSL. |
| **No sound / engine audio** | Ensure your browser supports `AudioContext`. Check volume levels. |
| **Self-signed cert warning** | Click "Advanced" → "Proceed to localhost". E2E tests bypass this automatically. |
| **Stale layout or state** | Clear browser cache and hard reload (Ctrl+Shift+R / Cmd+Shift+R). |
| **Language doesn't persist** | Language preference is saved in `localStorage` — check that it's enabled. |
| **Port 5173 already in use** | Kill the existing process: `kill $(lsof -t -i:5173)` |

### Usage Tips

- Speak clearly and concisely — background noise can confuse speech recognition
- Some commands require the engine to be running first (DRS, Overtake)
- Tire compound changes only work in the pits (engine must be off)
- The radio automatically reopens after each command — no need to click again
- For best results, use in a **quiet environment**

---

## Dependencies

### Runtime (1 package)

| Package | Version | Purpose |
|---|---|---|
| `vue` | ^3.4 | UI framework (Composition API, `<script setup>`) |

### Dev (7 packages)

| Package | Purpose |
|---|---|
| `vite` | Build tool and dev server |
| `@vitejs/plugin-vue` | Vue SFC compiler for Vite |
| `@vitejs/plugin-basic-ssl` | Auto-generated HTTPS cert for local dev |
| `vitest` | Unit test runner (Vite-native) |
| `@vue/test-utils` | Vue component testing utilities |
| `jsdom` | DOM environment for unit tests |
| `@playwright/test` | E2E test runner (Chromium) |
