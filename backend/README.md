# Backend — Agentic Dating Platform

Node.js / Express / Socket.IO / TypeScript

## Setup

```bash
npm install
cp .env.example .env   # fill in your API keys
npm run dev             # starts dev server on :4000
```

## Architecture

- **routes/** — REST endpoints (onboarding, match, health)
- **sockets/** — Socket.IO handlers (onboarding chat, agent conversation)
- **services/** — Business logic (agent engine, match orchestrator, scoring, profile building)
- **models/** — TypeScript interfaces & Mongoose schemas
- **db/** — Database connectors (MongoDB, Snowflake stub)
- **integrations/** — Third-party wrappers (ElevenLabs)
