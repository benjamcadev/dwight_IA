

// Historial Global para chatbot
export let conversationHistory = [];

// Maxima cantidad de interraciones entre user y chatbot
export const MAX_MESSAGES = 15; // recordar que es x2 los mensajes, los del usuario + chatbot

export const AMBIGUOUS_QUERIES = [
  "tienen más opciones",
  "muéstrame otra opción",
  "qué más tienen",
  "qué más hay",
  "más alternativas",
  "otro producto",
  "otra opción",
  "tienen otras opciones",
  "tienes mas opciones"
];
