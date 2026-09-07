# Learn-Up System Map

Verified stabilization map for the current `main` branch. Learn-Up is still in testing, so zero-row tables are not treated as dead code.

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
- `api_usage`: server-only quota accounting. RLS is intentionally enabled without a client policy; application code accesses it from server-side code.

## Repository cleanup completed
Removed from `main` after reference checks:
- root `diff.txt`
- root `old_chat2.txt`
- root `old_chat3.txt`
- root `old_chat.tsx`
- `learn-up/old_chat.tsx`
- `refactor.js`
- `refactor.py`
- `learn-up/sidebars_history.txt`
- `learn-up/inject.js`
- experimental/backup AI chat components (`AIChatComponent.bak.tsx`, `AIChatComponent.backup.tsx`, `AIChatComponentV2.tsx`, `StableAIChatComponent.tsx`, `AIChatComponent.useChat.tsx`)
- tracked Android Studio metadata under `learn-up/android/.idea/`

Still intentionally retained:
- root `ai_chat_history.txt` pending review for historical/internal content.
- active canonical `AIChatComponent.tsx` and production AI/action code.
- Capacitor/Android runtime source.

## Database stabilization completed
- Revoked `EXECUTE` for `anon` and `authenticated` on legacy `public.check_username(text)`. The application uses `check_username_availability(text)` instead.
- Removed exact duplicate `ai_workflows` index `ai_workflows_user_status_idx`, retaining `idx_ai_workflows_user_status`.
- Added missing foreign-key indexes identified by Supabase's performance advisor.
- Removed redundant RLS policies from `calendar_events`, `friendships`, `user_media`, `habits` and `library_items` where the specific canonical policies already preserved the same effective access.
- Optimized selected hot-table RLS policies to use `(select auth.uid())` where semantics were unchanged.

## Database debt still to review
- Remaining `auth_rls_initplan` warnings on future/low-traffic tables and a few active tables.
- Remaining multiple-permissive-policy warnings are concentrated in legacy/future feature tables such as `personal_habit_tracker` and `shared_habit_tracker`; do not consolidate until their intended feature contracts are confirmed.
- Several indexes are currently unused. Do not remove solely because they are unused while features remain in testing.
- Some concepts have duplicate representations, such as chat membership arrays vs `room_members`, shared-calendar member arrays vs `shared_calendar_members`, and habit JSON dates vs `habit_completions`.
- Leaked password protection is disabled in Supabase Auth and must be enabled through Auth configuration; it is not a schema migration.

## Render / build debt
- TypeScript validation is explicitly disabled in `next.config.ts`; enable only after current type errors are measured and fixed.
- Sentry client configuration is still on the legacy `sentry.client.config.ts` path and Render reports a migration warning.
- `disableLogger` is deprecated in the current Sentry configuration.
- Browserslist/caniuse-lite data is stale.
- PWA precache skips several large source maps.
- `/api/health` exists but Render health check is not configured.

## Stabilization rule
Map first, then clean. Prefer small, independently verifiable commits. Never reset history. Never remove a schema object merely because it has no data yet. Never change a database contract without checking its application consumers and migration history.