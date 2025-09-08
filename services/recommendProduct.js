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

  let queryVector;

  // --- Detectar si la query es ambigua ---
  if (isAmbiguousQuery(query)) {
    console.log("⚠️ Query ambigua detectada, usando categoría previa");
    queryVector = session.lastCategoryVector;
  } else {
    queryVector = await getEmbedding(query);
    session.lastCategoryVector = queryVector;
  }


  // --- Buscar k productos más cercanos --- 
  const k = 15; // cantidad de productos que devuelve el vector
  const result = hnsw.searchKnn(Array.from(queryVector), k);

  // Calcular score de similitud coseno para cada resultado
  const rescored = result.neighbors.map(id => {
    const product = products.find(p => p.id === id);
    const productVector = hnsw.getPoint(id); // Recupera el vector del índice

    return {
      ...product,
      score: cosineSimilarity(queryVector, productVector)
    };
  });

  // Ordenar por score descendente
  rescored.sort((a, b) => b.score - a.score);

  // Filtro: solo productos con score > 0.70
  const filtered = rescored.filter(r => r.score >= 0.70);

  console.log(filtered)




  let recommended = result.neighbors.map(id => products.find(p => p.id === id));

  console.log("Productos recomendados: ", recommended)

  // 3. Extraer filtros desde el query
  const volumeFilters = extractVolumeFilters(query);
  const categoryFilters = extractCategoryFilters(query);
  const filters = { ...volumeFilters, ...categoryFilters };


  // 4. Aplicar filtros
  if (filters.exact_volume_ml) {
    // Primero intentamos encontrar coincidencias exactas
    const exactMatches = recommended.filter(
      p => p.capacity_ml && p.capacity_ml === filters.exact_volume_ml
    );
    if (exactMatches.length > 0) {
      recommended = exactMatches;
    }
  }

  if (filters.min_volume_ml) {
    recommended = recommended.filter(
      p => p.capacity_ml && p.capacity_ml >= filters.min_volume_ml
    );
  }

  if (filters.max_volume_ml) {
    recommended = recommended.filter(
      p => p.capacity_ml && p.capacity_ml <= filters.max_volume_ml
    );
  }

  if (filters.category) {
    recommended = recommended.filter(
      p => p.category && p.category.toLowerCase().includes(filters.category.toLowerCase())
    );
  }


  // 5. Si después de filtrar no queda nada → devolvemos el más parecido semánticamente
  if (recommended.length === 0) {
    recommended = [products.find(p => p.id === result.neighbors[0])];
  }

  //console.log("Productos despues de los filtros: ", recommended)

  //  Solo top-5 productos para no sobrecargar el prompt
  recommended = recommended.slice(0, 10);



  // 3. Guardar en historial la consulta del usuario
  conversationHistory.push({ role: "user", content: query });

  // 4. Armar prompt con TODO el historial
  let prompt;

  if (conversationHistory.length <= 1) {
    // Primera interacción
    prompt = `
Eres un asistente que recomienda productos.
Pregunta del cliente: "${query}" 
Saluda al usuario de manera amable y responde a su consulta.
Mantén la conversación en español, clara y amigable.

Productos recomendados: (Cada producto va separado por un punto y coma): 
${recommended.map(p => "Nombre: " + p.name + " Descripcion: " + p.additional_information + " Categoria: " + p.category + " Precio: " + p.price).join("; ")}
  `;
  } else {
    // Conversación en curso
    prompt = `
Eres un asistente que recomienda productos. No es necesario que saludes, ya que tienes una conversacion iniciada con el cliente.
Pregunta del cliente: "${query}" 
Mantén una conversación en español de manera amigable y útil.
Toma en cuenta el historial para dar respuestas consistentes.

Historial:
${conversationHistory.map(m => `${m.role}: ${m.content}`).join("\n")}

Productos recomendados: (Cada producto va separado por un punto y coma): 
${recommended.map(p => "Nombre: " + p.name + " Descripcion: " + p.additional_information + " Categoria: " + p.category + " Precio: " + p.price).join("; ")}
  `;
  }


  // Valida la cantidad de interacciones entre user y chatbot
  if (conversationHistory.length >= MAX_MESSAGES) {
    console.log("Historial muy largo, creando resumen...");

    const summaryMessage = await summarizeHistory(conversationHistory, session);

    // Mantienes solo últimos 5 mensajes + el resumen
    const recentMessages = conversationHistory.slice(-5);
    conversationHistory = [summaryMessage, ...recentMessages];
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