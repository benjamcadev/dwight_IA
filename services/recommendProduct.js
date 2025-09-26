import { getEmbedding } from '../helpers/embeddings.js'
import { conversationHistory, MAX_MESSAGES } from '../config/constants.js'
import { isAmbiguousQuery, normalizeText, extractJSON } from '../helpers/queryUtils.js';
import { noProductFindPrompt, recommendProductPrompt, summarizeHistory } from '../prompts/prompts.js';
import { createSession } from '../models/gemma.js'
import { numCpus } from '../config/constants.js';

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


  // --- Buscar k productos más cercanos --- 
  const k = 10; // cantidad de productos que devuelve el vector
  const result = hnsw.searchKnn(Array.from(queryVector), k);

  // Mapear vecinos y calcular similitud coseno
  let recommendedByHNSW = result.neighbors
    .map((id, i) => {
      const p = products.find(prod => prod.id === id);
      return { ...p, score: cosineSimilarity(queryVector, p.embedding) };
    });

  // Filtrar por umbral mínimo
  const threshold = 0.81;
  recommendedByHNSW = recommendedByHNSW
    .filter(p => p.score >= threshold)
    .sort((a, b) => b.score - a.score);

  // 4Opcional: si quieres también usar scoredProducts (todo el catálogo)
  // Solo si tienes pocos productos o quieres máxima exhaustividad
  const recommendedByScore = scoredProducts
    .filter(p => p.score >= threshold)
    .sort((a, b) => b.score - a.score);

  // Combinar evitando duplicados
  const recommended = [
    ...recommendedByScore,
    ...recommendedByHNSW.filter(p => !recommendedByScore.some(r => r.id === p.id))
  ].slice(0, 3); // limitar top-10 de prodcutos



  // --- Si no hay coincidencias, usar LLM para respuesta amable ---
  if (recommended.length === 0) {
    const llmPrompt = await noProductFindPrompt(query);
    const objectResponse = await responsePrompt(session, llmPrompt, conversationHistory)

    return objectResponse;
  }

  // Guardar en historial la consulta del usuario
  conversationHistory.push({ role: "user", content: query });

  // Armar prompt con TODO el historial
  let prompt;

  try {
    prompt = await recommendProductPrompt(query, recommended, conversationHistory);
  } catch (error) {
    console.log("Hubo error al recommendProdcuts: ", error)
  }

  // Valida la cantidad de interacciones entre user y chatbot
  if (conversationHistory.length >= MAX_MESSAGES) {
    console.log("\x1b[31mHistorial muy largo, creando resumen...\x1b[0m")

    const summaryPrompt = await summarizeHistory(conversationHistory);

    const summary = await session.prompt(summaryPrompt, {top_p: 0.9});
    const summaryMessage = { role: "system", content: `Resumen de la conversación: ${summary}`, };

    // Mantienes solo últimos 2 mensajes + el resumen
    const recentMessages = conversationHistory.slice(-2);
    // Vaciar el array y meter el nuevo contenido
    conversationHistory.splice(0, conversationHistory.length, summaryMessage, ...recentMessages);

    // reiniciar la sesion del modelo ya que puede olvidar
    console.log("\x1b[31mReiniciando modelo LLM...\x1b[0m")
    session = await createSession();

  }

  const objectResponse = await responsePrompt(session, prompt, conversationHistory)

  return objectResponse;

}

async function responsePrompt(session, prompt, conversationHistory) {

  console.log("\x1b[31mResponsePrompt:\x1b[0m")
  console.log("\x1b[31mPrompt:\x1b[0m", prompt)
  console.log("\x1b[31mconversationHistory:\x1b[0m", conversationHistory)

    const raw = await session.prompt(prompt, {
      n_predict: 550,
      temperature: 0.5,
      top_p: 0.9,
      repeat_penalty: 1.5
    })
  

  console.log("\x1b[31mRespuesta de IA:  \x1b[0m", raw)


  let data;
  try {
    data = extractJSON(raw);
  } catch (error) {
    data = { answer: error, products: [], closing: "" };
  }

  const objectResponse = {
    answer: data.answer,
    products: data.products ? data.products : [],
    closing: data.closing ? data.closing : ''
  }

  console.log("RESPUESTA EN OBJECT : ", objectResponse)

  //  Guardar respuesta en historial
  //conversationHistory.push({ role: "assistant", content: objectResponse.answer + " Productos: " + objectResponse.products.map(p => p.name).join(";") });
  conversationHistory.push({ role: "assistant", content: objectResponse.answer });

  return objectResponse
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