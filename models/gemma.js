import path from 'path';
import { fileURLToPath } from 'url';
import { getLlama, LlamaChatSession } from 'node-llama-cpp';
import { promptRules } from '../prompts/prompts.js';
import { numCpus } from '../config/constants.js';
import fetch from "node-fetch";

/* TOP MODELOS LLM
 1.gemma-2-2b-it.q4_k_m.gguf ---> Probado con tiempos desde 16s aprox
 2. llama-3.2-3b-instruct-q4_k_m.gguf --> 19 seg aprox
 3. 

*/

// Configuracion de rutas
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let model, llama;
const nameModel = 'gemma-2-2b-it.q4_k_m.gguf';


export async function initModel() {

    numCpus = 8; // forzar a cargar con node-llama

    if (numCpus <= 8) {

        // ----- CORREMOS CON node-llama-cpp ------ //
        console.log("Servidor con " + numCpus)
        console.log("Cargando LLM llama-node con modelo " + nameModel)

        // Configurar LLM local (llama-node)
        llama = await getLlama();
        model = await llama.loadModel({
            modelPath: path.join(__dirname, nameModel),
            //tokenizerPath: tokenizerPath,
            //tokenizerConfigPath: path.join(__dirname, "tokenizer_config.json"),
            // Opciones de rendimiento:
            nThreads: numCpus,
            nBatch: 1024, // tokens que procesa en paralelo 
            nCtx: 2048, // Para que tu chatbot recuerde más en la conversación
        });

        // creamos sesion
        const session = await createSession()
        return session

    } else {
        // ---- CORREMOS CON FETCH HACIA SERVER DE llama.cpp. ----  ////
        console.log("Servidor con " + numCpus)
        console.log("Cargando LLM con fetch hacia server llama.cpp con modelo " + nameModel)

        // funcion prompt
        async function prompt(promptText, optionsPrompt) {

            const rules = promptRules()
            promptText = rules + promptText // en cada prompt debemos pasar las rules
            const res = await fetch("http://localhost:5000/completion", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: promptText,
                    temperature: optionsPrompt?.temperature ?? 0.5,
                    top_p: optionsPrompt?.top_p ?? 0.9,
                    repeat_penalty: optionsPrompt?.repeat_penalty ?? 1.5,
                }),
            });
            const data = await res.json();
            return data.content;
        }

        // verificar si esta arriba el server del modelo
        try {
            if (await verificarServidor()) {
                return {
                    prompt
                }
            } else {
                throw new Error("Error de comunicacion con el servidor llama.cpp");
            }
        } catch (error) {
            return console.error("Error con el server llama.cpp " + error)
        }


    }


}

export async function createSession() {

    const context = await model.createContext();
    const session = new LlamaChatSession({
        contextSequence: context.getSequence(),
        systemPrompt: promptRules()   // reglas iniciales como "system"
    });
    return session;
}

async function verificarServidor() {
    try {
        const res = await fetch("http://localhost:5000/completion", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: "Hola", n_predict: 1 }) // prompt mínimo
        });

        if (res.ok) {
            const data = await res.json();
            console.log("Servidor activo ✅. Respuesta de prueba:", data.content);
            return true;
        } else {
            console.log("Servidor respondió con error:", res.status);
            return false;
        }
    } catch (error) {
        console.log("No se puede conectar al servidor:", error.message);
        return false;
    }
}

