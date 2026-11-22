import { calcularComissaoSync, percentualDoTecnico } from '@/lib/comissao';
import {
  filtrarTecnicosParaComissao,
  acharUsuarioDoTecnico,
  ehEquipeAdm,
} from '@/lib/utils/tecnicosFinanceiro';

// Encontra serviços CONCLUÍDOS que deveriam ter comissão e não têm nenhuma.
//
// Por que isto precisa existir: a comissão só nasce no instante da conclusão.
// Se algo falhar ali (queda de rede, aba fechada no meio do processo), ou se
// o lançamento for apagado depois — apagar NÃO reabre a trava `comissao_gerada`
// do serviço —, o serviço fica concluído, cobrado do cliente e sem comissão
// nenhuma. Não havia tela que mostrasse isso: o técnico simplesmente não
// recebia e ninguém descobria.
//
// A AUTORIDADE é "existe LancamentoFinanceiro para este serviço?", de
// propósito. A flag `comissao_gerada` do serviço NÃO serve aqui: ela continua
// true depois de o lançamento ser apagado, que é justamente um dos casos a
// recuperar.
//
// Função pura (recebe tudo pronto, não busca nada) para poder ser testada.
export function detectarComissoesFaltantes({
  servicos = [],
  lancamentos = [],
  tecFins = [],
  usuarios = [],
  tipos = [],
  agora = new Date(),
  diasJanela = 90,
  // Serviço recém-concluído pode estar com a comissão ainda em andamento em
  // outra aba. Deixa esfriar antes de considerar faltante.
  carenciaMinutos = 5,
} = {}) {
  const limite = new Date(agora.getTime() - diasJanela * 24 * 60 * 60 * 1000);
  const agoraMenosCarencia = new Date(agora.getTime() - carenciaMinutos * 60 * 1000);
  const comLancamento = new Set((lancamentos || []).map((l) => l?.servico_id).filter(Boolean));

  const achados = [];
  for (const s of servicos || []) {
    if (!s || s.status !== 'concluido') continue;
    if (comLancamento.has(s.id)) continue;

    const quando = dataConclusaoServico(s);
    if (!quando || quando < limite || quando > agoraMenosCarencia) continue;

    // Motivos LEGÍTIMOS de não ter comissão — não são faltantes.
    if (s.gerar_comissao === false) continue;
    if (!s.equipe_id || ehEquipeAdm(s.equipe_id)) continue;
    if (!s.valor || s.valor <= 0) continue;

    const daEquipe = (tecFins || []).filter((t) => t?.equipe_id === s.equipe_id);
    const tecnicos = filtrarTecnicosParaComissao(daEquipe, usuarios);
    if (tecnicos.length === 0) continue; // equipe só com assalariado/oculto

    const comissao = calcularComissaoSync(s.tipo_servico, s.valor, tipos);
    const destinos = tecnicos.map((tec) => {
      // Cadastro do usuário > espelho no TecnicoFinanceiro > Tabela.
      const perc = percentualDoTecnico(
        acharUsuarioDoTecnico(tec, usuarios), tec, comissao.percentual_tecnico);
      return { tec, perc, valor: (s.valor || 0) * (perc / 100) };
    });

    achados.push({ servico: s, comissao, destinos, quando });
  }

  achados.sort((a, b) => b.quando - a.quando);
  return achados;
}

export function dataConclusaoServico(s) {
  const raw = s?.data_conclusao || s?.data_atualizacao_status || s?.created_date;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}
