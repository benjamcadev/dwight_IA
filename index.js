import pkgllama from 'llama-node';
const { Llama } = pkgllama;

import 'dotenv/config';

//BD de prueba json
import fs from 'fs';
const raw = fs.readFileSync('./db/products_agro.json', 'utf-8');
const products = JSON.parse(raw);

import readline from 'readline';

import { initHnsw } from './models/initHnsw.js';
import { recommendProducts } from './services/recommendProduct.js'
import { initModel } from './models/gemma.js';






// Crear interfaz de lectura de consola
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});


// 1. Indexar a vectores los productos desde la bd
const hnsw = await initHnsw(products)


// 2. Cargar modelo Gemma
const session = await initModel()

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
      const recommended = await recommendProducts(query,hnsw, products, session);
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



