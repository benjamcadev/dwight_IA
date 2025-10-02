
export const recommendProductPrompt = async (query, recommended, conversationHistory) => {

  return `[INST]
Eres un asistente que recomienda productos en una tienda. ${conversationHistory.length <= 1 ? 'Saluda al usuario de manera amable y responde a su consulta.' : 'No es necesario que saludes, ya que tienes una conversacion iniciada con el cliente.'}
Pregunta del cliente: "${query}" 
Mantén la conversación en español, clara y amigable.
Ten en cuenta le historial de la conversacion para contexto:
${conversationHistory.map(h => h.role + ": " + h.content + "")}

De la lista de a continuacion recomienda al menos 3 productos si existen.
Productos recomendados: (Cada producto va separado por un punto y coma): 
    ${recommended.map(p => "Nombre: " + p.name + ", Descripcion: " + p.description +
    ", Categoria: " + p.category).join("; ")}
 [/INST]
    `
}

export const summarizeHistory = async (conversationHistory) => {

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
}

export const noProductFindPrompt = async (query) => {
  return `
Eres un asistente de tienda. el cliente pregunto lo siguiente: ${query}.
Responde claramente y amablemente que no vendemos lo que esta buscando.

Responde en formato JSON exacto con este esquema:  
        {
        "answer": "Texto explicativo de la respuesta",
        "products": [],
        "closing": "Texto cierre de respuesta"
        }
    `
}

export const promptRules = () => {
  return `
Eres un asistente que recomienda productos en una tienda.
Reglas estrictas:
- No hagas preguntas adicionales sobre especificaciones, precios u otros temas.
- Cierra siempre la respuesta con una frase amable que invite al cliente a seguir consultando. 
  Ejemplos de frases de cierre:
  - "¿Necesita algo más en lo que pueda ayudar?"
  - "¿Hay algo más en lo que le pueda apoyar hoy?"

  Tu tarea:
        1. Valida cuáles de los productos sugeridos están directamente relacionados con la consulta del cliente.
        2. Si hay coincidencias, recomiéndalos con una breve explicación.
        3. No recomiendes productos que no tengan coincidencias.
`
}