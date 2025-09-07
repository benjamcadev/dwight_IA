import { getEmbedding } from '../helpers/embeddings.js'
import { extractVolumeFilters, extractCategoryFilters } from '../helpers/filters.js';
import { conversationHistory , MAX_MESSAGES} from '../config/constants.js'
import { summarizeHistory } from '../helpers/historyMessages.js'

//Función de recomendación
// ------------------------
export async function recommendProducts(query, hnsw, products, session) {
    console.log(hnsw)
  // 1. Generar embedding de la consulta
  const queryVector = await getEmbedding(query);

  // 2. Buscar k productos más cercanos
  const k = 10; // un poco más grande para que después filtres mejor
  const result = hnsw.searchKnn(Array.from(queryVector), k);
  let recommended = result.neighbors.map(id => products.find(p => p.id === id));

  //console.log("Candidatos iniciales:", recommended);

  // 3. Extraer filtros desde el query
  const volumeFilters = extractVolumeFilters(query);
  const categoryFilters = extractCategoryFilters(query);
  const filters = { ...volumeFilters, ...categoryFilters };

  //console.log("Filtros detectados:", filters);

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

  //  Solo top-5 productos para no sobrecargar el prompt
  recommended = recommended.slice(0, 5);



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
${recommended.map(p => p.name + " " + p.description).join("; ")}
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
${recommended.map(p => "Nombre: " + p.name + "Descripcion: " + p.description + "Precio: " + p.price).join("; ")}
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