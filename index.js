import pkg from 'hnswlib-node';
const { HierarchicalNSW } = pkg;
import { pipeline } from "@xenova/transformers";
import pkgllama from 'llama-node';
const { Llama } = pkgllama;
import { getLlama, LlamaChatSession } from 'node-llama-cpp';
import path from 'path';
import { fileURLToPath } from 'url';
//BASE DE DATOS DE PRUEBA
import { products } from './bd.js'
import readline from 'readline';
import { extractVolumeFilters, extractCategoryFilters } from './helpers/filters.js';




// Configuracion de rutas
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Historial Global para chatbot
let conversationHistory = [];

// Crear interfaz de lectura de consola
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});





// Configurar embeddings (MiniLM)
console.log("Cargando MiniLM para embeddings...");
const embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L12-v2");

// Funcion para convertir a vectores
async function getEmbedding(text) {
  const output = await embedder(text); // pipeline feature-extraction
  // output: { data, dims } donde dims = [1, tokens, hidden_size=768]

  const { data, dims } = output;
  const [batch, tokens, hiddenSize] = dims;

  // reconstruir tokens x hiddenSize
  const matrix = [];
  for (let i = 0; i < tokens; i++) {
    matrix.push(data.slice(i * hiddenSize, (i + 1) * hiddenSize));
  }

  // promedio de todos los tokens → vector 768D
  const vector = new Float32Array(hiddenSize);
  for (let i = 0; i < hiddenSize; i++) {
    let sum = 0;
    for (let j = 0; j < tokens; j++) {
      sum += matrix[j][i];
    }
    vector[i] = sum / tokens;
  }

  return vector; // listo para indexar en HNSW
}


console.log("Cargando HNSW...")
// Configurar HNSW, Agregando y convirtiendo a vectores los productos
const dim = 384;
const space = "cosine";
const hnsw = new HierarchicalNSW(space, dim);
hnsw.initIndex(products.length);

// Agregar productos al índice con HNSW
for (const product of products) {
  const vector = await getEmbedding(product.description);
  hnsw.addPoint(Array.from(vector), product.id);
}



console.log("Cargando LLM llama-node")
// Configurar LLM local (llama-node)
const llama = await getLlama();
const model = await llama.loadModel({
  modelPath: path.join(__dirname, 'models', 'llama-3.2-3b-instruct-q4_k_m.gguf')
});
const context = await model.createContext();
const session = new LlamaChatSession({ contextSequence: context.getSequence() });


//Función de recomendación
// ------------------------
async function recommendProducts(query) {
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

  // 3. Guardar en historial la consulta del usuario
  conversationHistory.push({ role: "user", content: query });


  // 6. Preparar prompt (si vas a usar LLaMA u otro modelo después)
  /*const prompt = `
Eres un asistente que recomienda productos. 
Pregunta del cliente: "${query}"
Productos recomendados:(Cada producto va separado por un punto y coma) ${recommended.map(p => p.name +" "+p.description).join('; ')}
Responde en español de manera amigable y útil.
  `;*/

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
${recommended.map(p => p.name + " " + p.description + " " + p.price).join("; ")}
  `;
  }

  console.log("Prompt:", prompt);

  const answer = await session.prompt(prompt);

  // 6. Guardar respuesta en historial
  conversationHistory.push({ role: "assistant", content: answer });

  return answer;

  //return recommended; // si quieres solo probar
}


// Función para preguntar de manera recursiva
const askQuery = () => {
  rl.question('Escribe tu consulta: ', async (query) => {
    if (query.toLowerCase() === 'salir') {
      console.log('Saliendo...');
      rl.close();
      return;
    }

    try {
      console.time("tiempo_ejecucion");
      const recommended = await recommendProducts(query);
      console.log('\x1b[33m----- RESPUESTA DE CHATBOT-----');
      console.log(recommended + '\x1b[0m');
      console.timeEnd("tiempo_ejecucion");
    } catch (err) {
      console.error('Error al recomendar productos:', err);
    }

    // Volver a preguntar
    askQuery();
  });
};

// Iniciar ciclo de preguntas
askQuery();



