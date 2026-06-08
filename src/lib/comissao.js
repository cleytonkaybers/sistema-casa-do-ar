import { base44 } from '@/api/base44Client';

const PERCENTUAL_EQUIPE_FALLBACK = 30;
const PERCENTUAL_TECNICO_FALLBACK = 15;

const norm = (s) => (s || '').trim().toLowerCase();

// Fallback INTELIGENTE: quando o tipo de serviço não casa com a Tabela de
// Serviços, usa a taxa MAIS COMUM da própria tabela (em vez do 30/15 fixo).
// Assim, com uma política uniforme (ex: tudo 34/17), um serviço composto/com
// nome fora do padrão segue o mesmo 34/17 — e acompanha automaticamente se o
// ADM mudar a tabela. Só cai no 30/15 se a tabela estiver vazia.
function fallbackPercentuais(tipos) {
  if (!Array.isArray(tipos) || tipos.length === 0) {
    return { equipe: PERCENTUAL_EQUIPE_FALLBACK, tecnico: PERCENTUAL_TECNICO_FALLBACK };
  }
  const contagem = new Map(); // "equipe|tecnico" -> ocorrências
  for (const t of tipos) {
    const eq = t?.percentual_equipe;
    const tec = t?.percentual_tecnico;
    if (eq == null || tec == null) continue;
    const chave = `${eq}|${tec}`;
    contagem.set(chave, (contagem.get(chave) || 0) + 1);
  }
  if (contagem.size === 0) {
    return { equipe: PERCENTUAL_EQUIPE_FALLBACK, tecnico: PERCENTUAL_TECNICO_FALLBACK };
  }
  let melhor = null, melhorN = -1;
  for (const [chave, n] of contagem) {
    if (n > melhorN) { melhorN = n; melhor = chave; }
  }
  const [equipe, tecnico] = melhor.split('|').map(Number);
  return { equipe, tecnico };
}

// Remove sufixos entre colchetes ("[Marca: TCL]", "[Ar da sogra]") que sao
// metadados visuais e nao fazem parte do tipo de servico cadastrado na tabela.
// Ex: "Instalacao de 12k [Marca: TCL]" -> "Instalacao de 12k"
const stripSufixos = (s) => (s || '').replace(/\s*\[[^\]]*\]/g, '').trim();

async function loadTiposServicoValor(queryClient) {
  if (!queryClient) {
    return base44.entities.TipoServicoValor.list();
  }
  // staleTime: 0 garante que SEMPRE busca a Tabela de Servicos fresca ao
  // calcular comissao. React Query deduplica chamadas in-flight, entao
  // multiplas conclusoes paralelas reaproveitam 1 fetch. Importante:
  // antes usavamos getQueryData() que retornava cache stale (invalidado
  // mas ainda em memoria) — fazia comissao sair com % antigo apos o admin
  // mudar a Tabela.
  return queryClient.fetchQuery({
    queryKey: ['tiposServicoValor'],
    queryFn: () => base44.entities.TipoServicoValor.list(),
    staleTime: 0,
  });
}

function findPercentuais(tipoServico, tipos) {
  // 1) Match exato (sem normalizacao alem de trim/lowercase)
  const exato = tipos.find(t => norm(t.tipo_servico) === norm(tipoServico));
  if (exato) return { match: exato, motivo: 'exato' };

  // 2) Match removendo sufixos [X] no fim (ex: "Instalacao 12k [Marca: TCL]")
  const semSufixo = stripSufixos(tipoServico);
  if (semSufixo && norm(semSufixo) !== norm(tipoServico)) {
    const matchSemSufixo = tipos.find(t => norm(stripSufixos(t.tipo_servico)) === norm(semSufixo));
    if (matchSemSufixo) return { match: matchSemSufixo, motivo: 'sem_sufixo' };
  }

  // 3) Tipo composto: split por + e tenta cada parte (com e sem sufixo)
  const partes = (tipoServico || '').split('+').map(p => p.trim()).filter(Boolean);
  for (const parte of partes) {
    const parteSemSufixo = stripSufixos(parte);
    const match = tipos.find(t => {
      const t1 = norm(t.tipo_servico);
      const t2 = norm(stripSufixos(t.tipo_servico));
      return t1 === norm(parte) || t2 === norm(parteSemSufixo);
    });
    if (match) return { match, motivo: 'componente' };
  }

  return { match: null, motivo: 'fallback' };
}

// Versao sincrona para previews na UI (recebe a lista de tipos ja carregada).
// Nao loga warning (preview nao deve poluir console enquanto o usuario digita).
export function calcularComissaoSync(tipoServico, valorTotal, tipos) {
  const valor = Number(valorTotal) || 0;
  const { match } = findPercentuais(tipoServico, tipos || []);
  const fb = fallbackPercentuais(tipos || []);
  const percentual_equipe = match?.percentual_equipe ?? fb.equipe;
  const percentual_tecnico = match?.percentual_tecnico ?? fb.tecnico;
  return {
    percentual_equipe,
    percentual_tecnico,
    valor_comissao_equipe: valor * (percentual_equipe / 100),
    valor_comissao_tecnico: valor * (percentual_tecnico / 100),
  };
}

export async function calcularComissao(tipoServico, valorTotal, queryClient) {
  const valor = Number(valorTotal) || 0;
  let tipos = [];
  try {
    tipos = await loadTiposServicoValor(queryClient);
  } catch (err) {
    console.warn('[comissao] falha ao carregar TipoServicoValor, usando fallback 30/15:', err?.message);
  }

  const { match, motivo } = findPercentuais(tipoServico, tipos || []);
  const fb = fallbackPercentuais(tipos || []);
  const percentual_equipe = match?.percentual_equipe ?? fb.equipe;
  const percentual_tecnico = match?.percentual_tecnico ?? fb.tecnico;

  if (motivo === 'fallback' && tipoServico) {
    console.warn(`[comissao] tipo "${tipoServico}" nao encontrado na Tabela de Servicos, usando fallback ${fb.equipe}/${fb.tecnico} (taxa mais comum da tabela)`);
  }

  return {
    percentual_equipe,
    percentual_tecnico,
    valor_comissao_equipe: valor * (percentual_equipe / 100),
    valor_comissao_tecnico: valor * (percentual_tecnico / 100),
    _motivo_match: motivo,
  };
}
