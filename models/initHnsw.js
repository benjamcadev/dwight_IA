import pkg from 'hnswlib-node';
const { HierarchicalNSW } = pkg;

import { getEmbedding } from '../helpers/embeddings.js'


export async function initHnsw(products) {

  // Configurar HNSW, Agregando y convirtiendo a vectores los productos

  console.log("Cargando HNSW, indexando productos.")

  try {
    const sampleVector = await getEmbedding("texto de prueba"); // Sacamos un ejemplo para saber cuantos vectores corresponde 768, 1024, etc...

    const dim = sampleVector.length;
    const space = "cosine";
    const hnsw = new HierarchicalNSW(space, dim);

    // **** CAMBIO AQUÍ ****
    const NUM_THREADS = 16;
    
    // initIndex(maxElements, M, efConstruction, randomSeed, allow_replace_deleted, num_threads)
    // Pasamos undefined para los parámetros opcionales que no queremos cambiar, excepto el último.
    hnsw.initIndex(
      products.length,     // 1. maxElements (Tu valor)
      undefined,           // 2. M (M por defecto)
      undefined,           // 3. efConstruction (efConstruction por defecto)
      undefined,           // 4. randomSeed (randomSeed por defecto)
      undefined,           // 5. allow_replace_deleted (por defecto)
      NUM_THREADS          // 6. num_threads (¡TU VALOR!)
    );
    // **********************

    hnsw.initIndex(products.length);

    // Agregar productos al índice con HNSW
    const vectors = await Promise.all(products.map(async (product) => {
      const textProduct = `${product.name}. ${product.description || ""}. ${product.additional_information || ""}. Categoría: ${product.category || ""}. Tags: ${product.tag || ""}`;
      const vector = await getEmbedding(textProduct);
      product.embedding = vector; // Guardar embedding en el producto

      return { id: product.id, vector };
    }));

    for (const { id, vector } of vectors) {
      hnsw.addPoint(Array.from(vector), id);  // agregar vectores al HNSW
    }

    hnsw.setEf(100);

    return hnsw
  } catch (error) {
    return console.error("Hubo un error en al iniciar vectores initHnsw.js: " + error)
  }


}
