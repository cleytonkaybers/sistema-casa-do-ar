const norm = (s) => (s || '').trim().toLowerCase();

// Casa um registro financeiro com o técnico por id OU por nome, de propósito:
// o fluxo do front grava tecnico_id = TecnicoFinanceiro.tecnico_id e a função
// do backend grava o e-mail do User. Quando esses identificadores divergem,
// buscar só por id deixaria lançamentos antigos para trás.
function pertenceAo(registro, alvoIds, alvoNomes) {
  if (registro?.tecnico_id && alvoIds.has(norm(registro.tecnico_id))) return true;
  if (registro?.tecnico_nome && alvoNomes.has(norm(registro.tecnico_nome))) return true;
  return false;
}

// Reúne TUDO que pertence a um técnico: lançamentos de comissão, pagamentos
// recebidos, cadastro(s) financeiro(s) e o acesso ao app.
//
// Usado pela exclusão definitiva de um técnico desligado, então errar aqui
// significa apagar dado de outra pessoa — por isso é função pura e tem teste.
//
// Função pura: recebe as listas prontas, não busca nada.
export function levantarDadosDoTecnico({
  tecnico,
  lancamentos = [],
  pagamentos = [],
  tecFins = [],
  usuarios = [],
} = {}) {
  const vazio = {
    lancamentos: [], pagamentos: [], cadastros: [], users: [],
    totalComissoes: 0, totalPago: 0,
  };
  if (!tecnico) return vazio;

  const alvoIds = new Set([norm(tecnico.tecnico_id)].filter(Boolean));
  const alvoNomes = new Set([norm(tecnico.tecnico_nome)].filter(Boolean));
  if (alvoIds.size === 0 && alvoNomes.size === 0) return vazio;

  // Cadastros financeiros duplicados do mesmo técnico existem neste banco
  // (vinham de provisionamentos simultâneos). Pega todos e aproveita para
  // ampliar os identificadores conhecidos.
  const cadastros = (tecFins || []).filter((t) => pertenceAo(t, alvoIds, alvoNomes));
  for (const t of cadastros) {
    if (t.tecnico_id) alvoIds.add(norm(t.tecnico_id));
    if (t.tecnico_nome) alvoNomes.add(norm(t.tecnico_nome));
  }

  const users = (usuarios || []).filter(
    (u) => (u?.email && alvoIds.has(norm(u.email)))
      || (u?.full_name && alvoNomes.has(norm(u.full_name)))
  );
  for (const u of users) {
    if (u.email) alvoIds.add(norm(u.email));
  }

  const lancs = (lancamentos || []).filter((l) => pertenceAo(l, alvoIds, alvoNomes));
  const pags = (pagamentos || []).filter((p) => pertenceAo(p, alvoIds, alvoNomes));

  return {
    lancamentos: lancs,
    pagamentos: pags,
    cadastros,
    users,
    totalComissoes: lancs.reduce((s, l) => s + (l.valor_comissao_tecnico || 0), 0),
    totalPago: pags.reduce((s, p) => s + (p.valor_pago || 0), 0),
  };
}
