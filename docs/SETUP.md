# Setup & Requirements

## Requirements

- **Chrome browser** (required for the Web Speech API)
- **Microphone access** enabled
- **Earphones** recommended for best audio experience
- **HTTPS** — required by the Web Speech API; the dev server uses a self-signed certificate

## Quick Start

```bash
pnpm install
pnpm dev        # Start dev server (https://localhost:5173)
```

## Project Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start dev server with HTTPS |
| `pnpm build` | Production build |
| `pnpm preview` | Preview production build |
| `pnpm test` | Run tests in watch mode |
| `pnpm test:run` | Run tests once |
| `pnpm test:ui` | Open Vitest UI dashboard |

## Troubleshooting

- **Clear browser cache** if experiencing issues
- For best results, use in a **quiet environment**
- Some commands require the engine to be running first
- Tire compound changes only work in the pits (engine must be off)
- Language preference is saved across sessions via `localStorage`
- No VPN or proxy recommended for optimal performance
