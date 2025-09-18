import express from "express";
import bodyParser from "body-parser";
import cors from "cors";


//BD de prueba json
import fs from 'fs';
const raw = fs.readFileSync('./db/products_agro.json', 'utf-8');
const products = JSON.parse(raw);

import { initHnsw } from './models/initHNSW.js';
import { recommendProducts } from './services/recommendProduct.js'
import { initModel } from './models/gemma.js';


// 1. Indexar a vectores los productos desde la bd
const hnsw = await initHnsw(products)


// 2. Cargar modelo Gemma
const session = await initModel()


const app = express();
app.use(cors());
app.use(bodyParser.json());

// Ruta para conversar con el chatbot
app.post("/chat", async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
       return res.status(422).json({ error: "El campo 'query' no puede estar vacío"})
    }

    // Aquí llamas a tu función del chatbot
    const response = await recommendProducts(query, hnsw, products, session);

    return res.json({ answer: response });
  } catch (error) {
    console.error("Error en /chat:", error);
    res.status(500).json({ error: "Error interno en el chatbot" });
  }
});

// Iniciar servidor
const PORT = 4000;
app.listen(PORT, () => {
  console.log(`API Chatbot corriendo en http://localhost:${PORT}`);
});
