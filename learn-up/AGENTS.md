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
| Arquetipo SaaS | `.agents/the-architect/knowledge/archetypes/saas-webapp.md` | Learn Up es un SaaS educativo — consultar siempre |
| Auth Patterns | `.agents/the-architect/knowledge/building-blocks/auth-patterns.md` | Antes de tocar autenticación |
| Database Patterns | `.agents/the-architect/knowledge/building-blocks/database-patterns.md` | Antes de crear migraciones |
| Frontend Stacks | `.agents/the-architect/knowledge/building-blocks/frontend-stacks.md` | Antes de añadir dependencias frontend |
| Deployment | `.agents/the-architect/knowledge/building-blocks/deployment-patterns.md` | Antes de cambiar config de deploy |
| Blueprint Template | `.agents/the-architect/templates/blueprint-template.md` | Para generar planes de implementación |

### 2. Neo (`.agents/neo/`)
**Cuándo consultar:** Para implementar herramientas de IA, automatización, NLP o seguridad.

| Recurso | Ruta | Uso |
|---------|------|-----|
| AI Engine | `.agents/neo/src/core/ai_engine.py` | Referencia para motor de IA con PyTorch |
| Cybersecurity | `.agents/neo/src/modules/cybersecurity.py` | Patrones de detección de vulnerabilidades |
| Coding Assistant | `.agents/neo/src/modules/coding_assistant.py` | Análisis de código y calidad |
| Task Automation | `.agents/neo/src/modules/task_automation.py` | Cola de tareas, retry, workflows |
| NLP Conversation | `.agents/neo/src/modules/nlp_conversation.py` | Detección de intención, entidades, sentimiento |
| Research Module | `.agents/neo/src/modules/research.py` | Investigación multi-fuente |

### 3. Agency Agents (`.agents/agency-agents/`)
**Cuándo consultar:** Para seguir las mejores prácticas de un dominio específico.

| Situación | Archivo a consultar |
|-----------|-------------------|
| Trabajo de Frontend | `engineering/engineering-frontend-developer.md` |
| Trabajo de Backend | `engineering/engineering-backend-architect.md` |
| Code Review | `engineering/engineering-code-reviewer.md` |
| DevOps / Deploy | `engineering/engineering-devops-automator.md` |
| SRE / Incidentes | `engineering/engineering-sre.md` |
| Mobile / Capacitor | `engineering/engineering-mobile-app-builder.md` |
| Prompts de IA | `engineering/engineering-prompt-engineer.md` |
| Testing | `testing/testing-api-tester.md` |
| Accesibilidad | `testing/testing-accessibility-auditor.md` |
| Performance | `testing/testing-performance-benchmarker.md` |
| Documentación | `engineering/engineering-technical-writer.md` |
| Diseño UI/UX | `design/` (directorio completo) |
| Seguridad | `security/` (directorio completo) |
| Estrategia de producto | `strategy/nexus-strategy.md` |

---

## Reglas para la IA

1. **Antes de crear un nuevo componente frontend** → Lee `engineering-frontend-developer.md`
2. **Antes de crear/modificar una API** → Lee `engineering-backend-architect.md`
3. **Antes de una migración de BD** → Lee `database-patterns.md`
4. **Antes de tocar auth** → Lee `auth-patterns.md`
5. **Al planificar una feature grande** → Sigue el workflow de The Architect (Fases 1→4)
6. **Al implementar herramientas de IA** → Consulta los módulos de Neo como referencia
7. **Al hacer code review** → Aplica las reglas de `engineering-code-reviewer.md`

---

## Stack del Proyecto Learn Up

- **Framework:** Next.js 15 (App Router)
- **Estilos:** Tailwind CSS
- **Base de datos:** Supabase (PostgreSQL + RLS)
- **Auth:** Supabase Auth
- **IA:** Gemini (multimodal), Groq (velocidad), NVIDIA NIMs (razonamiento)
- **Hosting:** Render
- **Monitoreo:** Sentry (errores), Umami (analytics), BetterStack (uptime)
- **Mobile:** Capacitor (Android)
