import { AMBIGUOUS_QUERIES } from '../config/constants.js'


export function isAmbiguousQuery(query) {
  if (!query) return false;

  const normalizedQuery = removeAccents(query);

  return AMBIGUOUS_QUERIES.some(amb => {
    const normalizedAmb = removeAccents(amb);
    // usar \b (word boundary) para evitar que "mas" haga match dentro de "mascarilla"
    const pattern = new RegExp(`\\b${normalizedAmb}\\b`, "i"); 
    return pattern.test(normalizedQuery);
  });
}

// funcion para normalizar queries sin acento
function removeAccents(str = "") {
  return str
    .normalize("NFD")              // descompone letras con tilde
    .replace(/[\u0300-\u036f]/g, "") // quita marcas diacríticas
    .toLowerCase()
    .trim();
}

export function normalizeText(s) {
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFD")                 // separar acentos
    .replace(/[\u0300-\u036f]/g, "")  // quitar acentos
    .replace(/[^\p{L}\p{N}\s]/gu, "") // quitar puntuación
    .replace(/\s+/g, " ")
    .trim();
}

export function extractJSON(text) {
  try {
    const match = text.match(/```(?:json)?([\s\S]*?)```/i);
    let jsonString = match ? match[1].trim() : text.trim();

    // 1️⃣ Normalizar comillas tipográficas
    jsonString = jsonString.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

    // 2️⃣ Limpiar espacios extra antes de claves y valores
    jsonString = jsonString.replace(/"\s+(\w+)"/g, '"$1"'); // claves
    jsonString = jsonString.replace(/:\s+"/g, ':"');          // valores
    jsonString = jsonString.replace(/\s+"/g, '"');            // valores iniciales

    // 3️⃣ Intentar parsear
    try {
      return JSON.parse(jsonString);
    } catch {
      // Si falla, cortar en el último } válido
      const lastBrace = jsonString.lastIndexOf("}");
      if (lastBrace !== -1) {
        return JSON.parse(jsonString.substring(0, lastBrace + 1));
      }
      throw new Error("JSON incompleto o mal formado");
    }
  } catch (err) {
    console.error("❌ Error al parsear JSON:", err, "\nRAW:", text);
    return null;
  }
}
