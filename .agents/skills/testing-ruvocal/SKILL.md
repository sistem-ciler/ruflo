---
name: testing-ruvocal
description: Test the RuFlo (ruvocal) chat UI end-to-end in Docker. Covers Docker build, container startup, theme verification, and browser GUI testing.
---

# Testing RuFlo (Ruvocal) Chat UI

## Prerequisites

- Docker installed on the machine
- The ruvocal source at `ruflo/ruflo/src/ruvocal/`

## Devin Secrets Needed

- `OPENAI_API_KEY` — OpenRouter API key (passed at runtime via `-e`, never committed)

## Building the Docker Image

```bash
cd ruflo/ruflo/src/ruvocal
docker build -t ruvocal-test --build-arg INCLUDE_DB=true .
```

- The `.env` template must exist for `npm run build` (SvelteKit needs `OPENAI_BASE_URL` at build time)
- The Dockerfile uses `COPY .env* /app/` with a `touch` fallback for resilience

## Running the Container

```bash
docker run -d --name ruvocal-test \
  -p 3050:3000 \
  -e OPENAI_BASE_URL=https://openrouter.ai/api/v1 \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -v ruvocal-data:/data \
  ruvocal-test
```

- Wait ~5s for startup, then check `docker logs ruvocal-test` for the admin token
- Access the UI at `http://localhost:3050/?token=<ADMIN_TOKEN>`

## Verifying Container Health

```bash
docker ps --filter name=ruvocal-test --format '{{.Status}}'
# Should show "Up" (not "Exited")

docker logs ruvocal-test 2>&1 | grep -i 'listening\|started\|ready'
# Should show the server listening on port 3000
```

## Theme Color Verification (Browser GUI)

When verifying theme changes, use the browser DevTools console to check computed styles:

```javascript
// Background color (dark mode)
getComputedStyle(document.documentElement).backgroundColor
// Expected for godoman theme: "rgb(10, 14, 26)"

// Button/badge colors — find elements and check:
getComputedStyle(element).backgroundColor
getComputedStyle(element).color
```

### Godoman Brand Colors Reference

| Color | Hex | RGB |
|-------|-----|-----|
| Green (primary) | #00d084 | rgb(0, 208, 132) |
| Purple (accent) | #9b51e0 | rgb(155, 81, 224) |
| Blue | #227ec5 | rgb(34, 126, 197) |
| Navy background | #0a0e1a | rgb(10, 14, 26) |
| Surface/elevated | #151a2a | rgb(21, 26, 42) |

### Key Elements to Verify

1. **Dark mode background** — `<html>` element bg should be navy (#0a0e1a)
2. **Welcome Modal** — appears on first visit; "Start chatting" button should be purple, MCP badge green
3. **Logo SVG** — three wave gradients: green, purple, blue
4. **Quantum dots** — three animated dots in sidebar: green, purple, blue
5. **Meta theme-color** — updates to `rgb(10, 14, 26)` after theme toggle

### Welcome Modal Behavior

- The Welcome Modal appears on the first visit per session (server-side state, not localStorage)
- Clearing localStorage/cookies alone may not retrigger it — the token-based session tracks dismissal
- To retrigger: use a fresh token or incognito window

## Tips

- Map to port 3050 externally to avoid conflicts with local dev servers on 3000/5173
- The container uses MongoMemoryServer when `MONGODB_URL` is not set (auto-fallback)
- For theme testing, use screen recording with annotations to provide visual proof
- Always verify colors programmatically (console) in addition to visual inspection
