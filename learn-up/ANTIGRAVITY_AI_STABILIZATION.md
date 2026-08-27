# Guía de estabilización IA para Antigravity

## Objetivo

Dejar Learn Up con respuestas rápidas y confiables usando Groq, OpenRouter,
Gemini y NVIDIA NIM, sin exponer claves del `.env` ni eliminar funciones de
archivos, búsqueda, generación de imágenes o video.

## Diagnóstico confirmado

1. `AI_PROVIDER=openrouter` corta el fallback: si OpenRouter falla o se queda
   lento, `getAICompletion` retorna el error en vez de intentar Groq, Gemini o
   NVIDIA.
2. Hay modelos retirados por Groq (`llama-3.3-70b-versatile`) y modelos de
   preview/no verificados en varios selectores.
3. Exámenes y los selectores de Jarvis tienen el slug incorrecto
   `nvidia/nvidia/nemotron-3-ultra-550b-a55b`; el ID correcto tras el prefijo
   de Learn Up es `nvidia/nemotron-3-ultra-550b-a55b`.
4. NVIDIA, OpenRouter, Tavily, Serper, Unsplash y fal no tienen un presupuesto
   de tiempo uniforme. Una API lenta puede congelar el chat.
5. Jarvis recibe `[Contexto URL: ...]` antes de `[Skills Activas: ...]`; su
   parser solo detecta las skills si están al comienzo, así que ignora la
   selección del usuario y carga todos los paquetes de herramientas.
6. El endpoint legado `src/app/api/chat/route.ts` usa modelos viejos distintos
   al router real de `src/lib/ai.ts`.

## Modelos que se deben usar

Usar IDs nativos, sin duplicar el proveedor:

| Uso | ID Learn Up | Motivo |
| --- | --- | --- |
| Texto rápido, chat y agentes | `groq/openai/gpt-oss-20b` | Baja latencia y JSON/tool use. |
| Fallback gratuito | `openrouter/openai/gpt-oss-20b:free` | Disponible vía OpenRouter. |
| Archivos, imagen y PDF | `gemini/gemini-2.5-flash` | Ruta multimodal. |
| Razonamiento opcional | `nvidia/nemotron-3-ultra-550b-a55b` | Solo para tareas largas o complejas. |

No usar `llama-3.3-70b-versatile`, `gemini-1.5-*`, `dots-3-note-preview`,
`nemotron-3.5-lightning:free`, `qwen3.7-flash`, `z-ai/glm-5.2` ni
`moonshotai/kimi-k2.6` como defaults hasta haber comprobado su disponibilidad
con la clave real. Groq retiró Llama 3.3 70B para el tier developer/free el 16
de agosto de 2026.

## Cambios obligatorios

### 1. Router único

Archivo: `src/lib/ai.ts`

Crear constantes:

```ts
export const AI_MODELS = {
  groqFast: "openai/gpt-oss-20b",
  openRouterFast: "openai/gpt-oss-20b:free",
  geminiFast: process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash",
  nvidiaReasoning: "nvidia/nemotron-3-ultra-550b-a55b",
} as const;
```

Implementar `fetchWithTimeout` con `AbortController` y límite de 18 segundos.
Aplicarlo a OpenRouter, NVIDIA, Tavily, Serper, Unsplash y fal. Para Gemini y
Groq SDK usar `Promise.race` con el mismo límite.

El orden de fallback para texto debe ser:

1. Modelo elegido por el usuario.
2. `groq/openai/gpt-oss-20b`.
3. `openrouter/openai/gpt-oss-20b:free`.
4. `gemini/gemini-2.5-flash`.
5. NVIDIA solo como último fallback para texto, y sin `enable_thinking`.

No lanzar el error luego del primer proveedor. Acumular errores resumidos y
fallar solo después de que todos los proveedores disponibles fallen.

Normalizar prefijos antes de enrutarlos:

```ts
model.replace(/^nvidia\/nvidia\//, "nvidia/")
```

Para NVIDIA, quitar el `reasoning_budget = 4096` y `enable_thinking: true` por
defecto. Activarlo únicamente mediante una opción explícita para una tarea de
razonamiento; de otro modo incrementa mucho la latencia.

Reducir `max_tokens` a 2048 como normal y aumentar solo para exámenes o
documentos largos. Limitar historial a las últimas 8-10 interacciones.

### 2. Defaults de agentes y selectores

Actualizar los defaults en:

- `src/actions/ai-tutor.ts`
- `src/actions/jarvis.ts`
- `src/components/AIChatComponent.tsx`
- `src/components/JarvisGlobalWidget.tsx`
- `src/app/ai/profesor/page.tsx`
- `src/app/ai/consejero/page.tsx`
- `src/app/ai/recetas/page.tsx`

Valores recomendados:

- Profesor, Consejero, NutriRecetas, Jarvis y corrector: `groq/openai/gpt-oss-20b`.
- Examen sin adjunto: `groq/openai/gpt-oss-20b` con modo JSON.
- Examen con archivo, PDF o imagen: `gemini/gemini-2.5-flash`.
- Opción avanzada en UI: `nvidia/nemotron-3-ultra-550b-a55b`.

Eliminar del menú los modelos no verificados. Mostrar solamente Groq, OpenRouter,
Gemini y NVIDIA con los IDs de esta guía.

