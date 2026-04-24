// Tipos de servico que NAO geram atendimento, comissao, preventiva, pagamento
// e nao aparecem em listagens financeiras quando aparecem SOZINHOS.
// Se vier combinado (ex: "Ver defeito + Limpeza 9k"), o servico vale normal:
// gera tudo, porque o tecnico fez a limpeza alem da inspecao.
export const TIPOS_IGNORADOS = [
  'Ver defeito',
  'Verificar defeito',
  'Outro tipo de servico',
  'Outro tipo de serviço',
  'Servico avulso',
  'Serviço avulso',
];

// Quebra "Limpeza 9k + Ver defeito" em ["Limpeza 9k", "Ver defeito"], normalizando espacos.
export const parseTipos = (tipoServico) =>
  (tipoServico || '')
    .split('+')
    .map(t => t.trim())
    .filter(Boolean);

// Set normalizado (lower-case, trim) dos tipos ignorados, para comparacao robusta.
const IGNORADOS_NORM = new Set(TIPOS_IGNORADOS.map(t => t.trim().toLowerCase()));

// True quando o tipo_servico contem APENAS tipos ignorados (ex: "Ver defeito"
// ou "Ver defeito + Verificar defeito"). False quando ha pelo menos um tipo
// real no meio (ex: "Ver defeito + Limpeza 9k").
export const isApenasTiposIgnorados = (tipoServico) => {
  const tipos = parseTipos(tipoServico);
  if (tipos.length === 0) return false;
  return tipos.every(t => IGNORADOS_NORM.has(t.toLowerCase()));
};
