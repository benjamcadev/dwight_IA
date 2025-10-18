
export const recommendProductPrompt = async (query, recommended) => {

  return `[INST]
Eres un asistente que recomienda productos en una tienda, responde de forma amable al cliente.}
Pregunta del cliente: "${query}" 
Mantén la conversación en español, clara y amigable.

Debes recomendar al menos 3 productos de la siguiente lista.
Productos recomendados:
${recommended.map((p, i) => `${i + 1}. Nombre: ${p.name}, Descripción: ${p.description}, Categoría: ${p.category}`).join("\n")}"
[/INST]`
}

/*export const summarizeHistory = async (conversationHistory) => {

  const textToSummarize = conversationHistory
    .map(m => `${m.role}: ${m.content}`)
    .join("\n");

    const prompt = `
  Resume la siguiente conversación entre un cliente y un asistente en máximo de 5 lineas.
  El resumen debe mantener:
  - Intención principal del cliente
  - Productos mencionados
  - Restricciones o preferencias clave (ej: volumen, categoría, precio)

  Conversación:
  ${textToSummarize}
    `;

  return prompt
}*/

export const noProductFindPrompt = async (query) => {
  return `
Eres un asistente de tienda. el cliente pregunto lo siguiente: ${query}.
Responde amablemente que no vendemos lo que esta buscando y no agregues alguna pregunta al cierre.
    `
}

export const promptRules = () => {
  return `
Eres un asistente que recomienda productos en una tienda.
Reglas estrictas:
- No hagas preguntas adicionales sobre especificaciones, precios u otros temas.
- Valida que los productos recomendados en el prompt tengan relacion con la pregunta del cliente, si no tiene relacion contesta que no tenemos el producto de forma amable
- Cierra siempre la respuesta con una frase amable que invite al cliente a seguir consultando. 
  Ejemplos de frases de cierre:
  - "¿Necesita algo más en lo que pueda ayudar?"
  - "¿Hay algo más en lo que le pueda apoyar hoy?"

  Tu tarea:
        1. Valida cuáles de los productos sugeridos están directamente relacionados con la consulta del cliente.
        2. Si hay coincidencias, recomiéndalos con una breve explicación.
        3. No recomiendes productos que no tengan coincidencias.
        4. No respondas en formato JSON
        5. Comienza la respuesta de inmediato hablandole al cliente.
`
}