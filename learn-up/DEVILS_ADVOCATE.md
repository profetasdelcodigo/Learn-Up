# Informe del Abogado del Diablo: Proyecto Learn Up

Este informe detalla una crítica técnica y de producto exhaustiva sobre el estado actual del proyecto Learn Up.

## 1. Vulnerabilidades de Seguridad Críticas
*   **JarvisGuard Ineficaz**: La detección de jailbreak basada en RegEx (`JAILBREAK_PATTERNS`) es obsoleta. No protege contra técnicas modernas de inyección de prompts, lo que pone en riesgo las herramientas de escritura del sistema.
*   **Privilegios Inseguros**: El endpoint `/api/n8n/tutor-callback` permite la escalada de privilegios a través de un secreto compartido en un webhook. Si este secreto se filtra, cualquier usuario puede convertirse en profesor o administrador.

## 2. Deuda Arquitectónica Masiva
*   **Embebido de Repositorios Externos**: La carpeta `src/lib/ai/repositories` contiene 29MB de código del `claude-cookbook`. Esto incrementa el tamaño del bundle, dificulta las auditorías y crea un mantenimiento insostenible al no usar un gestor de dependencias adecuado para estos recursos.
*   **Acoplamiento Externo**: La lógica de negocio fundamental (aprobación de tutores) depende de un servicio de automatización externo (n8n), creando un punto único de fallo fuera del control del servidor principal.

## 3. Falta de Enfoque en el Producto
*   **Inconsistencia de Agentes**: La inclusión de "Nutrirecetas" en una plataforma de educación académica es un ejemplo claro de "feature creep". Desvía la atención del usuario y de los desarrolladores del valor principal del producto.

## 4. Riesgos de Rendimiento en Móvil
*   **Sobrecarga de Animaciones**: El uso intensivo de Framer Motion y componentes complejos como `NotebookWhiteboard` afectará negativamente el rendimiento en dispositivos móviles de gama media/baja a través de Capacitor.
*   **Gestión de Estado**: La combinación de Jotai y Supabase Realtime carece de una estrategia clara de resolución de conflictos, lo que podría llevar a inconsistencias en la interfaz de usuario en condiciones de red inestables.

## Recomendaciones
1.  **Eliminar "Nutrirecetas"** para enfocar el producto.
2.  **Mover la lógica de aprobación** a Server Actions protegidas o Supabase Edge Functions.
3.  **Limpiar `src/lib/ai/repositories`** y referenciar recursos externos de forma modular.
4.  **Implementar una capa de seguridad LLM** (ej. Gemini Flash) para inspeccionar intenciones en JarvisGuard.
