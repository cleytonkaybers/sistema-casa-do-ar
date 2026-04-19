import React, { useState, useMemo } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Search, Calendar, User, DollarSign, CheckCircle2,
  Clock, Download, FileText, Eye, X, Trash2, 
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Phone
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { gerarPDFCliente, gerarPDFTodos } from '@/components/utils/HistoricoDownload';
import NoPermission from '../components/NoPermission';
import { usePermissions } from '../components/auth/PermissionGuard';
import { toast } from 'sonner';

import { Link } from 'react-router-dom';
import { createPageUrl, formatTipoServicoCompact } from '@/utils';

// Helper de telefone extraído dos padrões
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

export default function HistoricoClientes() {
  const { isAdmin } = usePermissions();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm);
  const [currentPage, setCurrentPage] = useState(1);
  const [clientesPerPage] = useState(10);
  const [expandedClients, setExpandedClients] = useState({});
  const queryClient = useQueryClient();

  const toggleClient = (clienteNome) => {
    setExpandedClients(prev => ({
      ...prev,
      [clienteNome]: !prev[clienteNome]
    }));
  };

  const deleteMutation = useMutation({
    mutationFn: async (idOriginal, tipoObjeto) => {
      if (tipoObjeto === 'servico') {
        await base44.entities.Servico.delete(idOriginal);
      } else {
        await base44.entities.Atendimento.delete(idOriginal);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      queryClient.invalidateQueries({ queryKey: ['atendimentos'] });
      toast.success('Registro excluído com sucesso!');
    },
    onError: () => toast.error('Erro ao excluir registro'),
  });

  const handleDelete = (item) => {
    if (confirm(`Excluir permanentemente este registro #${item.originalId}?`)) {
      deleteMutation.mutate(item.originalId, item.tipoObjeto);
    }
  };

  const { data: servicos = [] } = useQuery({
    queryKey: ['servicos'],
    queryFn: () => base44.entities.Servico.list('-data_programada'),
  });

  const { data: atendimentos = [] } = useQuery({
    queryKey: ['atendimentos'],
    queryFn: () => base44.entities.Atendimento.list('-data_atendimento'),
  });

  const { data: alteracoes = [] } = useQuery({
    queryKey: ['alteracoes'],
    queryFn: () => base44.entities.AlteracaoStatus.list('-data_alteracao'),
  });

  const { data: pagamentos = [] } = useQuery({
    queryKey: ['pagamentos-historico'],
    queryFn: () => base44.entities.PagamentoCliente.list(),
  });

  const agrupadoPorCliente = useMemo(() => {
    const historicoUnificado = [];

    // Adiciona Serviços (Agendados, Abertos, Reagendados, Andamento)
    servicos.forEach(s => {
      if (s.status === 'concluido') return; // Os itens concluídos no ciclo real de app tornam-se Atendimento
      
      let pag = pagamentos.find(p => p.servico_id === s.id);
      let finalValor = s.valor;
      if (pag) {
        finalValor = pag.valor_total !== undefined ? pag.valor_total : (pag.valor !== undefined ? pag.valor : s.valor);
      }

      historicoUnificado.push({
        id: `s-${s.id}`,
        originalId: s.id,
        tipoObjeto: 'servico',
        cliente_nome: s.cliente_nome,
        telefone: s.telefone,
        tipo_servico: s.tipo_servico,
        data: s.data_programada,
        horario: s.horario,
        status: s.status,
        equipe_nome: s.equipe_nome,
        valor: finalValor,
        descricao: s.descricao
      });
    });

    // Adiciona Atendimentos (Concluídos)
    atendimentos.forEach(a => {
      let pag = pagamentos.find(p => p.servico_id === a.servico_id || p.id === a.id);
      let finalValor = a.valor;
      if (pag) {
        finalValor = pag.valor_total !== undefined ? pag.valor_total : (pag.valor !== undefined ? pag.valor : a.valor);
      }

      historicoUnificado.push({
        id: `a-${a.id}`,
        originalId: a.id,
        tipoObjeto: 'atendimento',
        cliente_nome: a.cliente_nome,
        telefone: a.telefone,
        tipo_servico: a.tipo_servico,
        data: a.data_conclusao || a.data_atendimento,
        horario: null,
        status: 'concluido',
        equipe_nome: a.equipe_nome,
        valor: finalValor,
        descricao: a.descricao,
        observacoes: a.observacoes_conclusao,
        servico_id: a.servico_id
      });
    });

    // Agrupamento Legado (para os cards/linhas do tempo)
    const grupos = {};
    historicoUnificado.forEach(item => {
      const nome = item.cliente_nome?.trim() || 'Desconhecido';
      if (!grupos[nome]) {
        grupos[nome] = {
          nome,
          telefone: item.telefone,
          itens: [],
          stats: { concluidas: 0, concluidasValor: 0, pendentes: 0 },
          ultimaData: null
        };
      }
      
      grupos[nome].itens.push(item);
      
      if (item.status === 'concluido') {
        grupos[nome].stats.concluidas++;
        grupos[nome].stats.concluidasValor += (item.valor || 0);
      } else {
        grupos[nome].stats.pendentes++;
      }

      const itemDate = new Date(item.data);
      if (!isNaN(itemDate)) {
        if (!grupos[nome].ultimaData || itemDate > grupos[nome].ultimaData) {
          grupos[nome].ultimaData = itemDate;
        }
      }
    });

    const clientesFiltrados = {};
    Object.values(grupos).forEach(grupo => {
      const searchLower = debouncedSearch.toLowerCase();
      const matchNome = grupo.nome.toLowerCase().includes(searchLower);
      const matchItens = grupo.itens.some(i =>
        i.tipo_servico?.toLowerCase().includes(searchLower) ||
        i.descricao?.toLowerCase().includes(searchLower)
      );

      if (matchNome || matchItens) {
        grupo.itens.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));
        clientesFiltrados[grupo.nome] = grupo;
      }
    });

    return clientesFiltrados;
  }, [atendimentos, servicos, debouncedSearch, pagamentos]);

  const totalServicosHistorico = servicos.length + atendimentos.length;
  const totalValorHistorico = atendimentos.reduce((sum, item) => sum + (item.valor || 0), 0);

  const clearFilters = () => {
    setSearchTerm('');
    setCurrentPage(1);
  };

  const clientesArray = Object.values(agrupadoPorCliente).sort((a, b) => (b.ultimaData || 0) - (a.ultimaData || 0));
  const hasActiveFilters = searchTerm !== '';
  const totalPages = Math.ceil(clientesArray.length / clientesPerPage);
  const startIndex = (currentPage - 1) * clientesPerPage;
  const endIndex = startIndex + clientesPerPage;
  const paginatedClientes = clientesArray.slice(startIndex, endIndex);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  if (!isAdmin) return <NoPermission />;

  const formatCurrency = (value) => {
    if (!value) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getStatusBadge = (status) => {
    const s = status?.toLowerCase() || '';
    if (s === 'concluido' || s === 'concluído') {
      return <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold shadow-inner w-max text-[11px]">Concluída</Badge>;
    }
    if (s === 'faturada' || s === 'faturado') {
      return <Badge className="bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold shadow-inner w-max text-[11px]">Faturada</Badge>;
    }
    if (s === 'agendado' || s === 'reagendado') {
      return <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold shadow-inner w-max text-[11px]">Agendada</Badge>;
    }
    return <Badge className="bg-gray-500/10 text-gray-400 border border-gray-500/20 font-semibold shadow-inner w-max text-[11px] capitalize">{status}</Badge>;
  };

  const getPagamentoStatus = (item) => {
    if (item.status !== 'concluido') return null;
    let pag = null;
    if (item.tipoObjeto === 'atendimento') {
      pag = pagamentos.find(p => p.servico_id === item.servico_id || p.id === item.originalId);
    } else {
      pag = pagamentos.find(p => p.servico_id === item.originalId);
    }
    
    if (!pag) {
      if (item.valor === 0) return { label: 'Sem Preço', style: 'bg-red-500/10 text-red-500 border border-red-500/20' };
      return { label: 'Aguardando', style: 'bg-gray-500/10 text-gray-400 border border-gray-500/20' };   
    }

    if (pag.status === 'pago') return { label: 'Pago', style: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' };
    return { label: 'Aguardando', style: 'bg-orange-500/10 text-orange-400 border border-orange-500/20' };
  };

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-100 tracking-tight">Histórico de Clientes</h1>
        <p className="text-gray-400 mt-1">Auditoria e histórico completo de serviços prestados e pendentes</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-white/5 bg-[#152236] shadow-sm rounded-2xl p-6">
           <div className="flex items-center justify-between">
             <div>
               <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Total Operações</p>
               <p className="text-2xl font-bold text-blue-400 mt-2">{totalServicosHistorico}</p>
             </div>
             <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-500/10 border border-blue-500/20">
                <CheckCircle2 className="w-6 h-6 text-blue-400" />
             </div>
           </div>
        </Card>
        <Card className="border border-white/5 bg-[#152236] shadow-sm rounded-2xl p-6">
           <div className="flex items-center justify-between">
             <div>
               <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Total Movimentado</p>
               <p className="text-2xl font-bold text-emerald-400 mt-2">{formatCurrency(totalValorHistorico)}</p>
             </div>
             <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20">
                <DollarSign className="w-6 h-6 text-emerald-400" />
             </div>
           </div>
        </Card>
        <Card className="border border-white/5 bg-[#152236] shadow-sm rounded-2xl p-6">
           <div className="flex items-center justify-between">
             <div>
               <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Clientes Histórico</p>
               <p className="text-2xl font-bold text-amber-400 mt-2">{Object.keys(agrupadoPorCliente).length}</p>
             </div>
             <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-500/10 border border-amber-500/20">
                <User className="w-6 h-6 text-amber-500" />
             </div>
           </div>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="bg-[#152236] border border-white/5 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Buscar histórico do cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-[#0d1826] border-white/10 text-gray-200 placeholder:text-gray-500 w-full h-11 rounded-xl"
          />
        </div>

        <Button
           onClick={() => gerarPDFTodos(agrupadoPorCliente)}
           className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 h-11 rounded-xl font-semibold border-0 whitespace-nowrap"
        >
          <FileText className="w-4 h-4 mr-2" />
          Exportar Base (PDF)
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-2">
         <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest w-full sm:w-auto text-center sm:text-left">
           Mostrando {startIndex + 1} a {Math.min(endIndex, clientesArray.length)} de {clientesArray.length} clientes
         </p>
         <div className="flex items-center justify-center gap-2 w-full sm:w-auto pb-4 sm:pb-0">
           <Button
             variant="outline"
             size="sm"
             onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
             disabled={currentPage === 1}
             className="bg-[#152236] border-white/10 text-gray-300 hover:bg-white/5 h-9"
           >
             <ChevronLeft className="w-4 h-4" />
           </Button>
           <span className="text-sm font-medium text-gray-400 mx-2">
             Página {currentPage} de {totalPages}
           </span>
           <Button
             variant="outline"
             size="sm"
             onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
             disabled={currentPage === totalPages}
             className="bg-[#152236] border-white/10 text-gray-300 hover:bg-white/5 h-9"
           >
             <ChevronRight className="w-4 h-4" />
           </Button>
         </div>
      </div>

      {paginatedClientes.length === 0 ? (
         <div className="text-center py-20 bg-[#152236] border border-white/5 rounded-2xl flex flex-col items-center">
            <div className="w-20 h-20 bg-[#0d1826] border border-white/5 rounded-full flex items-center justify-center mb-5">
              <FileText className="w-8 h-8 text-gray-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-200 mb-2">
              Nenhum histórico encontrado
            </h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              Realize uma busca diferente ou limpe o campo para voltar.
            </p>
         </div>
      ) : (
        <div className="space-y-4">
          {paginatedClientes.map((cliente) => {
            const isExpanded = expandedClients[cliente.nome];
            
            return (
              <Card key={cliente.nome} className="bg-[#152236] border border-white/5 shadow-md overflow-hidden rounded-2xl transition-all">
                
                {/* Header do Accordion */}
                <div 
                  onClick={() => toggleClient(cliente.nome)}
                  className="flex flex-col md:flex-row md:items-center justify-between p-4 sm:p-5 cursor-pointer hover:bg-white/5 transition-colors group select-none gap-4"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 rounded-full bg-blue-900/40 border border-blue-500/20 flex flex-shrink-0 items-center justify-center shadow-inner group-hover:bg-blue-500/20 transition-colors">
                      <span className="text-blue-400 font-bold text-lg uppercase tracking-wider">{cliente.nome.charAt(0)}</span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-100 text-[16px] truncate">{cliente.nome}</h3>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-400">
                        {cliente.telefone && (
                          <span className="flex items-center font-medium bg-[#0d1826] px-1.5 py-0.5 rounded border border-white/5">
                            <Phone className="w-3 h-3 mr-1.5 text-blue-400" />
                            {formatPhone(cliente.telefone)}
                          </span>
                        )}
                        <span className="flex items-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-600 mr-1.5"></span>
                          Último registro: {cliente.ultimaData ? format(cliente.ultimaData, 'dd/MM/yyyy') : '-'}
                        </span>
                        <span className="flex items-center text-blue-400 font-semibold" onClick={(e) => e.stopPropagation()}>
                           {/* PDF Button inline on header */}
                           <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => gerarPDFCliente(cliente.nome, cliente.itens)}
                              className="h-6 px-2 ml-2 hover:bg-blue-500/20 text-blue-400 border border-blue-500/10 text-[10px]"
                           >
                             <Download className="w-3 h-3 mr-1" />
                             PDF Deste Cliente
                           </Button>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 self-end md:self-auto w-full md:w-auto">
                    {cliente.stats.concluidas > 0 && (
                      <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-[11px] tracking-wide rounded-full">
                        {cliente.stats.concluidas} concluída(s)
                      </Badge>
                    )}
                    {cliente.stats.pendentes > 0 && (
                      <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold text-[11px] tracking-wide rounded-full">
                        {cliente.stats.pendentes} pendente(s)
                      </Badge>
                    )}
                    <div className="w-8 h-8 rounded-full bg-[#0d1826] flex items-center justify-center border border-white/5 text-gray-400 group-hover:text-white transition-colors">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Conteudo Expandido (A tabela idêntica à do Atendimentos) */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 border-t border-white/5 bg-[#121d2f]/50">
                    <div className="flex justify-between items-end mb-4">
                      <h4 className="text-gray-400 text-[10px] font-bold uppercase tracking-widest flex items-center">
                        <span className="w-1.5 h-4 bg-blue-500 block mr-2 rounded-sm" />
                        Histórico de Registros
                      </h4>
                      <Link to={createPageUrl('Clientes')}>
                        <Button variant="outline" size="sm" className="bg-[#0d1826] border-white/10 text-gray-300 hover:text-white hover:bg-white/10 h-8 text-xs font-semibold px-4 rounded-full shadow-sm">
                          Ver perfil completo
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
                            const byDate = {};
                            cliente.itens.forEach(item => {
                              const dateKey = item.data || '';
                              const equipeKey = item.equipe_nome || '';
                              const groupKey = `${dateKey}||${equipeKey}`;
                              
                              if (!byDate[groupKey]) {
                                byDate[groupKey] = { data: dateKey, equipe: equipeKey, servicos: {} };
                              }
                              
                              const sKey = formatServiceText(item.tipo_servico || item.descricao || 'Serviço');
                              
                              if (!byDate[groupKey].servicos[sKey]) {
                                byDate[groupKey].servicos[sKey] = { descricao: sKey, qty: 0, valorUnit: item.valor || 0, totalValor: 0 };
                              }
                              byDate[groupKey].servicos[sKey].qty += 1;
                              byDate[groupKey].servicos[sKey].totalValor += (item.valor || 0);
                            });

                            const sortedGroups = Object.values(byDate).sort((a, b) => new Date(b.data) - new Date(a.data));
                            let rowBg = false;

                            return sortedGroups.map((group, gIdx) => {
                              const servicoRows = Object.values(group.servicos);
                              return servicoRows.map((s, sIdx) => {
                                rowBg = !rowBg;
                                return (
                                  <tr key={`${gIdx}-${sIdx}`} className={`border-b border-white/5 ${rowBg ? 'bg-[#152236]' : 'bg-[#121d2f]'} hover:bg-white/5 transition-colors`}>
                                    {sIdx === 0 ? (
                                      <td className="px-4 py-4 align-top" rowSpan={servicoRows.length}>
                                        <div className="font-semibold text-gray-200">
                                          {group.data ? format(new Date(group.data), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                                        </div>
                                        {group.equipe && (
                                          <div className="text-[11px] text-blue-400 font-medium mt-1">{group.equipe}</div>
                                        )}
                                      </td>
                                    ) : null}
                                    <td className="px-4 py-3 text-center align-middle">
                                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 font-bold text-xs shadow-inner border border-blue-500/30">{s.qty}x</span>
                                    </td>
                                    <td className="px-4 py-3 align-middle text-gray-300 pr-4">{s.descricao}</td>
                                    <td className="px-4 py-3 align-middle text-right text-gray-400 font-medium">
                                      {s.valorUnit ? `R$ ${s.valorUnit.toLocaleString('pt-BR')}` : '—'}
                                    </td>
                                    <td className="px-4 py-3 align-middle text-right font-bold text-emerald-400">
                                      {s.totalValor ? `R$ ${s.totalValor.toLocaleString('pt-BR')}` : '—'}
                                    </td>
                                  </tr>
                                );
                              });
                            });
                          })()}
                        </tbody>
                        <tfoot>
                          <tr className="bg-[#0b1420] border-t border-white/10 shadow-lg">
                            <td colSpan={4} className="px-4 py-4 text-right font-bold text-gray-400 tracking-wider">Total Movimentado:</td>
                            <td className="px-4 py-4 text-right font-bold text-emerald-400 text-[15px]">
                              R$ {cliente.stats.concluidasValor.toLocaleString('pt-BR')}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div className="mt-8 mb-2">
                       <h4 className="text-gray-400 text-[10px] font-bold uppercase tracking-widest flex items-center mb-6">
                         <span className="w-1.5 h-4 bg-purple-500 block mr-2 rounded-sm" />
                         Linha do Tempo
                       </h4>
                       <div className="pl-4 border-l-2 border-white/5 space-y-6 relative ml-2">
                          {cliente.itens.map(item => {
                            // Extrair o array de trilha de auditoria desse item em específico se aplicável
                            const audições = alteracoes.filter(a => a.tipo_registro === item.tipoObjeto && (a.servico_id === item.originalId || a.atendimento_id === item.originalId));

                            return (
                              <div key={`tl-${item.id}`} className="relative">
                                <div className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full ring-4 ring-[#121d2f]/50 border-2 ${item.status === 'concluido' ? 'bg-emerald-400 border-emerald-500/20' : 'bg-blue-400 border-blue-500/20'}`} />
                                
                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-2">
                                       <h5 className="font-bold text-gray-200 text-sm">{formatTipoServicoCompact(item.tipo_servico) || 'Serviço Não Especificado'}</h5>
                                       <span className="text-[10px] font-bold text-gray-500">#{item.originalId}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Calendar className="w-3 h-3 text-blue-400" />
                                      <span className="text-[11px] text-gray-400 font-medium tracking-wide">
                                        {item.data ? format(new Date(item.data), "dd/MM/yyyy") : '-'}
                                        {item.status !== 'concluido' && <span className="text-amber-500 ml-2">▲ Sem preço fixado</span>}
                                      </span>
                                    </div>

                                    {audições.length > 0 && (
                                       <div className="mt-3 bg-[#0d1826] border border-white/5 rounded-lg p-3">
                                          <p className="text-[9px] uppercase font-bold tracking-widest text-gray-500 mb-2">Trilha de Auditoria (Status)</p>
                                          <div className="space-y-1.5">
                                            {audições.sort((a,b) => new Date(a.data_alteracao) - new Date(b.data_alteracao)).map((alt, idx) => (
                                              <div key={idx} className="flex items-center gap-2 text-[10px] text-gray-400">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                                <span className="uppercase text-gray-300 font-bold">{alt.status_novo}</span>
                                                <span className="opacity-50">em</span>
                                                <span>{format(new Date(alt.data_alteracao), "dd/MM 'às' HH:mm")}</span>
                                                <span className="opacity-50">por</span>
                                                <span className="text-blue-300">{alt.usuario}</span>
                                              </div>
                                            ))}
                                          </div>
                                       </div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 mt-2 md:mt-0 origin-left md:origin-right">
                                    {item.valor === 0 && item.status === 'concluido' && (
                                       <span className="text-[10px] text-red-400 font-bold uppercase tracking-widest">Sem Preço</span>
                                    )}
                                    {getStatusBadge(item.status)}
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item)} disabled={deleteMutation.isPending} className="h-6 w-6 ml-2 text-red-500 hover:text-white hover:bg-red-500/80 rounded-full bg-red-500/10 border border-red-500/20" title="Apagar Registro Permanentemente">
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                       </div>
                    </div>

                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}