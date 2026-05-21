const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/actions/ai-tutor.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 1. YouTube en buildUserMessage
content = content.replace(
`  let finalMessageContent: string | any[] = message;
  let finalModel = MODEL;

  if (mediaUrl) {
    // If it's a Youtube Video, try to extract transcript
    if (mediaUrl.includes("youtube.com") || mediaUrl.includes("youtu.be")) {
      const transcript = await parseMediaInput(mediaUrl, "video");
      if (transcript) {
        finalMessageContent = \`\${message || "Analiza este video de YouTube."}\\n\\n[Transcripción del video]:\\n\${transcript}\`;
      }
    } else {`,
`  let finalMessageContent: string | any[] = message;
  let finalModel = MODEL;
  let extraText = "";

  if (typeof message === "string") {
    const ytRegex = /(https?:\\/\\/(www\\.)?(youtube\\.com|youtu\\.be)\\/[^\\s]+)/g;
    const ytMatch = message.match(ytRegex);
    if (ytMatch) {
      const transcript = await parseMediaInput(ytMatch[0], "video");
      if (transcript) extraText += \`\\n\\n[Transcripción del video en el enlace]:\\n\${transcript}\`;
    }
  }

  if (mediaUrl) {
    if (mediaUrl.includes("youtube.com") || mediaUrl.includes("youtu.be")) {
      const transcript = await parseMediaInput(mediaUrl, "video");
      if (transcript) {
        finalMessageContent = \`\${message || "Analiza este video de YouTube."}\${extraText}\\n\\n[Transcripción del video]:\\n\${transcript}\`;
      }
    } else {`
);

content = content.replace(
`      finalMessageContent = [
        { type: "text", text: message || "Analiza el siguiente archivo adjunto y responde a lo que se te pide." },
        { type: "file_url", file_url: { url: mediaUrl } },
      ];
    }
  }

  return { content: finalMessageContent, model: finalModel };`,
`      finalMessageContent = [
        { type: "text", text: (message || "Analiza el siguiente archivo adjunto y responde a lo que se te pide.") + extraText },
        { type: "file_url", file_url: { url: mediaUrl } },
      ];
    }
  } else {
    finalMessageContent = typeof finalMessageContent === "string" ? finalMessageContent + extraText : finalMessageContent;
  }

  return { content: finalMessageContent, model: finalModel };`
);

// 2. Ask Professor
content = content.replace(
`      return {
        response: "",
        error: "Por favor escribe una pregunta o envía un archivo",
      };

    const systemPrompt = \`\${getTimeContext()}`,
`      return {
        response: "",
        error: "Por favor escribe una pregunta o envía un archivo",
      };

    const isShortGreeting = message.trim().length < 25 && !message.includes("?") && /^(hola|buenas|hey|buenos dias|buenas tardes|que tal|como estas)/i.test(message.trim());
    const toolDefs = isShortGreeting ? "" : \`\\n\${TOOL_DEFINITIONS}\`;

    const systemPrompt = \`\${getTimeContext()}`
);

content = content.replace(
`
\${TOOL_DEFINITIONS}\`;

    const { content: finalMessageContent, model: finalModel } =`,
`
\${toolDefs}\`;

    const { content: finalMessageContent, model: finalModel } =`
);

// 3. Nutrirecetas
content = content.replace(
`Eres "Chef Nutre", el chef nutricionista de Learn Up. Eres un cocinero apasionado que hace magia con pocos ingredientes y se preocupa por la salud de los estudiantes.

PERSONALIDAD:
- Eres entusiasta y creativo. Adaptas recetas a lo que el estudiante tiene disponible.
- Hablas como un chef amigable, no como un libro de cocina aburrido.
- Si los ingredientes son pocos, haces maravillas. Nada de decir "necesitas más cosas".

FORMATO DE RESPUESTA:
1. 🍽️ Nombre creativo del plato
2. 📝 Ingredientes con cantidades exactas
3. 👨‍🍳 Pasos claros y numerados (fáciles de seguir)
4. ⏰ Tiempo de preparación
5. 💪 Info nutricional aproximada (calorías, proteínas)
6. 💡 Tip extra o variación

- Si el usuario sube una foto de ingredientes, identifícalos y crea la receta.
- Siempre en español. Emojis de comida bienvenidos 🍳🥗🔥.

INSTRUCCIÓN ESPECIAL:
- Al final de tu respuesta, SIEMPRE incluye una imagen del plato usando este formato Markdown.
- Para la URL, usa "https://image.pollinations.ai/prompt/un_plato_delicioso_de_[NOMBRE_DEL_PLATO_EN_INGLES]_fotografia_profesional_de_comida?width=800&height=600&nologo=true".
- Ejemplo: ![Tacos al Pastor](https://image.pollinations.ai/prompt/delicious_mexican_tacos_al_pastor_professional_food_photography?width=800&height=600&nologo=true)\`;`,
`Eres "Chef Nutre", el chef nutricionista de Learn Up. Haces magia con lo que hay.

PERSONALIDAD:
- Eres entusiasta y muy preciso. Si el estudiante pide una receta específica, dale exactamente lo que pide.
- Si los ingredientes son pocos, dales un buen uso y propón algo rico.
- No uses la herramienta web, basa tu respuesta en tu conocimiento.

FORMATO ESTRICTO DE RESPUESTA:
- La primera línea de tu respuesta DEBE ser el nombre del plato, empezando por "🍽️ " (Ej: "🍽️ Tacos al Pastor"). ESTO ES VITAL.
- Luego, en el resto de líneas:
1. 📝 Ingredientes con cantidades exactas
2. 👨‍🍳 Pasos claros y numerados
3. ⏰ Tiempo de preparación y 💪 Info nutricional

¡Responde en español y no incluyas markdown de imágenes tú mismo!\`;`
);

content = content.replace(
`    const response = await getAICompletion(
      [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: finalMessageContent },
      ],
      finalModel,
    );

    return { response: response.choices[0]?.message?.content || "" };
  } catch (error: any) {
    console.error("Error en generateRecipe:", error);`,
`    const response = await getAICompletion(
      [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: finalMessageContent },
      ],
      finalModel,
    );

    let finalResponse = response.choices[0]?.message?.content || "";
    
    // Extract dish name to fetch real image from Unsplash
    const firstLine = finalResponse.split("\\n")[0] || "";
    const dishMatch = firstLine.match(/🍽️\\s*(.*)/);
    if (dishMatch && dishMatch[1]) {
      const dishName = dishMatch[1].replace(/\\*/g, '').trim();
      const { searchRecipeImage } = await import("@/lib/unsplash");
      const imageUrl = await searchRecipeImage(dishName);
      if (imageUrl) {
        finalResponse += \`\\n\\n![\${dishName}](\${imageUrl})\`;
      }
    }

    return { response: finalResponse };
  } catch (error: any) {
    console.error("Error en generateRecipe:", error);`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Parche aplicado correctamente');
