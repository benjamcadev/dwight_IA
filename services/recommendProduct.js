import { getEmbedding } from '../helpers/embeddings.js'
import { conversationHistory, MAX_MESSAGES } from '../config/constants.js'
import { summarizeHistory } from '../helpers/historyMessages.js'
import { isAmbiguousQuery, normalizeText, extractJSON } from '../helpers/queryUtils.js';
import { firstRecommendProductPrompt, noProductFindPrompt, recommendProductPrompt } from '../prompts/prompts.js';


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
  const threshold = 0.80; // ajustable según necesidad
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
    const llmPrompt = await noProductFindPrompt(query);
    const llmResponse = await session.prompt(llmPrompt);
    return llmResponse;
  }


  //  Solo top-10 productos para no sobrecargar el prompt
  recommended = recommended.slice(0, 10);

  //console.log("Productos recomendados: ", recommended)

  // Guardar en historial la consulta del usuario
  conversationHistory.push({ role: "user", content: query });

  // Armar prompt con TODO el historial
  let prompt;

  if (conversationHistory.length <= 1) {
    // Primera interacción
    try {
      prompt = await firstRecommendProductPrompt(query, recommended);
    } catch (error) {
      console.log("Hubo error al firstRecommendProduct: ", error)
    }
    
  } else {
    // Conversación en curso
    try {
       prompt = await recommendProductPrompt(query, recommended, conversationHistory);
    } catch (error) {
      console.log("Hubo error al recommendProdcuts: ", error)
    }
   

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

  //console.log("Prompt:", prompt);

  const raw = await session.prompt(prompt, {
    nBatch: 8 // default es 8 o 16
  });

  const data = extractJSON(raw);

  console.log("RESPUESTA DEL LLM:  ", raw)

  const objectResponse = {
    answer: data.answer,
    products: data.products ? data.products : [],
    closing: data.closing ? data.closing : ''
  }

  console.log("RESPUESTA EN OBJECT : ", objectResponse)

  // 6. Guardar respuesta en historial
  conversationHistory.push({ role: "assistant", content: objectResponse.answer + " Productos: " +objectResponse.products.map(p => p.name).join(";") });

  return objectResponse;

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