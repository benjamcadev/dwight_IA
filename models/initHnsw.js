import pkg from 'hnswlib-node';
const { HierarchicalNSW } = pkg;

import { getEmbedding } from '../helpers/embeddings.js'


export async function initHnsw(products){

// Configurar HNSW, Agregando y convirtiendo a vectores los productos

console.log("Cargando HNSW, indexando productos.")

const dim = 1024;
const space = "cosine";
const hnsw = new HierarchicalNSW(space, dim);

hnsw.initIndex(products.length);

// Agregar productos al índice con HNSW
for (const product of products) {
  //const vector = await getEmbedding(product.description);
  const textProduct = `${product.name}. ${product.additional_information || ""}. Categoría: ${product.category || ""}. Tags: ${product.tag || ""}`;
  const vector = await getEmbedding(textProduct);
  hnsw.addPoint(Array.from(vector), product.id);
}

return hnsw
}
