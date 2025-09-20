import pkg from 'hnswlib-node';
const { HierarchicalNSW } = pkg;

import { getEmbedding } from '../helpers/embeddings.js'


export async function initHnsw(products){

// Configurar HNSW, Agregando y convirtiendo a vectores los productos

console.log("Cargando HNSW, indexando productos.")

const sampleVector = await getEmbedding("texto de prueba"); // Sacamos un ejemplo para saber cuantos vectores corresponde 768, 1024, etc...

const dim = sampleVector.length;
const space = "cosine";
const hnsw = new HierarchicalNSW(space, dim);

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

return hnsw
}
