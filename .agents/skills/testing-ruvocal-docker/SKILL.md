---
name: testing-ruvocal-docker
description: Test the ruvocal Docker image build and container startup. Use when verifying Docker-related changes to ruflo/src/ruvocal/.
---

# Testing RuVocal Docker Build

## Prerequisites

- Docker must be installed and running
- The `.env` file must exist at `ruflo/ruflo/src/ruvocal/.env` (template with safe defaults, no secrets)

## Key Facts

- The `.env` file is **required** for Docker builds — SvelteKit reads it during `npm run build` and needs `OPENAI_BASE_URL` to be set
- The Dockerfile uses a multi-stage build: `base` (runtime), `builder` (npm build), `mongo` (optional), `final`
- `INCLUDE_DB=true` embeds MongoDB in the image; `INCLUDE_DB=false` expects an external MongoDB
- The `entrypoint.sh` writes `.env.local` from the `DOTENV_LOCAL` env var at container start
- Secrets (API keys) should be passed at runtime via `-e` flags or `DOTENV_LOCAL`, never baked into the image

## Build Commands

```bash
# Standalone build (from ruflo/ruflo/src/ruvocal/)
docker build -t ruvocal --build-arg INCLUDE_DB=false .

# Full stack with docker-compose (from ruflo/ruflo/)
docker compose up -d
```

## Test Procedure

1. **Build test**: `docker build -t ruvocal-test --build-arg INCLUDE_DB=false .` — should exit 0
2. **Image verification**: `docker images ruvocal-test` — should show ~865MB image
3. **Container startup**: `docker run --rm -d --name ruvocal-run -p 3050:3000 ruvocal-test`
4. **Health check**: `docker logs ruvocal-run` — should show "Listening on http://0.0.0.0:3000"
5. **Cleanup**: `docker stop ruvocal-run`

## Common Pitfalls

- If `.env` is missing, the Dockerfile COPY step might succeed (uses `.env*` glob) but `npm run build` will fail with `OPENAI_BASE_URL is required`
- The `.env` file was previously removed from git tracking for security reasons — if it goes missing again, restore it from git history: `git show 29d52dfc2:ruflo/src/ruvocal/.env`
- Port 3000 is used internally; map to a different host port if 3000 is taken

## Devin Secrets Needed

None required for build testing. For runtime testing with actual LLM responses:
- `OPENAI_API_KEY` — an OpenRouter or other OpenAI-compatible API key, passed via `-e` at runtime
