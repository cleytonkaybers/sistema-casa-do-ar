import { base44 } from '@/api/base44Client';

// Busca TODOS os registros de uma entidade paginando em blocos de 5000.
// Necessário porque o SDK do Base44 usa limite PADRÃO de 50 no .list()
// (e máximo de 5000 por request) — uma chamada .list() sem limite traz só
// os 50 mais recentes, fazendo registros antigos "sumirem" das telas
// (ex: cliente antigo não encontrado no autocomplete de novo serviço).
export async function listAll(entityName, sort = '-created_date') {
  const PAGINA = 5000;
  const todos = [];
  for (let skip = 0; ; skip += PAGINA) {
    const lote = await base44.entities[entityName].list(sort, PAGINA, skip);
    todos.push(...lote);
    if (lote.length < PAGINA) break;
    if (skip > 500000) break; // trava de segurança
  }
  return todos;
}
