import express from "express";
import bodyParser from "body-parser";
import cors from "cors";



//BD de prueba json
/*import fs from 'fs';
const raw = fs.readFileSync('./db/products_agro_prueba.json', 'utf-8');
const products = JSON.parse(raw);*/

import { initHnsw } from './models/initHnsw.js';
import { recommendProducts } from './services/recommendProduct.js'
import { initModel } from './models/gemma.js';
import { getProductsStrapi, convertProducts } from './db/getData.js'



// Obtener productos desde Strapi y convertirlos al formato esperado
const productsStrapiRaw = await getProductsStrapi();
const productsStrapi = convertProducts(productsStrapiRaw);

// Indexar a vectores los productos desde Strapi (con embeddings)
const hnsw = await initHnsw(productsStrapi);

// Cargar modelo LLM
const session = await initModel();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Ruta para conversar con el chatbot
app.post("/chat", async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
       return res.status(422).json({ error: "El campo 'query' no puede estar vacio"})
    }


  // Usar productos de Strapi ya convertidos y con embeddings
  const response = await recommendProducts(query, hnsw, productsStrapi, session);

  
    return res.json({ response });
  } catch (error) {
    console.error("Error en /chat:", error);
    res.status(500).json({ error: "Error interno en el chatbot" });
  }
});

// Iniciar servidor
const PORT = 4000;
app.listen(PORT, '0.0.0.0',() => {
  console.log(`API Chatbot corriendo en http://localhost:${PORT}`);
});
