# Learn-Up System Map

Initial verified stabilization map. Learn-Up is still in testing, so zero-row tables are not treated as dead code.

## Verified architecture
- Application root: `learn-up/`
- Deployment: Render web service `Learn-Up`, root `learn-up`, branch `main`, auto-deploy enabled.
- Database: Supabase project `Learn-Up`, PostgreSQL 17.
- Mobile: Capacitor/Android.
- Main subsystems: AI chat/tools/workflows, Supabase persistence, social/chat, calendar, library/RAG, PWA, LiveKit, notifications and email.

## Active database areas verified in code
- `ai_sessions` / `ai_messages`: AI conversation history and session loading.
- `ai_tool_events` / `ai_workflows` / `ai_skill_state`: AI tool provenance, resumable workflows and skill state.
- `chat_rooms` / `chat_messages`: social/group chat and LiveKit room integration.
- `profiles` / friendships / notifications: user and social layer.
- calendar and library tables are connected to application actions/routes even when current test data is small.

## Repository cleanup completed
The following were verified as empty or unused one-off artifacts and removed from `main`:
- root `diff.txt`
- root `old_chat2.txt`
- root `old_chat3.txt`
- `learn-up/old_chat.tsx`
- root `refactor.js` was removed after confirming it was a one-off transformation script and had no repository references.

Still under review before removal:
- root `old_chat.tsx` because it contains a large legacy chat implementation; it is not imported by the current source, but its content is preserved in Git history.
- root `ai_chat_history.txt` because it may contain useful historical context or internal material.
- `learn-up/sidebars_history.txt` because it appears historical and has no code references.
- `refactor.py` because the GitHub contents endpoint currently reports a stale SHA conflict; no forced deletion was attempted.

## Database stabilization completed
- Revoked `EXECUTE` for `anon` and `authenticated` on legacy `public.check_username(text)`. The application uses `check_username_availability(text)` instead.
- Removed exact duplicate `ai_workflows` index `ai_workflows_user_status_idx`, retaining `idx_ai_workflows_user_status`.

## Database debt still to review
- Multiple permissive RLS policies on several tables.
- `api_usage` has RLS enabled without policies.
- Many foreign keys lack covering indexes.
- Several indexes are currently unused. Do not remove solely because they are unused while features remain in testing.
- Some concepts have duplicate representations, such as chat membership arrays vs `room_members`, shared-calendar member arrays vs `shared_calendar_members`, and habit JSON dates vs `habit_completions`.

## Render / build debt
- TypeScript validation is explicitly disabled in `next.config.ts`; this is a stabilization priority, but it should only be enabled after the current type errors are measured and fixed.
- Sentry client configuration is still on the legacy `sentry.client.config.ts` path and Render reports a migration warning.
- `disableLogger` is deprecated in the current Sentry configuration.
- Browserslist/caniuse-lite data is stale.
- PWA precache skips several large source maps.
- `/api/health` exists but Render health check is not configured.

## Stabilization rule
Map first, then clean. Prefer small, independently verifiable commits. Never reset history. Never remove a schema object merely because it has no data yet.