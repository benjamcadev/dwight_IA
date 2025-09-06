
// filters.js

export function parseFiltersFromQuery(query) {
  const q = query.toLowerCase();
  const filters = {};

  // volumen máximo
  let reMax = /(?:menor a|menos de|hasta|<|<=)\s*(\d+(?:[.,]\d+)?)\s*(ml|l|litro|litros)?/i;
  let m = q.match(reMax);
  if (m) {
    let n = parseFloat(m[1].replace(',', '.'));
    if (m[2] && m[2].toLowerCase().startsWith('l')) n *= 1000;
    filters.max_volume_ml = Math.round(n);
  }

  // volumen mínimo
  let reMin = /(?:mayor a|más de|>=|>)\s*(\d+(?:[.,]\d+)?)\s*(ml|l|litro|litros)?/i;
  m = q.match(reMin);
  if (m) {
    let n = parseFloat(m[1].replace(',', '.'));
    if (m[2] && m[2].toLowerCase().startsWith('l')) n *= 1000;
    filters.min_volume_ml = Math.round(n);
  }

  // categoría
  if (q.includes('vaso')) filters.category = 'Vasos';
  if (q.includes('sushi') || q.includes('china') || q.includes('asiática')) filters.category = 'Sushi/Comida Asiática';
  if (q.includes('bolsa') || q.includes('camiseta')) filters.category = 'Bolsas';

  return filters;
}
