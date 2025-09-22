import path from 'path';
import { fileURLToPath } from 'url';
import { getLlama, LlamaChatSession } from 'node-llama-cpp';
import os from "os";
import { promptRules } from '../prompts/prompts.js';


// Configuracion de rutas
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



export async function initModel() {

    console.log("Cargando LLM llama-node con modelo gemma-2-2b-it.q4_k_m")

    const numCpus = os.cpus().length; // Obtener cantidad de nucleos del proce

    // Configurar LLM local (llama-node)
    const llama = await getLlama();
    const model = await llama.loadModel({
        modelPath: path.join(__dirname, 'gemma-2-2b-it.q4_k_m.gguf'),
        // Opciones de rendimiento:
        nThreads: numCpus,      
        nBatch: 1024, // tokens que procesa en paralelo 
        nCtx: 2048 // Para que tu chatbot recuerde más en la conversación
    });
    const context = await model.createContext();
    const session = new LlamaChatSession({ contextSequence: context.getSequence() });
    const responseSession = await session.prompt(promptRules())

    console.log("Response session: ", responseSession)

    return session;

}

