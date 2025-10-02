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


