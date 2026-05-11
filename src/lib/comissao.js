import { base44 } from '@/api/base44Client';

const PERCENTUAL_EQUIPE_FALLBACK = 30;
const PERCENTUAL_TECNICO_FALLBACK = 15;

const norm = (s) => (s || '').trim().toLowerCase();

async function loadTiposServicoValor(queryClient) {
  if (!queryClient) {
    return base44.entities.TipoServicoValor.list();
  }
  const cached = queryClient.getQueryData(['tiposServicoValor']);
  if (cached) return cached;
  return queryClient.fetchQuery({
    queryKey: ['tiposServicoValor'],
    queryFn: () => base44.entities.TipoServicoValor.list(),
    staleTime: 60_000,
  });
}

function findPercentuais(tipoServico, tipos) {
  const exato = tipos.find(t => norm(t.tipo_servico) === norm(tipoServico));
  if (exato) return { match: exato, motivo: 'exato' };

  const partes = (tipoServico || '').split('+').map(p => p.trim()).filter(Boolean);
  if (partes.length > 1) {
    const primeiro = tipos.find(t => norm(t.tipo_servico) === norm(partes[0]));
    if (primeiro) return { match: primeiro, motivo: 'primeiro_componente' };
  }
  return { match: null, motivo: 'fallback' };
}

// Versao sincrona para previews na UI (recebe a lista de tipos ja carregada).
// Nao loga warning (preview nao deve poluir console enquanto o usuario digita).
export function calcularComissaoSync(tipoServico, valorTotal, tipos) {
  const valor = Number(valorTotal) || 0;
  const { match } = findPercentuais(tipoServico, tipos || []);
  const percentual_equipe = match?.percentual_equipe ?? PERCENTUAL_EQUIPE_FALLBACK;
  const percentual_tecnico = match?.percentual_tecnico ?? PERCENTUAL_TECNICO_FALLBACK;
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
  const percentual_equipe = match?.percentual_equipe ?? PERCENTUAL_EQUIPE_FALLBACK;
  const percentual_tecnico = match?.percentual_tecnico ?? PERCENTUAL_TECNICO_FALLBACK;

  if (motivo === 'fallback' && tipoServico) {
    console.warn(`[comissao] tipo "${tipoServico}" nao encontrado na Tabela de Servicos, usando fallback ${PERCENTUAL_EQUIPE_FALLBACK}/${PERCENTUAL_TECNICO_FALLBACK}`);
  }

  return {
    percentual_equipe,
    percentual_tecnico,
    valor_comissao_equipe: valor * (percentual_equipe / 100),
    valor_comissao_tecnico: valor * (percentual_tecnico / 100),
    _motivo_match: motivo,
  };
}
