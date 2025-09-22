import path from 'path';
import { fileURLToPath } from 'url';
import { getLlama, LlamaChatSession } from 'node-llama-cpp';
import os from "os";
import { promptRules } from '../prompts/prompts.js';


// Configuracion de rutas
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let model, llama;
const nameModel = 'gemma-2-2b-it.q4_k_m.gguf';


export async function initModel() {

    console.log("Cargando LLM llama-node con modelo gemma-2-2b-it.q4_k_m")

    const numCpus = os.cpus().length; // Obtener cantidad de nucleos del proce

    // Configurar LLM local (llama-node)
    llama = await getLlama();
    model = await llama.loadModel({
        modelPath: path.join(__dirname, nameModel),
        // Opciones de rendimiento:
        nThreads: numCpus,
        nBatch: 1024, // tokens que procesa en paralelo 
        nCtx: 2048 // Para que tu chatbot recuerde más en la conversación
    });

    // creamos sesion
    const session = await createSession()

    return session
}

export async function createSession() {

    const context = await model.createContext();
    const session = new LlamaChatSession({
        contextSequence: context.getSequence(),
        systemPrompt: promptRules()   // reglas iniciales como "system"
    });
    return session;
}

