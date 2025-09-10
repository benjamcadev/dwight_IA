import { getEmbedding } from '../helpers/embeddings.js'
import { extractVolumeFilters, extractCategoryFilters } from '../helpers/filters.js';
import { conversationHistory, MAX_MESSAGES } from '../config/constants.js'
import { summarizeHistory } from '../helpers/historyMessages.js'
import { isAmbiguousQuery, normalizeText } from '../helpers/queryUtils.js';


//Función de recomendación
// ------------------------
export async function recommendProducts(query, hnsw, products, session) {

  // --- Normalizar query ---
  query = normalizeText(query)

  // --- Detectar si la query es ambigua ---
  let queryVector;

  if (isAmbiguousQuery(query)) {
    // Query ambigua, detectar si ya se ha hablado de un producto anterior
    if (session.lastCategoryVector) {
      queryVector = session.lastCategoryVector;
    } else { //Se ha detectado query ambigua sin previo contexto
      return 'Hola, necesito mas detalles de que producto estas buscando porfavor.'
    }
  } else {
    queryVector = await getEmbedding(query);
    session.lastCategoryVector = queryVector;
  }


  // --- Calcular similitud coseno con todos los productos ---
  const scoredProducts = products.map(p => ({
    ...p,
    score: cosineSimilarity(queryVector, p.embedding)
  }));

  // --- Filtrar por un umbral mínimo de similitud ---
  const threshold = 0.75; // ajustable según necesidad
  let recommendedByScore = scoredProducts
    .filter(p => p.score >= threshold)
    .sort((a, b) => b.score - a.score);


  // --- Buscar k productos más cercanos --- 
  const k = 10; // cantidad de productos que devuelve el vector
  const result = hnsw.searchKnn(Array.from(queryVector), k);

  const recommendedByHNSW = result.neighbors.map(id => products.find(p => p.id === id));

  // --- Combinar y evitar duplicados ---
  let recommended = [
    ...recommendedByScore,
    ...recommendedByHNSW.filter(p => !recommendedByScore.some(r => r.id === p.id))
  ];


  // --- Si no hay coincidencias, usar LLM para respuesta amable ---
  if (recommended.length === 0) {
    const llmPrompt = `
Eres un asistente de tienda. Solo vendemos productos en estas categorías:
AGRÍCOLA, ALUMINIO, ASEO Y LIMPIEZA, BATERIAS, BOLSAS, COTILLÓN, ECOLÓGICO, ELECTRODOMÉSTICOS, ELEMENTOS DE PROTECCIÓN, EMBALAJES Y ETIQUETAS, ENVASES, EQUIPAMIENTO GASTRONÓMICO, ESPUMADO, FLORERÍA, FRASCOS Y BOTELLAS, KRAFT, LIBRERÍA, MAQUINARIA INDUSTRIAL, MOLDES, PLÁSTICO, REPOSTERÍA, TISSUE, VASOS / CUBIERTOS, PAPELERIA, ARTE Y MANUALIDADES.
Si el usuario pregunta por un producto que no tenemos, responde claramente y amablemente que no lo vendemos, y luego pregunta si puede ayudar en algo más.

Usuario: "${query}"
Respuesta:
    `;
    const llmResponse = await session.prompt(llmPrompt);
    return llmResponse;
  }


  //  Solo top-10 productos para no sobrecargar el prompt
  recommended = recommended.slice(0, 10);

  // Guardar en historial la consulta del usuario
  conversationHistory.push({ role: "user", content: query });

  // Armar prompt con TODO el historial
  let prompt;

  if (conversationHistory.length <= 1) {
    // Primera interacción
    prompt = `
Eres un asistente que recomienda productos.
Pregunta del cliente: "${query}" 
Saluda al usuario de manera amable y responde a su consulta.
Mantén la conversación en español, clara y amigable.

Reglas estrictas:
- Solo puedes recomendar productos que estén directamente relacionados con la consulta del cliente.
- No hagas preguntas adicionales sobre especificaciones, precios u otros temas.
- Cierra siempre la respuesta con una frase amable que invite al cliente a seguir consultando. 
  Ejemplos de frases de cierre (elige una o genera una variante similar):
  - "¿Necesita algo más en lo que pueda ayudar?"
  - "¿Hay algo más en lo que le pueda apoyar hoy?"
  - "¿Quiere que le muestre otras opciones relacionadas?"
  - "¿Le puedo ayudar con algo más?"


Productos recomendados: (Cada producto va separado por un punto y coma): 
${recommended.map(p => "Nombre: " + p.name + " Descripcion: " + p.description + " Informacion Adicional: " + p.additional_information + " Categoria: " + p.category + " Precio: " + p.price).join("; ")}
  `;
  } else {
    // Conversación en curso
    prompt = `
Eres un asistente que recomienda productos. No es necesario que saludes, ya que tienes una conversacion iniciada con el cliente.
Pregunta del cliente: "${query}" 
Mantén una conversación en español de manera amigable y útil.

Reglas estrictas:
- Solo puedes recomendar productos que estén directamente relacionados con la consulta del cliente.
- No hagas preguntas adicionales sobre especificaciones, precios u otros temas.
- Cierra siempre la respuesta con una frase amable que invite al cliente a seguir consultando. 
  Ejemplos de frases de cierre (elige una o genera una variante similar):
  - "¿Necesita algo más en lo que pueda ayudar?"
  - "¿Hay algo más en lo que le pueda apoyar hoy?"
  - "¿Quiere que le muestre otras opciones relacionadas?"
  - "¿Le puedo ayudar con algo más?"

Toma en cuenta el historial para dar respuestas consistentes.

Historial:
${conversationHistory.map(m => `${m.role}: ${m.content}`).join("\n")}

Productos recomendados: (Cada producto va separado por un punto y coma): 
${recommended.map(p => "Nombre: " + p.name + " Descripcion: " + p.description + " Informacion Adicional: " + p.additional_information + " Categoria: " + p.category + " Precio: " + p.price).join("; ")}
  `;
  }


  // Valida la cantidad de interacciones entre user y chatbot
  if (conversationHistory.length >= MAX_MESSAGES) {
    console.log("Historial muy largo, creando resumen...");

    const summaryMessage = await summarizeHistory(conversationHistory, session);

    // Mantienes solo últimos 5 mensajes + el resumen
    const recentMessages = conversationHistory.slice(-5);
    // Vaciar el array y meter el nuevo contenido
    conversationHistory.splice(0, conversationHistory.length, summaryMessage, ...recentMessages);
  }

  console.log("Prompt:", prompt);

  const answer = await session.prompt(prompt, {
    nBatch: 8 // default es 8 o 16
  });


  // 6. Guardar respuesta en historial
  conversationHistory.push({ role: "assistant", content: answer });

  return answer;

  //return recommended; // si quieres solo probar
}


function cosineSimilarity(vecA, vecB) {
  let dot = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}