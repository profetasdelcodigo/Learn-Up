# Learn-Up System Map

Initial verified stabilization map. Zero-row tables are not treated as dead because the product is still in testing.

## Verified architecture
- Application root: `learn-up/`
- Deployment: Render web service `Learn-Up`, root `learn-up`, branch `main`, auto-deploy enabled.
- Database: Supabase project `Learn-Up`, PostgreSQL 17.
- Mobile: Capacitor/Android.
- Main subsystems: AI chat/tools/workflows, Supabase persistence, social/chat, calendar, library/RAG, PWA, LiveKit, notifications and email.

## Current database usage snapshot
Active data exists in `profiles`, `ai_sessions`, `ai_messages`, `ai_tool_events`, `ai_skill_state`, `ai_workflows`, `chat_rooms`, `chat_messages`, `notifications` and `user_sessions`. Many other feature tables have zero rows; this is expected during testing and is not evidence that the feature is unused.

## High-confidence repository cleanup candidates
- root `old_chat.tsx`
- root `old_chat2.txt`
- root `old_chat3.txt`
- root `diff.txt`
- root `ai_chat_history.txt` (review for internal/sensitive material before removal)
- `learn-up/old_chat.tsx`

These are candidates only. Delete only after repository-wide reference checks and current-route checks.

## Database cleanup candidates
- Duplicate `ai_workflows` indexes: `ai_workflows_user_status_idx` and `idx_ai_workflows_user_status`.
- Multiple permissive RLS policies on several tables.
- `api_usage` has RLS enabled without a policy.
- `public.check_username(text)` is SECURITY DEFINER and callable by `anon`; verify intended exposure and harden.
- Many foreign keys lack covering indexes.
- Several indexes are currently unused. Do not remove solely because they are unused while features are still in testing.

## Render cleanup candidates
- Build currently reports skipped TypeScript validation.
- Sentry emits current deprecation warnings.
- Browserslist data is stale.
- PWA precache skips large source maps.
- `/api/health` exists but Render health check is not configured.

## Stabilization rule
Map first, then clean. Prefer small, independently verifiable commits. Never reset history. Never remove a schema object merely because it has no data yet.