export async function summarizeHistory(conversationHistory, session) {
  const textToSummarize = conversationHistory
    .map(m => `${m.role}: ${m.content}`)
    .join("\n");

  const prompt = `
Resume la siguiente conversación entre un cliente y un asistente en máximo 8 oraciones.
El resumen debe mantener:
- Intención principal del cliente
- Productos mencionados
- Restricciones o preferencias clave (ej: volumen, categoría, precio)

Conversación:
${textToSummarize}
  `;

  const summary = await session.prompt(prompt);

  return {
    role: "system",
    content: `Resumen de la conversación: ${summary}`,
  };
}
