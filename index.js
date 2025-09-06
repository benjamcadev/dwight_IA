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
import { parseFiltersFromQuery } from './helpers/filters.js';




// Configuracion de rutas
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Crear interfaz de lectura de consola
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});


console.time("tiempo_ejecucion");


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
    // Generar embedding de la consulta
    const queryVector = await getEmbedding(query);

    // Buscar k productos más cercanos
    const k = 5;
    const result = hnsw.searchKnn(Array.from(queryVector), k);
    const recommended = result.neighbors.map(id => products.find(p => p.id === id));

    console.log(recommended)

     //Extraer filtros desde el query
  const filters = parseFiltersFromQuery(query);

  console.log("Filtros: ",filters)

  // 4. Aplicar filtros si existen
  if (filters.capacity_ml) {
    recommended = recommended.filter(p => p.capacity_ml && p.capacity_ml <= filters.capacity_ml);
  }
  if (filters.price_max) {
    recommended = recommended.filter(p => p.price && p.price <= filters.price_max);
  }

  // Si después de filtrar no queda nada, devolvemos solo el más cercano
  if (recommended.length === 0) {
    recommended = [products.find(p => p.id === result.neighbors[0])];
  }

    // Preparar prompt para LLaMA
    const prompt = `
Eres un asistente que recomienda productos. 
Pregunta del cliente: "${query}"
Productos recomendados: ${recommended.map(p => p.description).join(', ')}
Responde en español de manera amigable y útil.
  `;

    //console.log(prompt)

    // Generar respuesta
    //const answer = await session.prompt(prompt);
    //return answer;
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
      const recommended = await recommendProducts(query);
      console.log('Productos recomendados:');
      console.log(recommended);
    } catch (err) {
      console.error('Error al recomendar productos:', err);
    }

    // Volver a preguntar
    askQuery();
  });
};

// Iniciar ciclo de preguntas
askQuery();



console.timeEnd("tiempo_ejecucion");