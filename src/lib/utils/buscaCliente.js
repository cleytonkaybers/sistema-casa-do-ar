// Helper centralizado de busca de cliente por nome OU telefone.
// Aceita busca por:
// - Nome (case-insensitive, substring)
// - Telefone completo
// - Telefone parcial (qualquer trecho >= 1 digito casa, mas geralmente
//   4 digitos sao suficientes para diferenciar)
//
// Exemplos:
//   matchClienteSearch('Maria Silva', '+5541996541234', 'maria')   -> true
//   matchClienteSearch('Maria Silva', '+5541996541234', '1234')    -> true
//   matchClienteSearch('Maria Silva', '+5541996541234', '99654')   -> true
//   matchClienteSearch('Maria Silva', '+5541996541234', '41 99654') -> true (espaços/sinais ignorados)

const apenasDigitos = (s) => String(s || '').replace(/\D/g, '');

// Normaliza um telefone para uma CHAVE de comparacao robusta.
// Brasil: numero pode vir com/sem codigo do pais (55), com/sem DDD,
// e celular com/sem o "9" extra. Os ultimos 8 digitos (numero do assinante)
// sao a parte mais estavel, entao usamos eles como base de comparacao.
//   '+55 (41) 99654-1234' -> '96541234'
//   '4199654-1234'        -> '96541234'
//   '0041 41 9654 1234'   -> '96541234'
export function normalizarTelefone(telefone) {
  let d = apenasDigitos(telefone);
  if (!d) return '';
  // Remove codigo do pais 55 quando sobra um numero plausivel (>=10 digitos)
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  return d.length >= 8 ? d.slice(-8) : d;
}

// Normaliza um nome para comparacao "fuzzy": sem acentos, minusculo,
// espacos colapsados e sem espacos nas pontas.
//   '  José  da   Silva ' -> 'jose da silva'
export function normalizarNome(nome) {
  return String(nome || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Acha o Cliente correspondente a uma identidade {nome, telefone} dentro de
// uma lista de clientes. Prioriza telefone normalizado (mais confiavel) e cai
// para nome normalizado quando o telefone nao casa. Usado na conclusao do
// servico (Passo 5) para atualizar a preventiva do cliente certo, e em
// qualquer fluxo que precise reencontrar o cliente a partir de um snapshot.
// Retorna o objeto cliente ou null.
export function acharClientePorIdentidade(clientes, { nome, telefone } = {}) {
  if (!Array.isArray(clientes) || clientes.length === 0) return null;

  // 1) Match por telefone normalizado. Considera sufixo nos dois sentidos para
  //    tolerar diferencas de "9" extra / DDD entre os dois numeros.
  const telKey = normalizarTelefone(telefone);
  if (telKey) {
    const porTelefone = clientes.find(c => {
      const ck = normalizarTelefone(c.telefone);
      return ck && (ck === telKey || ck.endsWith(telKey) || telKey.endsWith(ck));
    });
    if (porTelefone) return porTelefone;
  }

  // 2) Fallback: nome normalizado (sem acento, case-insensitive, espacos colapsados)
  const nomeKey = normalizarNome(nome);
  if (nomeKey) {
    const porNome = clientes.find(c => normalizarNome(c.nome) === nomeKey);
    if (porNome) return porNome;
  }

  return null;
}

// Gera uma CHAVE de identidade estavel para AGRUPAR registros do mesmo cliente.
// A identidade combina NOME + TELEFONE — os dois precisam casar para ser o mesmo
// cliente. Motivo:
//   - Telefone sozinho NAO basta: dois clientes DIFERENTES podem compartilhar um
//     telefone (ex: contato de licitacao, responsavel/sindico comum) e NAO devem
//     ser fundidos num so pagamento. Era o que juntava "Escola ..." (equipe 2) e
//     "Matias talba" (equipe 1) numa unica ordem de pagamento.
//   - Nome sozinho NAO basta: homonimos (mesmo nome, pessoas diferentes) sao
//     separados pelo telefone.
// Sem telefone, cai para o nome normalizado.
//   chaveIdentidadeCliente('Ana Paula', '+5541996541234') -> 'nome:ana paula|tel:96541234'
//   chaveIdentidadeCliente('Ana Paula', '')               -> 'nome:ana paula'
export function chaveIdentidadeCliente(nome, telefone) {
  const tel = normalizarTelefone(telefone);
  const nomeKey = normalizarNome(nome);
  if (tel) return `nome:${nomeKey}|tel:${tel}`;
  return `nome:${nomeKey}`;
}

// Busca robusta de cliente por nome E/OU telefone.
// A busca e quebrada em "tokens" (palavras/numeros) e TODOS precisam casar,
// cada um podendo casar no nome OU no telefone. Isso permite:
//   - Nome sem acento e em qualquer caixa:  'jose'      casa 'José'
//   - Palavras fora de ordem:               'silva ana' casa 'Ana Silva'
//   - Telefone parcial (ex: 4 ultimos):     '1234'      casa '+55 41 99654-1234'
//   - Nome + telefone juntos:               'ana 1234'  casa 'Ana' com tel ...1234
//   - Mascara/formato ignorados:            '(41) 9965' casa '4199654...'
export function matchClienteSearch(nome, telefone, search) {
  const termo = String(search || '').trim();
  if (!termo) return true;

  const nomeNorm = normalizarNome(nome);            // sem acento, minusculo
  const telefoneDigitos = apenasDigitos(telefone);  // so digitos

  // Quebra a busca em tokens (separados por espaco), exigindo que cada um case.
  const tokens = normalizarNome(termo).split(' ').filter(Boolean);

  return tokens.every(token => {
    // 1) casa como trecho do nome (sem acento, parcial)
    if (nomeNorm && nomeNorm.includes(token)) return true;

    // 2) casa como trecho do telefone (apenas digitos do token, parcial)
    const tokenDigitos = apenasDigitos(token);
    if (tokenDigitos && telefoneDigitos && telefoneDigitos.includes(tokenDigitos)) return true;

    return false;
  });
}
