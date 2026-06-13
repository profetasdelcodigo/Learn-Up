# Blueprint Make.com - Aprobación de Docentes (Yoti)

Este flujo envía un correo a los usuarios que desean ser profesores, pidiendo su verificación en Yoti, y luego de aprobados, cambia su rol en Supabase.

## Pasos para armar el escenario en Make.com:

### Módulo 1: Webhook Personalizado (El Gatillo)
1. Agrega el módulo **Webhooks** -> "Custom Webhook".
2. Crea un nuevo webhook llamado "Learn Up - Tutor Request".
3. **Copia la URL** que te da Make (ej. `https://hook.us1.make.com/xxxxxx`).
4. En el código de Next.js (`src/app/api/tutor-request/route.ts`), pegarás esa URL para que envíe el correo del usuario (`email`) y su ID (`userId`).

### Módulo 2: Enviar Correo Electrónico (Email o Gmail)
1. Conecta el módulo 1 al módulo **Email** -> "Send an email" (o usa Gmail si lo prefieres).
2. **To:** Selecciona el `email` que viene del Webhook (Módulo 1).
3. **Subject:** `Verifica tu identidad con Yoti para ser Docente`
4. **Content (HTML):**
   ```html
   <h2>¡Hola! Gracias por querer ser docente en Learn Up.</h2>
   <p>Para asegurar la calidad, necesitamos verificar tu identidad.</p>
   <p><a href="https://yoti.com/verificar">Haz clic aquí para verificar con Yoti</a></p>
   ```

### Módulo 3: Webhook de Respuesta (Yoti Callback)
*Nota: Este webhook será independiente o puedes conectarlo con un "Router" si Yoti envía una petición HTTP directamente a Make.*
1. Si Yoti envía un POST a Make cuando el usuario pasa la prueba, crea otro **Custom Webhook** para recibir esa alerta.

### Módulo 4: HTTP Request (Cambio de Rol en Supabase)
1. Agrega el módulo **HTTP** -> "Make a request".
2. **URL:** `https://TU_PROYECTO.supabase.co/rest/v1/profiles?id=eq.{{ID_DEL_USUARIO}}`
3. **Method:** `PATCH`
4. **Headers:**
   - `apikey`: `TU_SUPABASE_SERVICE_KEY`
   - `Authorization`: `Bearer TU_SUPABASE_SERVICE_KEY`
   - `Content-Type`: `application/json`
   - `Prefer`: `return=minimal`
5. **Body type:** `Raw` -> `JSON`
6. **Request content:**
   ```json
   {
     "role": "profesor"
   }
   ```

### Módulo 5: Enviar Correo de Felicitaciones
1. Agrega otro módulo de **Email** notificando al usuario que su solicitud fue aprobada.

¡Listo! Activa el escenario y procesará todo en la nube, sin depender de que tu computadora esté encendida.
