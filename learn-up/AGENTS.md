# 🧠 Learn Up — Agent Context Guide

Este archivo es el punto de entrada para cualquier IA que trabaje en este proyecto.
Antes de realizar cambios significativos, **DEBES consultar** los recursos listados abajo.

---

## Repositorios de Referencia Instalados

### 1. The Architect (`.agents/the-architect/`)
**Cuándo consultar:** Antes de diseñar nuevas features, planificar arquitectura, o tomar decisiones de stack tecnológico.

| Recurso | Ruta | Uso |
|---------|------|-----|
| CLAUDE.md | `.agents/the-architect/CLAUDE.md` | Workflow de diseño (4 fases) |
| Arquetipo SaaS | `.agents/the-architect/knowledge/archetypes/saas-webapp.md` | Learn Up es un SaaS educativo |
| Auth Patterns | `.agents/the-architect/knowledge/building-blocks/auth-patterns.md` | Antes de tocar autenticación |
| Database Patterns | `.agents/the-architect/knowledge/building-blocks/database-patterns.md` | Antes de crear migraciones |
| Frontend Stacks | `.agents/the-architect/knowledge/building-blocks/frontend-stacks.md` | Antes de añadir dependencias frontend |
| Deployment | `.agents/the-architect/knowledge/building-blocks/deployment-patterns.md` | Antes de cambiar config de deploy |

### 2. Neo (`.agents/neo/`)
**Cuándo consultar:** Para herramientas de IA, automatización, NLP o seguridad.

### 3. Agency Agents (`.agents/agency-agents/`)
**Cuándo consultar:** Para frontend, backend, DevOps, SRE, mobile, testing, seguridad, accesibilidad y documentación.

---

## Reglas para la IA

1. **No resetear el repositorio ni reescribir su historial.**
2. **No crear ramas para tareas normales de mantenimiento salvo que el usuario lo solicite.**
3. **Antes de eliminar código:** buscar referencias, imports, rutas, APIs y consumidores.
4. **Antes de eliminar una tabla Supabase:** comprobar migraciones y uso en el código. Una tabla vacía no implica que sea obsoleta.
5. **Antes de una migración de BD:** consultar `database-patterns.md` y revisar el esquema actual.
6. **Al tocar auth:** consultar `auth-patterns.md`.
7. **Al modificar APIs:** consultar `engineering-backend-architect.md`.
8. **Al hacer code review:** aplicar `engineering-code-reviewer.md`.
9. Preferir cambios pequeños, reversibles y verificables.
10. Después de cambios de código, comprobar build, tests y estado del deploy antes de continuar con otra limpieza.

---

## Stack verificado actualmente

- **Framework:** Next.js 16.2.6 (App Router)
- **React:** 19.2.3
- **Estilos:** Tailwind CSS 4
- **Base de datos:** Supabase / PostgreSQL 17 + RLS
- **Auth:** Supabase Auth
- **IA:** AI SDK 6 + Google, OpenAI/OpenRouter y otros proveedores integrados en el proyecto
- **Hosting:** Render
- **Monitoreo:** Sentry
- **Mobile:** Capacitor / Android
- **Tests:** Vitest

> Este documento describe el estado actual del repositorio. No usar referencias históricas como si fueran el stack vigente.
