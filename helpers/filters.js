

// ----------------------------
// Filtros por volumen
// ----------------------------
export function extractVolumeFilters(query) {
  const q = query.toLowerCase();
  const filters = {};

  // volumen máximo (ej: "menos de 400ml", "hasta 1l")
  let reMax = /(?:menor a|menos de|menor que|hasta|<|<=)\s*(\d+(?:[.,]\d+)?)\s*(ml|l|litro|litros)?/i;
  let m = q.match(reMax);
  if (m) {
    let n = parseFloat(m[1].replace(',', '.'));
    if (m[2] && m[2].toLowerCase().startsWith('l')) n *= 1000;
    filters.max_volume_ml = Math.round(n);
  }

  // volumen mínimo (ej: "más de 300ml", "mayor a 0.5l")
  let reMin = /(?:mayor a|más de|mayor que|>=|>)\s*(\d+(?:[.,]\d+)?)\s*(ml|l|litro|litros)?/i;
  m = q.match(reMin);
  if (m) {
    let n = parseFloat(m[1].replace(',', '.'));
    if (m[2] && m[2].toLowerCase().startsWith('l')) n *= 1000;
    filters.min_volume_ml = Math.round(n);
  }

  // volumen exacto (ej: "vasos de 500ml", "envase 250 ml")
  let reExact = /(\d+(?:[.,]\d+)?)\s*(ml|l|litro|litros)\b/;
  m = q.match(reExact);
  if (m && !filters.max_volume_ml && !filters.min_volume_ml) {
    let n = parseFloat(m[1].replace(',', '.'));
    if (m[2] && m[2].toLowerCase().startsWith('l')) n *= 1000;
    filters.exact_volume_ml = Math.round(n);
  }

  return filters;
}

// ----------------------------
// Filtros por categoría
// ----------------------------
export function extractCategoryFilters(query) {
  const q = query.toLowerCase();
  const filters = {};

  if (q.includes('vaso')) filters.category = 'Vasos';
  if (q.includes('sushi') || q.includes('china') || q.includes('asiática')) filters.category = 'Sushi/Comida Asiática';
  if (q.includes('bolsa') || q.includes('camiseta')) filters.category = 'Bolsas';

  return filters;
}
