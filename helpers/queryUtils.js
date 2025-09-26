import { AMBIGUOUS_QUERIES } from '../config/constants.js'
import { jsonrepair } from "jsonrepair";

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
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return null;

    const rawJson = text.slice(start, end + 1);

    // Repara errores comunes (comillas malas, objetos cortados, etc.)
    const fixedJson = jsonrepair(rawJson);

    return JSON.parse(fixedJson);
  } catch (err) {
    console.error("❌ Error al reparar/parsear JSON:", err);
    return null;
  }
}
