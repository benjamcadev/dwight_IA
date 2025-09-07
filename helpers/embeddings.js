import { pipeline } from "@xenova/transformers";
const embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L12-v2");


// Funcion para convertir a vectores
export async function getEmbedding(text) {

    // Configurar embeddings (MiniLM)
    

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



