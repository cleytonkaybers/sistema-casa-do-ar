// Marcas comuns de ar-condicionado para o Select em ServicoForm.
// "Outra" permite ao usuario digitar livre no campo equipamento.
export const MARCAS_AR = [
  'LG',
  'Samsung',
  'Consul',
  'Electrolux',
  'Springer',
  'Midea',
  'Daikin',
  'Carrier',
  'Komeco',
  'Philco',
  'Gree',
  'Hitachi',
  'TCL',
  'Britânia',
  'Elgin',
];

// Detecta se um tipo do enum (ex: "Instalacao de 9k") e instalacao de AC.
export const isInstalacao = (tipo) =>
  typeof tipo === 'string' && /^Instala[cç][aã]o/i.test(tipo.trim());

// Embute marca no campo equipamento. Retorna string final pra salvar.
// Ex: ("LG", "Sala") -> "Marca: LG | Sala"
//     ("LG", "")     -> "Marca: LG"
//     ("",  "Sala")  -> "Sala"
export const embutirMarca = (marca, equipamento) => {
  const partes = [];
  if (marca && String(marca).trim()) partes.push(`Marca: ${String(marca).trim()}`);
  if (equipamento && String(equipamento).trim()) partes.push(String(equipamento).trim());
  return partes.join(' | ');
};

// Extrai marca de um equipamento ja embutido. Tolerante: aceita ausencia.
// Ex: "Marca: LG | Sala" -> "LG"
//     "Marca: LG"        -> "LG"
//     "Sala"             -> null
export const extrairMarca = (equipamento) => {
  if (!equipamento) return null;
  const m = String(equipamento).match(/Marca:\s*([^|]+?)(?:\s*\||$)/i);
  return m ? m[1].trim() : null;
};

// Remove o "Marca: ..." do equipamento, retornando so a descricao livre.
// Ex: "Marca: LG | Sala" -> "Sala"
//     "Marca: LG"        -> ""
//     "Sala"             -> "Sala"
export const removerMarca = (equipamento) => {
  if (!equipamento) return '';
  return String(equipamento)
    .replace(/Marca:\s*[^|]+(\s*\|\s*)?/i, '')
    .trim();
};
