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

export function matchClienteSearch(nome, telefone, search) {
  const termo = String(search || '').trim();
  if (!termo) return true;

  // Match por nome (case-insensitive) — sempre tenta
  const nomeLower = String(nome || '').toLowerCase();
  if (nomeLower.includes(termo.toLowerCase())) return true;

  // Match por telefone — compara apenas digitos para ignorar mascara/formato
  const termoDigitos = apenasDigitos(termo);
  if (termoDigitos.length === 0) return false;

  const telefoneDigitos = apenasDigitos(telefone);
  if (telefoneDigitos.length === 0) return false;

  return telefoneDigitos.includes(termoDigitos);
}
