# Learn Up - Master Blueprint

## Project Overview
Learn Up is a premium, AI-driven educational platform built with Next.js 15, Vercel, Supabase, and NVIDIA/Groq/Gemini APIs.
The goal is to provide a fully autonomous, visually stunning learning experience through AI agents (Jarvis, Teacher, Counselor).

## Tech Stack
- **Framework:** Next.js 15 (App Router, Server Actions)
- **Styling:** Tailwind CSS, Framer Motion, React Three Fiber (for 3D elements)
- **Database & Auth:** Supabase (PostgreSQL, pgvector, RLS, Edge Functions)
- **AI Core:** Vercel AI SDK, Groq (Llama 3/Mixtral), Gemini (Google), NVIDIA NIMs (FLUX, Nemotron, Cosmos)
- **Monitoring:** Sentry, Umami, BetterStack

## Agentic Guidelines (For AI Assistants developing this project)
1. **Always use specific tools:** Rely on `view_file` instead of `cat`, `grep_search` instead of `grep`.
2. **Aesthetics are paramount:** The UI must be stunning, dynamic, and premium. No basic/generic designs.
3. **Security:** Always respect Row Level Security (RLS) in Supabase. Never expose API keys to the client.
4. **Autonomous Mode:** When building AI features for users, ensure there is always a fallback (Tool Confirmation) and a visible reasoning trace.

## Directory Structure
- `src/app`: App Router pages
- `src/components`: UI components (e.g., `ai/` for Jarvis, `3d/` for 3D elements)
- `src/actions`: Server Actions (Data fetching, AI routing)
- `supabase/migrations`: Database schema, pgvector setups, webhooks
- `.agents`: Internal agent personas and scripts (Agency Agents, NEO)
