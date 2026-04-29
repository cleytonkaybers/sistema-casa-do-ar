import React, { useState, useMemo } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { base44 } from '@/api/base44Client';
import { usePermissions } from '@/components/auth/PermissionGuard';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseHistoricoData } from '@/lib/dateUtils';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { 
  Search,
  ClipboardList,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Eye
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import DetalhesModal from '@/components/atendimentos/DetalhesModal';

const formatPhone = (phone) => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
};

// MULTIPLIER PARSER: Converts "Item A + Item A" to "2x Item A"
const formatServiceText = (text) => {
  if (!text) return '-';
  const parts = text.split('+').map(p => p.trim()).filter(Boolean);
  if (parts.length <= 1) return text;
  
  const counts = {};
  parts.forEach(p => {
    counts[p] = (counts[p] || 0) + 1;
  });
  
  return Object.entries(counts)
    .map(([name, count]) => count > 1 ? `${count}x ${name}` : name)
    .join(' + ');
};

export default function Atendimentos() {
  const { user: currentUser, loading: loadingUser, isAdmin } = usePermissions();
  
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm);
  const [filterTipo, setFilterTipo] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [expandedClients, setExpandedClients] = useState({});
  const [detalhesOpen, setDetalhesOpen] = useState(false);
  const [selectedAtendimento, setSelectedAtendimento] = useState(null);

  const toggleClient = (clienteNome) => {
    setExpandedClients(prev => ({
      ...prev,
      [clienteNome]: !prev[clienteNome]
    }));
  };

  const { data: atendimentos = [], isLoading: loadA } = useQuery({
    queryKey: ['atendimentos'],
    queryFn: () => base44.entities.Atendimento.list('-data_atendimento'),
  });

  const { data: pagamentos = [], isLoading: loadP } = useQuery({
    queryKey: ['pagamentos-atendimentos'],
    queryFn: () => base44.entities.PagamentoCliente.list(),
  });

  const isLoading = loadA || loadP;
  const equipeIdUsuario = currentUser?.equipe_id || null;

  // Índices O(1) para lookup de pagamentos — evita filter() O(N) por item.
  // Sem isso, processar 30k servicos × 50k pagamentos = 1.5B ops por render.
  const pagamentosPorServico = useMemo(() => {
    const map = new Map();
    pagamentos.forEach(p => {
      if (!p.servico_id) return;
      const arr = map.get(p.servico_id);
      if (arr) arr.push(p); else map.set(p.servico_id, [p]);
    });
    return map;
  }, [pagamentos]);

  const pagamentosPorAtendimento = useMemo(() => {
    const map = new Map();
    pagamentos.forEach(p => {
      if (!p.atendimento_id) return;
      const arr = map.get(p.atendimento_id);
      if (arr) arr.push(p); else map.set(p.atendimento_id, [p]);
    });
    return map;
  }, [pagamentos]);

  const agrupadoPorCliente = useMemo(() => {
    if (loadingUser) return {};
    const historicoUnificado = [];

    // Apenas atendimentos (servicos concluidos) entram aqui — itens em aberto/agendados
    // ficam na pagina Servicos. Atendimentos sao criados automaticamente na conclusao.
    atendimentos.forEach(a => {
      if (!isAdmin) {
        if (equipeIdUsuario && a.equipe_id !== equipeIdUsuario) return;
        if (!equipeIdUsuario && a.equipe_id) return;
      }

      // Lookup O(1): primeiro por atendimento_id, fallback por servico_id
      let pagsDoAtendimento = a.id ? pagamentosPorAtendimento.get(a.id) : null;
      if ((!pagsDoAtendimento || pagsDoAtendimento.length === 0) && a.servico_id) {
        pagsDoAtendimento = pagamentosPorServico.get(a.servico_id);
      }
      let finalValor = a.valor || 0;
      let valorPago = 0;
      if (pagsDoAtendimento && pagsDoAtendimento.length > 0) {
        let somaTotal = 0;
        for (const p of pagsDoAtendimento) {
          somaTotal += (p.valor_total || 0);
          valorPago += (p.valor_pago || 0);
        }
        if (somaTotal > 0) finalValor = somaTotal;
      }

      historicoUnificado.push({
        id: `a-${a.id}`, originalId: a.id, tipoObjeto: 'atendimento',
        cliente_nome: a.cliente_nome, telefone: a.telefone, tipo_servico: a.tipo_servico,
        data: a.data_atendimento, horario: a.horario, status: 'concluido',
        equipe_id: a.equipe_id, equipe_nome: a.equipe_nome,
        valor: finalValor, valor_pago: valorPago, descricao: a.descricao,
        observacoes: a.observacoes_conclusao, servico_id: a.servico_id,
        latitude: a.latitude, longitude: a.longitude, endereco: a.endereco,
        google_maps_link: a.google_maps_link, os_numero: a.os_numero || ''
      });
    });

    const grupos = {};
    historicoUnificado.forEach(item => {
      const nome = item.cliente_nome?.trim() || 'Desconhecido';
      if (!grupos[nome]) {
        grupos[nome] = {
          nome, telefone: item.telefone, itens: [],
          stats: { concluidas: 0, concluidasValor: 0, pendentes: 0 }, ultimaData: null
        };
      }
      grupos[nome].itens.push(item);
      if (item.status === 'concluido') {
        grupos[nome].stats.concluidas++;
        grupos[nome].stats.concluidasValor += (item.valor || 0);
      } else {
        grupos[nome].stats.pendentes++;
      }
      const itemDate = parseHistoricoData(item.data);
      if (itemDate) {
        if (!grupos[nome].ultimaData || itemDate > grupos[nome].ultimaData) grupos[nome].ultimaData = itemDate;
      }
    });

    const clientesFiltrados = {};
    Object.values(grupos).forEach(grupo => {
      if (filterTipo !== 'all') {
        grupo.itens = grupo.itens.filter(i => i.tipo_servico === filterTipo);
        if (grupo.itens.length === 0) return;
        grupo.stats.concluidas = grupo.itens.filter(i => i.status === 'concluido').length;
        grupo.stats.concluidasValor = grupo.itens.filter(i => i.status === 'concluido').reduce((acc, i) => acc + (i.valor || 0), 0);
        grupo.stats.pendentes = grupo.itens.filter(i => i.status !== 'concluido').length;
      }

      const searchLower = debouncedSearch.toLowerCase();
      const matchNome = grupo.nome.toLowerCase().includes(searchLower);
      const matchItens = grupo.itens.some(i =>
        i.tipo_servico?.toLowerCase().includes(searchLower) ||
        i.descricao?.toLowerCase().includes(searchLower)
      );

      if (matchNome || matchItens) {
        grupo.itens.sort((a, b) => (parseHistoricoData(b.data)?.getTime() || 0) - (parseHistoricoData(a.data)?.getTime() || 0));
        clientesFiltrados[grupo.nome] = grupo;
      }
    });

    return clientesFiltrados;
  }, [atendimentos, pagamentosPorServico, pagamentosPorAtendimento, loadingUser, isAdmin, equipeIdUsuario, filterTipo, debouncedSearch]);

  const tiposServico = useMemo(() => {
    const tipos = new Set();
    atendimentos.forEach(a => { if (a.tipo_servico) tipos.add(a.tipo_servico); });
    return Array.from(tipos).sort();
  }, [atendimentos]);

  const clearFilters = () => {
    setSearchTerm('');
    setFilterTipo('all');
    setCurrentPage(1);
  };

  const clientesArray = Object.values(agrupadoPorCliente).sort((a, b) => (b.ultimaData || 0) - (a.ultimaData || 0));
  const hasActiveFilters = searchTerm || filterTipo !== 'all';
  const totalPages = Math.ceil(clientesArray.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedClientes = clientesArray.slice(startIndex, endIndex);

  React.useEffect(() => { setCurrentPage(1); }, [debouncedSearch, filterTipo]);

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-100 tracking-tight">Painel de Atendimentos</h1>
          <p className="text-gray-400 mt-1 flex items-center gap-2 text-sm">
            Histórico completo e andamento agrupado por clientes
          </p>
        </div>
      </div>

      <div className="bg-[#152236] border border-white/5 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Buscar por cliente ou serviço..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-[#0d1826] border-white/10 text-gray-200 placeholder:text-gray-500 w-full h-11 rounded-xl"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-full md:w-[220px] bg-[#0d1826] border-white/10 text-gray-200 h-11 rounded-xl">
              <SelectValue placeholder="Tipo de Serviço" />
            </SelectTrigger>
            <SelectContent className="bg-[#152236] border-white/10 text-gray-200">
              <SelectItem value="all" className="hover:bg-white/5">Todos os tipos</SelectItem>
              {tiposServico.map(tipo => (
                <SelectItem key={tipo} value={tipo} className="hover:bg-white/5">{tipo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" onClick={clearFilters} className="text-gray-400 hover:text-white hover:bg-white/5 px-3 h-11 shrink-0" title="Limpar Filtros">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} />
      ) : (
        <>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest w-full sm:w-auto text-center sm:text-left">
              Mostrando {startIndex + 1} a {Math.min(endIndex, clientesArray.length)} de {clientesArray.length} clientes
            </p>
            <div className="flex items-center justify-center gap-2 w-full sm:w-auto pb-4 sm:pb-0">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="bg-[#152236] border-white/10 text-gray-300 hover:bg-white/5 h-9">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium text-gray-400 mx-2">Página {currentPage} de {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="bg-[#152236] border-white/10 text-gray-300 hover:bg-white/5 h-9">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {paginatedClientes.length === 0 ? (
            <div className="text-center py-20 bg-[#152236] border border-white/5 rounded-2xl flex flex-col items-center">
              <div className="w-20 h-20 bg-[#0d1826] border border-white/5 rounded-full flex items-center justify-center mb-5">
                <ClipboardList className="w-8 h-8 text-gray-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-200 mb-2">{hasActiveFilters ? 'Nenhum resultado encontrado' : 'Nenhuma atividade registrada'}</h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">{hasActiveFilters ? 'Tente ajustar os filtros de busca.' : 'Os serviços aparecerão aqui agrupados por cliente.'}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {paginatedClientes.map((cliente) => {
                const isExpanded = expandedClients[cliente.nome];
                return (
                  <Card key={cliente.nome} className="bg-[#152236] border border-white/5 shadow-md overflow-hidden rounded-2xl transition-all">
                    <div onClick={() => toggleClient(cliente.nome)} className="flex flex-col md:flex-row md:items-center justify-between p-4 sm:p-5 cursor-pointer hover:bg-white/5 transition-colors group select-none gap-4 bg-[#1e3a8a]/20">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 border border-yellow-500/20 flex flex-shrink-0 items-center justify-center shadow-inner transition-colors">
                          <span className="text-white font-bold text-lg uppercase tracking-wider">{cliente.nome.charAt(0)}</span>
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-100 text-[16px] truncate max-w-[200px] sm:max-w-md lg:max-w-lg">{cliente.nome}</h3>
                          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-400">
                            {cliente.telefone && (
                              <a
                                href={`https://wa.me/55${cliente.telefone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1.5 font-medium bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-md transition-colors"
                              >
                                <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" className="w-3 h-3" />
                                {formatPhone(cliente.telefone)}
                              </a>
                            )}
                            <span className="flex items-center">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-600 mr-1.5"></span>
                              Última OS: {cliente.ultimaData ? format(cliente.ultimaData, 'dd/MM/yyyy') : '-'}
                            </span>
                            <span className="flex items-center font-semibold text-gray-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-600 mr-1.5"></span>
                              {cliente.itens.length} OS
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 self-end md:self-auto">
                        <Badge className="bg-yellow-400 text-gray-900 border-0 font-bold px-2 py-0.5">{cliente.itens.length}</Badge>
                        <div className="w-8 h-8 rounded-full bg-[#0d1826] flex items-center justify-center border border-white/5 text-gray-400 group-hover:text-white transition-colors">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-0 border-t border-white/5 bg-[#121d2f]/50">
                        <div className="p-4 sm:p-5 flex justify-between items-end border-b border-white/5 shadow-inner">
                           <h4 className="text-gray-400 text-[10px] font-bold uppercase tracking-widest flex items-center">
                             <span className="w-1.5 h-4 bg-blue-500 block mr-2 rounded-sm" /> Histórico Agrupado (Qtd x Serviço)
                           </h4>
                           <Link to={createPageUrl('Clientes')}>
                             <Button variant="outline" size="sm" className="bg-[#0d1826] border-white/10 text-gray-300 hover:text-white hover:bg-white/10 h-8 text-xs font-semibold px-4 rounded-full shadow-sm">
                               <Eye className="w-4 h-4 mr-1.5" /> Detalhes
                             </Button>
                           </Link>
                        </div>
                        
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left">
                            <thead>
                              <tr className="bg-[#0b1420] border-b border-white/5">
                                <th className="px-4 py-3 text-gray-400 font-semibold w-40">Data / Equipe</th>
                                <th className="px-4 py-3 text-gray-400 font-semibold w-16 text-center">Qtd</th>
                                <th className="px-4 py-3 text-gray-400 font-semibold">Serviço</th>
                                <th className="px-4 py-3 text-gray-400 font-semibold text-right w-32">Valor Unit.</th>
                                <th className="px-4 py-3 text-gray-400 font-semibold text-right w-32">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(() => {
                                // Agrupamento por Data/Equipe e concatenação formatada
                                const byDate = {};
                                cliente.itens.forEach(item => {
                                  const dateKey = item.data || '';
                                  const equipeKey = item.equipe_nome || '';
                                  const groupKey = `${dateKey}||${equipeKey}`;

                                  if (!byDate[groupKey]) {
                                    byDate[groupKey] = { data: dateKey, horario: item.horario, equipe: equipeKey, servicos: {} };
                                  }

                                  const sKey = formatServiceText(item.tipo_servico || item.descricao || 'Serviço');
                                  const osKey = item.os_numero || '';
                                  const uniqueKey = osKey ? `${osKey}||${sKey}` : `${sKey}||${dateKey}||${item.id}`;

                                  if (!byDate[groupKey].servicos[uniqueKey]) {
                                    byDate[groupKey].servicos[uniqueKey] = { descricao: sKey, qty: 0, valorUnit: item.valor || 0, totalValor: 0, totalPago: 0, os_numero: osKey, status: item.status };
                                  }
                                  byDate[groupKey].servicos[uniqueKey].qty += 1;
                                  byDate[groupKey].servicos[uniqueKey].totalValor += (item.valor || 0);
                                  byDate[groupKey].servicos[uniqueKey].totalPago += (item.valor_pago || 0);
                                });

                                const sortedGroups = Object.values(byDate).sort((a, b) => (parseHistoricoData(b.data)?.getTime() || 0) - (parseHistoricoData(a.data)?.getTime() || 0));
                                let rowBg = false;

                                return sortedGroups.map((group, gIdx) => {
                                  const servicoRows = Object.values(group.servicos);
                                  return servicoRows.map((s, sIdx) => {
                                    rowBg = !rowBg;
                                    const saldo = (s.totalValor || 0) - (s.totalPago || 0);
                                    const isPago = s.totalValor > 0 && saldo <= 0.01;
                                    const isParcial = s.totalPago > 0 && saldo > 0.01;
                                    const isPendente = s.totalValor > 0 && s.totalPago === 0;
                                    return (
                                      <tr key={`${gIdx}-${sIdx}`} className={`border-b border-white/5 ${rowBg ? 'bg-[#152236]' : 'bg-[#121d2f]'} hover:bg-white/5 transition-colors`}>
                                        {sIdx === 0 ? (
                                          <td className="px-4 py-4 align-top" rowSpan={servicoRows.length}>
                                            <div className="font-semibold text-gray-200">
                                              {(() => { const d = parseHistoricoData(group.data); return d ? format(d, 'dd/MM/yyyy', { locale: ptBR }) : '—'; })()}
                                            </div>
                                            {group.horario && (
                                              <div className="text-[11px] text-gray-400 mt-0.5">{group.horario}</div>
                                            )}
                                            {group.equipe ? (
                                              <div className="text-[11px] text-blue-400 font-medium mt-1">{group.equipe}</div>
                                            ) : (
                                              <div className="text-[11px] text-gray-500 italic mt-1">Sem equipe</div>
                                            )}
                                          </td>
                                        ) : null}
                                        <td className="px-4 py-3 text-center align-middle">
                                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 font-bold text-xs shadow-inner border border-blue-500/30">{s.qty}x</span>
                                        </td>
                                        <td className="px-4 py-3 align-middle text-gray-300 pr-4">
                                          {s.os_numero && (
                                            <span className="inline-block text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded mr-2">
                                              {s.os_numero}
                                            </span>
                                          )}
                                          {s.descricao}
                                          {s.status === 'concluido' && (
                                            <span className="ml-2 inline-block text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                                              Concluído
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3 align-middle text-right text-gray-300 font-medium tabular-nums">
                                          {s.valorUnit ? `R$ ${s.valorUnit.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '—'}
                                        </td>
                                        <td className="px-4 py-3 align-middle text-right font-bold tabular-nums">
                                          {s.totalValor ? (
                                            <div className="flex flex-col items-end gap-0.5">
                                              <span className="text-emerald-400">R$ {s.totalValor.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                              {isPago && (
                                                <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded">✓ Pago</span>
                                              )}
                                              {isParcial && (
                                                <span className="text-[10px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">
                                                  Parcial: R$ {s.totalPago.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                                </span>
                                              )}
                                              {isPendente && (
                                                <span className="text-[10px] font-semibold text-gray-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">A receber</span>
                                              )}
                                            </div>
                                          ) : '—'}
                                        </td>
                                      </tr>
                                    );
                                  });
                                });
                              })()}
                            </tbody>
                            <tfoot>
                              <tr className="bg-[#0b1420] border-t border-white/10 shadow-lg">
                                <td colSpan={4} className="px-4 py-4 text-right font-bold text-gray-400 tracking-wider">Total Geral:</td>
                                <td className="px-4 py-4 text-right font-bold text-emerald-400 text-[15px]">
                                  R$ {cliente.stats.concluidasValor.toLocaleString('pt-BR')}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>

                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {selectedAtendimento && (
        <DetalhesModal open={detalhesOpen} onClose={() => { setDetalhesOpen(false); setSelectedAtendimento(null); }} atendimento={{ ...selectedAtendimento, id: selectedAtendimento.originalId }} />
      )}
    </div>
  );
}