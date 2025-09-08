import { AMBIGUOUS_QUERIES } from '../config/constants.js'


export function isAmbiguousQuery(query) {
   const normalizedQuery = removeAccents(query.toLowerCase().trim());

  return AMBIGUOUS_QUERIES.some(amb => {
    // búsqueda más estricta: frase completa
    const pattern = new RegExp(`\\b${amb}\\b`, "i"); 
    return pattern.test(normalizedQuery);
  });
}

// funcion para normalizar queries sin acento
function removeAccents(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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