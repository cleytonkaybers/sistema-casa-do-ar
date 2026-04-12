import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { usePermissions } from '@/components/auth/PermissionGuard';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { 
  Search, 
  ClipboardList, 
  Phone,
  Calendar,
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

export default function Atendimentos() {
  const queryClient = useQueryClient();
  const { user: currentUser, loading: loadingUser, isAdmin } = usePermissions();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // 10 clientes por página
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

  const { data: servicos = [], isLoading: loadS } = useQuery({
    queryKey: ['servicos'],
    queryFn: () => base44.entities.Servico.list('-data_programada'),
  });

  const { data: pagamentos = [], isLoading: loadP } = useQuery({
    queryKey: ['pagamentos-atendimentos'],
    queryFn: () => base44.entities.PagamentoCliente.list(),
  });

  const isLoading = loadA || loadS || loadP;

  const equipeIdUsuario = currentUser?.equipe_id || null;

  // Process and group all history
  const agrupadoPorCliente = useMemo(() => {
    if (loadingUser) return {};

    const historicoUnificado = [];

    // Adiciona Serviços (Agendados, Abertos, Reagendados, Andamento)
    servicos.forEach(s => {
      // Ignorar concluídos aqui pois os atendimentos que representam a conclusão de fato (no banco legado)
      if (s.status === 'concluido') return; 

      if (!isAdmin) {
        if (equipeIdUsuario && s.equipe_id !== equipeIdUsuario) return;
        if (!equipeIdUsuario && s.equipe_id) return;
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
        status: s.status, // agendado, aberto, reagendado
        equipe_nome: s.equipe_nome,
        valor: s.valor,
        descricao: s.descricao
      });
    });

    // Adiciona Atendimentos (Concluídos)
    atendimentos.forEach(a => {
      if (!isAdmin) {
        if (equipeIdUsuario && a.equipe_id !== equipeIdUsuario) return;
        if (!equipeIdUsuario && a.equipe_id) return;
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
        valor: a.valor,
        descricao: a.descricao,
        observacoes: a.observacoes_conclusao,
        servico_id: a.servico_id
      });
    });

    // Agrupamento
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
      
      // Update statistics
      if (item.status === 'concluido') {
        grupos[nome].stats.concluidas++;
        grupos[nome].stats.concluidasValor += (item.valor || 0);
      } else {
        grupos[nome].stats.pendentes++;
      }

      // Ultima OS Date tracking
      const itemDate = new Date(item.data);
      if (!isNaN(itemDate)) {
        if (!grupos[nome].ultimaData || itemDate > grupos[nome].ultimaData) {
          grupos[nome].ultimaData = itemDate;
        }
      }
    });

    // Filtros
    const clientesFiltrados = {};
    Object.values(grupos).forEach(grupo => {
      // Filtrar itens pelo tipo (se houver)
      if (filterTipo !== 'all') {
        grupo.itens = grupo.itens.filter(i => i.tipo_servico === filterTipo);
        if (grupo.itens.length === 0) return;
        // recalculate stats
        grupo.stats.concluidas = grupo.itens.filter(i => i.status === 'concluido').length;
        grupo.stats.concluidasValor = grupo.itens.filter(i => i.status === 'concluido').reduce((acc, i) => acc + (i.valor || 0), 0);
        grupo.stats.pendentes = grupo.itens.filter(i => i.status !== 'concluido').length;
      }

      // Filtrar pelo termo de busca
      const searchLower = searchTerm.toLowerCase();
      const matchNome = grupo.nome.toLowerCase().includes(searchLower);
      const matchItens = grupo.itens.some(i => 
        i.tipo_servico?.toLowerCase().includes(searchLower) || 
        i.descricao?.toLowerCase().includes(searchLower)
      );

      if (matchNome || matchItens) {
        // Ordenar os itens dentro do grupo da mais recente, para a mais antiga
        grupo.itens.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));
        clientesFiltrados[grupo.nome] = grupo;
      }
    });

    return clientesFiltrados;
  }, [atendimentos, servicos, loadingUser, isAdmin, equipeIdUsuario, filterTipo, searchTerm]);

  const tiposServico = useMemo(() => {
    const tipos = new Set();
    atendimentos.forEach(a => { if (a.tipo_servico) tipos.add(a.tipo_servico); });
    servicos.forEach(a => { if (a.tipo_servico) tipos.add(a.tipo_servico); });
    return Array.from(tipos).sort();
  }, [atendimentos, servicos]);

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

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterTipo]);

  const formatCurrency = (value) => {
    if (!value) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getStatusBadge = (status) => {
    const s = status?.toLowerCase() || '';
    if (s === 'concluido' || s === 'concluído') {
      return <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold shadow-inner w- max text-[11px]">Concluída</Badge>;
    }
    if (s === 'faturada' || s === 'faturado') {
      return <Badge className="bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold shadow-inner w-max text-[11px]">Faturada</Badge>;
    }
    if (s === 'agendado' || s === 'reagendado') {
      return <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold shadow-inner w-max text-[11px]">Agendada</Badge>;
    }
    return <Badge className="bg-gray-500/10 text-gray-400 border border-gray-500/20 font-semibold shadow-inner w-max text-[11px] capitalize">{status}</Badge>;
  };

  const handleVerDetalhes = (item) => {
    // Como a modal de detalhes aceita objeto estilo Atendimento, passamos o necessário
    setSelectedAtendimento(item);
    setDetalhesOpen(true);
  };

  const getPagamentoStatus = (item) => {
    if (item.status !== 'concluido') return null; // Apenas concluídos faturam
    
    // Busca na tabela de pagamentos o registro vinculado
    let pag = null;
    if (item.tipoObjeto === 'atendimento') {
      pag = pagamentos.find(p => p.servico_id === item.servico_id || p.id === item.originalId); // Depende muito do mapeamento exato
    } else {
      pag = pagamentos.find(p => p.servico_id === item.originalId);
    }
    
    // Se não encontrar ou o valor foi 0 e não tinha tipo faturável... base44
    if (!pag) {
      if (item.valor === 0) return { label: 'Sem Preço', style: 'bg-red-500/10 text-red-500 border border-red-500/20' };
      return { label: 'Aguardando', style: 'bg-gray-500/10 text-gray-400 border border-gray-500/20' };   
    }

    if (pag.status === 'pago') return { label: 'Pago', style: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' };
    return { label: 'Aguardando', style: 'bg-orange-500/10 text-orange-400 border border-orange-500/20' };
  };

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      {/* Header da Página */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-100 tracking-tight">Painel de Atendimentos</h1>
          <p className="text-gray-400 mt-1 flex items-center gap-2 text-sm">
            Histórico completo e andamento agrupado por clientes
          </p>
        </div>
      </div>

      {/* Toolbar / Filtros Modernos */}
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
            <Button
              variant="ghost"
              onClick={clearFilters}
              className="text-gray-400 hover:text-white hover:bg-white/5 px-3 h-11 shrink-0"
              title="Limpar Filtros"
            >
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
                <ClipboardList className="w-8 h-8 text-gray-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-200 mb-2">
                {hasActiveFilters ? 'Nenhum resultado encontrado' : 'Nenhuma atividade registrada'}
              </h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">
                {hasActiveFilters
                  ? 'Tente ajustar os filtros de busca para encontrar o que procura.'
                  : 'Os serviços concluídos e pendentes aparecerão aqui agrupados por cliente.'}
              </p>
            </div>
      ) : (
        <div className="space-y-4">
          {paginatedClientes.map((cliente) => {
            const isExpanded = expandedClients[cliente.nome];
            
            return (
              <Card key={cliente.nome} className="bg-[#152236] border border-white/5 shadow-md overflow-hidden rounded-2xl transition-all">
                
                {/* Cabeçalho do Card (Accordion Trigger) */}
                <div 
                  onClick={() => toggleClient(cliente.nome)}
                  className="flex flex-col md:flex-row md:items-center justify-between p-4 sm:p-5 cursor-pointer hover:bg-white/5 transition-colors group select-none gap-4"
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar Moderno */}
                    <div className="w-12 h-12 rounded-full bg-blue-900/40 border border-blue-500/20 flex flex-shrink-0 items-center justify-center shadow-inner group-hover:bg-blue-500/20 transition-colors">
                      <span className="text-blue-400 font-bold text-lg uppercase tracking-wider">{cliente.nome.charAt(0)}</span>
                    </div>
                    
                    <div>
                      <h3 className="font-bold text-gray-100 text-[16px] truncate max-w-[200px] sm:max-w-md lg:max-w-lg">{cliente.nome}</h3>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-400">
                        {cliente.telefone && (
                          <span className="flex items-center font-medium bg-[#0d1826] px-1.5 py-0.5 rounded border border-white/5">
                            <Phone className="w-3 h-3 mr-1.5 text-blue-400" />
                            {formatPhone(cliente.telefone)}
                          </span>
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

                  {/* Lado Direito (Badges e Chevron) */}
                  <div className="flex items-center gap-3 self-end md:self-auto">
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

                {/* Conteúdo Expandido */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 border-t border-white/5 bg-[#121d2f]/50">
                    
                    {/* Botão Perfil/Dashboard Topo da Seção */}
                    <div className="flex justify-between items-end mb-4">
                      <h4 className="text-gray-400 text-[10px] font-bold uppercase tracking-widest flex items-center">
                        <span className="w-1.5 h-4 bg-blue-500 block mr-2 rounded-sm" />
                        Histórico de Atendimentos
                      </h4>
                      <Link to={createPageUrl('Clientes')}>
                        <Button variant="outline" size="sm" className="bg-[#0d1826] border-white/10 text-gray-300 hover:text-white hover:bg-white/10 h-8 text-xs font-semibold px-4 rounded-full shadow-sm">
                          Ver perfil completo
                        </Button>
                      </Link>
                    </div>

                    {/* Desktop Table Header Format (Responsive Scrolling Container) */}
                    <div className="overflow-x-auto pb-4">
                      <div className="min-w-[800px]">
                        <div className="grid grid-cols-12 gap-2 pb-3 mb-2 border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                          <div className="col-span-1 pl-2">OS #</div>
                          <div className="col-span-2">Data do Serviço</div>
                          <div className="col-span-3">Tipo de Serviço</div>
                          <div className="col-span-1">Equipe</div>
                          <div className="col-span-1">Valor</div>
                          <div className="col-span-2">Pagamento</div>
                          <div className="col-span-1">Status</div>
                          <div className="col-span-1 text-center">Info</div>
                        </div>

                        <div className="space-y-1">
                          {cliente.itens.map(item => {
                            const pagStats = getPagamentoStatus(item);
                            
                            return (
                              <div key={item.id} className="grid grid-cols-12 gap-2 items-center py-2.5 hover:bg-white/5 rounded-lg transition-colors border-b border-white/[0.02]">
                                <div className="col-span-1 pl-2 font-bold text-blue-400 text-xs">#{item.originalId}</div>
                                <div className="col-span-2 text-xs text-gray-300">
                                  <div className="font-semibold">{item.data ? format(new Date(item.data), "dd/MM/yyyy") : '-'}</div>
                                  <div className="text-gray-500 text-[10px] uppercase font-bold mt-0.5">{item.horario || 'S/H'}</div>
                                </div>
                                <div className="col-span-3">
                                  <div className="font-medium text-gray-200 text-xs truncate pr-2">{item.tipo_servico || '-'}</div>
                                  <div className="text-gray-500 text-[10px] truncate pr-2 w-max max-w-full">{item.descricao ? `"${item.descricao}"` : ''}</div>
                                </div>
                                <div className="col-span-1 text-xs text-gray-400">
                                  {item.equipe_nome ? <span className="bg-[#0d1826] px-1.5 py-0.5 rounded border border-white/5 font-semibold">#{item.equipe_nome}</span> : <span className="opacity-30">—</span>}
                                </div>
                                <div className="col-span-1 font-bold text-emerald-400 text-xs">
                                  {item.status === 'concluido' ? formatCurrency(item.valor) : <span className="text-orange-400 text-[10px] uppercase block tracking-wider">Aguardando</span>}
                                </div>
                                <div className="col-span-2 flex items-center pr-2">
                                  {pagStats ? (
                                    <div className={`px-2 text-[10px] py-1 rounded-md font-bold uppercase tracking-wider ${pagStats.style}`}>{pagStats.label}</div>
                                  ) : (
                                    <span className="w-16 h-1.5 rounded bg-white/5 block" />
                                  )}
                                </div>
                                <div className="col-span-1 flex items-center">
                                  {getStatusBadge(item.status)}
                                </div>
                                <div className="col-span-1 flex justify-center">
                                  <Button variant="ghost" size="icon" onClick={() => handleVerDetalhes(item)} className="h-6 w-6 text-gray-500 hover:text-white hover:bg-white/10 rounded-full bg-[#0d1826] border border-white/5">
                                    <Eye className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* Finalização do Rodapé de Totais */}
                        <div className="grid grid-cols-12 gap-2 mt-2 pt-3 pb-1 border-t border-white/5 bg-[#0d1826] rounded-lg px-2">
                          <div className="col-span-8 text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center">
                            Total ({cliente.stats.concluidas} concluída(s))
                          </div>
                          <div className="col-span-4 font-bold text-emerald-400 text-sm">
                            {formatCurrency(cliente.stats.concluidasValor)}
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Timeline Vertical */}
                    <div className="mt-8 mb-2">
                       <h4 className="text-gray-400 text-[10px] font-bold uppercase tracking-widest flex items-center mb-6">
                         <span className="w-1.5 h-4 bg-purple-500 block mr-2 rounded-sm" />
                         Linha do Tempo
                       </h4>
                       
                       <div className="pl-4 border-l-2 border-white/5 space-y-6 relative ml-2">
                          {cliente.itens.map(item => (
                            <div key={`tl-${item.id}`} className="relative">
                              {/* Bolinha do Timeline */}
                              <div className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full ring-4 ring-[#121d2f]/50 border-2 ${item.status === 'concluido' ? 'bg-emerald-400 border-emerald-500/20' : 'bg-blue-400 border-blue-500/20'}`} />
                              
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                                {/* Info Timeline */}
                                <div>
                                  <div className="flex items-center gap-2">
                                     <h5 className="font-bold text-gray-200 text-sm">{item.tipo_servico || 'Serviço'}</h5>
                                     <span className="text-[10px] font-bold text-gray-500">#{item.originalId}</span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Calendar className="w-3 h-3 text-blue-400" />
                                    <span className="text-[11px] text-gray-400 font-medium tracking-wide">
                                      {item.data ? format(new Date(item.data), "dd/MM/yyyy") : '-'}
                                      {item.status !== 'concluido' && <span className="text-amber-500 ml-2">▲ Sem preço fixado</span>}
                                    </span>
                                  </div>
                                </div>

                                {/* Badges Timeline */}
                                <div className="flex items-center gap-2 mt-2 sm:mt-0 opacity-80 scale-90 sm:scale-100 sm:opacity-100 origin-left sm:origin-right">
                                  {item.valor === 0 && item.status === 'concluido' && (
                                     <span className="text-[10px] text-red-400 font-bold uppercase tracking-widest">Sem Preço</span>
                                  )}
                                  {getStatusBadge(item.status)}
                                </div>
                              </div>
                            </div>
                          ))}
                       </div>
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
        <DetalhesModal
          open={detalhesOpen}
          onClose={() => { setDetalhesOpen(false); setSelectedAtendimento(null); }}
          atendimento={{
            ...selectedAtendimento,
            id: selectedAtendimento.originalId // compatibilidade legada com a modal
          }}
        />
      )}
    </div>
  );
}