### 3. Skills de Jarvis y latencia

Archivo: `src/actions/jarvis.ts`.

El parser debe buscar skills en cualquier parte del mensaje, no con `^`:

```ts
const skillsMatch = message.match(/\[Skills Activas: (.*?)\]\n\n/);
```

Después eliminar el bloque encontrado, conservando el contexto de URL. No cargar
todos los paquetes cuando el usuario eligió un subconjunto. Si no eligió nada,
usar solo un conjunto base pequeño: `research_pack`, `library_pack`,
`learning_pack`, `content_pack` y `edu_pack`.

Las acciones de escritura, envío, publicación, navegación externa, generación y
borrado deben seguir retornando `requiresConfirm: true`. No habilitar ejecución
arbitraria de código, lectura de secretos ni control libre del navegador.

### 4. Búsqueda, imágenes y video

Archivos involucrados:

- `src/lib/web-search.ts`
- `src/lib/unsplash.ts`
- `src/lib/fal.ts`
- `src/lib/ai-tools.ts`

Mantener el orden Tavily -> Serper, pero ejecutar ambas búsquedas con timeout y
`Promise.allSettled`; una caída no debe cancelar la otra. Si ambas fallan, la IA
debe responder sin fuentes con el aviso breve de que la búsqueda no estuvo
disponible.

Para NutriRecetas, intentar primero `searchRecipeImage` (Unsplash) y usar fal
solo si el usuario solicita una imagen generada o si no hay resultado. Así se
evita gastar créditos de fal en cada receta.

`FAL_KEY`, `TAVILY_API_KEY`, `SERPER_API_KEY`, `NEXT_PUBLIC_UNSPLASH_ACCESS_KEY`
están presentes localmente; nunca enviarlas al cliente ni imprimirlas en logs.

### 5. Archivos

Archivos involucrados:

- `src/lib/ai.ts`
- `src/actions/ai-tutor.ts`
- `src/actions/library.ts`
- `src/actions/chat.ts`

La ruta actual soporta PDF, DOC/DOCX, PPTX, XLSX, ODT/ODS/ODP, RTF, TXT, MD,
CSV, JSON y código. Mantener el límite de 25 MB y URLs exclusivamente de
Supabase Storage.

No borrar automáticamente un archivo válido si falla el embedding. Guardar el
documento con estado `pending_embeddings` y permitir reintento; hoy
`uploadAndIndexAiDocument` lo elimina, lo que hace que una caída temporal de
Gemini parezca un fallo de subida.

Las rutas actuales respetan el estándar por usuario:

- Biblioteca: `userId/timestamp.ext`
- Documentos IA: `userId/timestamp_nombre.ext`
- Chat: `roomId/userId/timestamp.ext`

Conservar esas rutas y mostrar el error real de Storage/RLS al usuario.

### 6. Endpoint legado

Archivo: `src/app/api/chat/route.ts`.

No mantener un segundo router con `gemini-1.5-pro-latest` y Llama 3.3. Elegir
una de estas alternativas:

1. Migrarlo para que llame a `getAICompletion` de `src/lib/ai.ts` y devuelva el
   contrato de streaming que use el cliente.
2. Si no tiene consumidores reales, eliminarlo y dejar los Server Actions como
   única entrada de agentes.

Antes de quitarlo, buscar `fetch('/api/chat')`, `fetch("/api/chat")` y
referencias del cliente.

### 7. Variables de Render

Conservar las claves existentes y añadir solo estas variables no secretas:

```env
AI_PROVIDER=groq
AI_TEXT_TIMEOUT_MS=18000
AI_MAX_OUTPUT_TOKENS=2048
GEMINI_TEXT_MODEL=gemini-2.5-flash
NEXT_PUBLIC_SITE_URL=https://learn-up-qmgx.onrender.com
```

No incluir comillas ni pegar claves en commits. Tras actualizar variables, hacer
un deploy limpio de Render para invalidar el build anterior.

## Pruebas antes de desplegar

1. Ejecutar `npm run build` desde `C:\Users\profe\Learn-Up\learn-up`.
2. Probar Profesor y Consejero con una pregunta corta: debe responder por Groq.
3. Apagar temporalmente `GROQ_API_KEY` en un entorno de prueba: debe responder
   usando OpenRouter o Gemini, no mostrar una pantalla bloqueada.
4. Subir PDF, DOCX, PPTX, XLSX y una imagen; verificar lectura o mensaje de
   formato claro.
5. Pedir una receta: debe mostrar texto aunque Unsplash o fal fallen.
6. Pedir investigación actual: debe usar Tavily/Serper y devolver enlaces.
7. Pedir generar imagen/video: debe requerir confirmación antes de gastar fal.
8. Crear examen con y sin archivo; verificar JSON válido y total de 100 puntos.
9. Confirmar que Jarvis con dos skills seleccionadas no carga todos los packs.
10. Revisar logs de Render: nunca deben aparecer valores de API keys.

## Criterio de entrega

Antigravity debe entregar un commit pequeño, sin `.env.local`, sin cambios a
RLS ni a las claves, con `npm run build` exitoso y una lista de modelos
efectivamente verificados desde el endpoint de cada proveedor.
