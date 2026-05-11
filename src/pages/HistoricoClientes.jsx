import React, { useState, useMemo } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Search, Calendar, User, DollarSign, CheckCircle2, Download, FileText, Trash2, 
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Phone
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseHistoricoData } from '@/lib/dateUtils';
import { gerarPDFCliente, gerarPDFTodos } from '@/components/utils/HistoricoDownload';
import NoPermission from '../components/NoPermission';
import { usePermissions } from '../components/auth/PermissionGuard';
import { toast } from 'sonner';

import { Link } from 'react-router-dom';
import { createPageUrl, formatTipoServicoCompact } from '@/utils';
import { matchClienteSearch } from '@/lib/utils/buscaCliente';
import { calcularComissao } from '@/lib/comissao';

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
    mutationFn: async ({ id, tipo }) => {
      if (tipo === 'servico') {
        await base44.entities.Servico.delete(id);
      } else {
        await base44.entities.Atendimento.delete(id);
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
      deleteMutation.mutate({ id: item.originalId, tipo: item.tipoObjeto });
    }
  };

  // Regera Atendimento + Comissao + Preventiva para servicos concluidos sem atendimento.
  // Reproduz o fluxo de Servicos.handleConfirmarConclusao em modo idempotente.
  const regerarMutation = useMutation({
    mutationFn: async (servico) => {
      const user = await base44.auth.me();
      const agora = new Date().toISOString();

      // 0. Guard: se ja existe atendimento para esse servico, abortar.
      // Evita criar duplicata (que causaria "Troca de local x2" em PagamentosClientes).
      const atendimentosExistentes = await base44.entities.Atendimento
        .filter({ servico_id: servico.id })
        .catch(() => []);
      if (atendimentosExistentes && atendimentosExistentes.length > 0) {
        throw new Error('JA_EXISTE_ATENDIMENTO');
      }

      // 1. Buscar historico de status (best-effort)
      const historicoStatus = await base44.entities.AlteracaoStatus
        .filter({ servico_id: servico.id }, 'data_alteracao')
        .catch(() => []);

      // 2. Criar Atendimento com todos os campos
      const detalhesCompletos = {
        dados_ordem_servico: {
          id: servico.id,
          cliente_nome: servico.cliente_nome,
          cpf: servico.cpf || null,
          telefone: servico.telefone || null,
          endereco: servico.endereco || null,
          latitude: servico.latitude || null,
          longitude: servico.longitude || null,
          tipo_servico: servico.tipo_servico,
          descricao: servico.descricao || null,
          valor: servico.valor || 0,
          data_programada: servico.data_programada || null,
          horario: servico.horario || null,
          dia_semana: servico.dia_semana || null,
          equipe_id: servico.equipe_id || null,
          equipe_nome: servico.equipe_nome || null,
          google_maps_link: servico.google_maps_link || null,
          data_criacao: servico.created_date || null,
        },
        observacoes_conclusao: servico.observacoes_conclusao || null,
        usuario_conclusao: user?.email,
        data_conclusao: agora,
        historico_status: (historicoStatus || []).map(h => ({
          status_anterior: h.status_anterior,
          status_novo: h.status_novo,
          usuario: h.usuario,
          data_alteracao: h.data_alteracao,
        })),
        regerado_em: agora,
      };

      await base44.entities.Atendimento.create({
        servico_id: servico.id,
        os_numero: servico.os_numero || '',
        cliente_nome: servico.cliente_nome,
        cpf: servico.cpf || '',
        telefone: servico.telefone || '',
        endereco: servico.endereco || '',
        latitude: servico.latitude || null,
        longitude: servico.longitude || null,
        data_atendimento: servico.data_programada,
        horario: servico.horario || '',
        dia_semana: servico.dia_semana || '',
        tipo_servico: servico.tipo_servico,
        descricao: servico.descricao || '',
        valor: servico.valor || 0,
        observacoes_conclusao: servico.observacoes_conclusao || '',
        equipe_id: servico.equipe_id || '',
        equipe_nome: servico.equipe_nome || '',
        usuario_conclusao: user?.email,
        data_conclusao: agora,
        google_maps_link: servico.google_maps_link || '',
        detalhes: JSON.stringify(detalhesCompletos),
      });

      // 3. Gerar comissao se elegivel e ainda nao gerada
      const comissaoHabilitada = servico.gerar_comissao !== false;
      let tecnicosComissionados = 0;
      if (comissaoHabilitada && servico.equipe_id && servico.valor && !servico.comissao_gerada) {
        const tecnicos = await base44.entities.TecnicoFinanceiro
          .filter({ equipe_id: servico.equipe_id })
          .catch(() => []);
        if (tecnicos && tecnicos.length > 0) {
          const valorTotal = servico.valor;
          // Le percentuais da Tabela de Servicos (TipoServicoValor). Fallback 30/15.
          const comissao = await calcularComissao(servico.tipo_servico, valorTotal, queryClient);
          const valorComissaoTecnico = comissao.valor_comissao_tecnico;
          await Promise.all(tecnicos.map(async (tec) => {
            // Dedup atomico: evita duplicar comissao em chamadas paralelas de regerar
            const ja = await base44.entities.LancamentoFinanceiro
              .filter({ servico_id: servico.id, tecnico_id: tec.tecnico_id })
              .catch(() => []);
            if (ja && ja.length > 0) return;

            await base44.entities.LancamentoFinanceiro.create({
              servico_id: servico.id,
              equipe_id: servico.equipe_id,
              equipe_nome: servico.equipe_nome || '',
              tecnico_id: tec.tecnico_id,
              tecnico_nome: tec.tecnico_nome,
              cliente_nome: servico.cliente_nome,
              tipo_servico: servico.tipo_servico,
              valor_total_servico: valorTotal,
              percentual_equipe: comissao.percentual_equipe,
              valor_comissao_equipe: comissao.valor_comissao_equipe,
              percentual_tecnico: comissao.percentual_tecnico,
              valor_comissao_tecnico: valorComissaoTecnico,
              status: 'pendente',
              data_geracao: agora,
              usuario_geracao: user?.email,
            });
            await base44.entities.TecnicoFinanceiro.update(tec.id, {
              credito_pendente: (tec.credito_pendente || 0) + valorComissaoTecnico,
              total_ganho: (tec.total_ganho || 0) + valorComissaoTecnico,
              data_ultima_atualizacao: agora,
            });
          }));
          await base44.entities.Servico.update(servico.id, { comissao_gerada: true });
          tecnicosComissionados = tecnicos.length;
        }
      }

      // 4. Atualizar preventiva (telefone normalizado + fallback por nome)
      let preventivaAtualizada = false;
      if (!servico.sem_registro_cliente) {
        try {
          const todosClientes = await base44.entities.Cliente.list();
          const telefoneLimpo = (servico.telefone || '').replace(/\D/g, '');
          const nomeNormalizado = (servico.cliente_nome || '').trim().toLowerCase();
          let clienteMatch = null;
          if (telefoneLimpo) {
            clienteMatch = todosClientes.find(c => (c.telefone || '').replace(/\D/g, '') === telefoneLimpo);
          }
          if (!clienteMatch && nomeNormalizado) {
            clienteMatch = todosClientes.find(c => (c.nome || '').trim().toLowerCase() === nomeNormalizado);
          }
          if (clienteMatch) {
            const dataConc = servico.data_programada || new Date().toISOString().split('T')[0];
            const proxima = new Date(dataConc);
            proxima.setMonth(proxima.getMonth() + 6);
            await base44.entities.Cliente.update(clienteMatch.id, {
              ultima_manutencao: dataConc,
              proxima_manutencao: proxima.toISOString().split('T')[0],
            });
            preventivaAtualizada = true;
          }
        } catch (err) {
          console.error('Erro ao atualizar preventiva (regerar):', err);
        }
      }

      // 5. Notificar ADMs para precificar no PagamentosClientes
      try {
        const todosUsuarios = await base44.entities.User.list();
        const admins = todosUsuarios.filter(u => u?.role === 'admin' && u?.email);
        if (admins.length > 0) {
          await Promise.all(admins.map(adm =>
            base44.entities.Notificacao.create({
              usuario_email: adm.email,
              titulo: '💲 Definir preco do servico',
              mensagem: `Servico de "${servico.tipo_servico || 'tipo nao informado'}" para ${servico.cliente_nome || 'cliente'} concluido (regerado). Defina o preco em Pagamentos de Clientes.`,
              tipo: 'pagamento_agendado',
              atendimento_id: servico.id,
              cliente_nome: servico.cliente_nome || '',
              lida: false,
            })
          ));
        }
      } catch (err) {
        console.error('Erro ao notificar ADMs (regerar):', err);
      }

      return { tecnicosComissionados, preventivaAtualizada };
    },
    onSuccess: ({ tecnicosComissionados, preventivaAtualizada }) => {
      queryClient.invalidateQueries({ queryKey: ['atendimentos'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['lancamentosFinanceiros'] });
      queryClient.invalidateQueries({ queryKey: ['tecnicosFinanceiros'] });
      const partes = ['✅ Atendimento criado'];
      if (tecnicosComissionados > 0) partes.push(`comissao para ${tecnicosComissionados} tecnico(s)`);
      if (preventivaAtualizada) partes.push('preventiva atualizada');
      toast.success(partes.join(' + ') + '.');
    },
    onError: (err) => {
      console.error('Erro ao regerar:', err);
      if (err?.message === 'JA_EXISTE_ATENDIMENTO') {
        toast.error('⚠️ Atendimento ja existe para esse servico — nao precisa regerar.');
        queryClient.invalidateQueries({ queryKey: ['atendimentos'] });
        return;
      }
      toast.error('⚠️ Falha ao regerar: ' + (err?.message || 'tente novamente'));
    },
  });

  const handleRegerar = (servicoRaw) => {
    if (!servicoRaw) return;
    if (regerarMutation.isPending) return;
    regerarMutation.mutate(servicoRaw);
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

  // Índices O(1) por servico_id e atendimento_id — substituem .find() O(N) por item.
  const pagamentoPorServico = useMemo(() => {
    const map = new Map();
    pagamentos.forEach(p => { if (p.servico_id && !map.has(p.servico_id)) map.set(p.servico_id, p); });
    return map;
  }, [pagamentos]);
  const pagamentoPorAtendimento = useMemo(() => {
    const map = new Map();
    pagamentos.forEach(p => { if (p.atendimento_id && !map.has(p.atendimento_id)) map.set(p.atendimento_id, p); });
    return map;
  }, [pagamentos]);

  // Set O(1) de servico_ids que ja tem atendimento criado.
  // Usado para detectar servicos concluidos "orfaos" (sem atendimento gerado).
  const servicosComAtendimento = useMemo(() => {
    const set = new Set();
    atendimentos.forEach(a => { if (a.servico_id) set.add(a.servico_id); });
    return set;
  }, [atendimentos]);

  const agrupadoPorCliente = useMemo(() => {
    const historicoUnificado = [];

    // Adiciona Servicos (Agendados, Abertos, Reagendados, Andamento)
    // E tambem servicos CONCLUIDOS sem atendimento (orfaos) para permitir regeneracao.
    servicos.forEach(s => {
      const isConcluido = s.status === 'concluido';
      const isOrfao = isConcluido && !servicosComAtendimento.has(s.id);

      // Concluido COM atendimento: ja aparece via atendimentos.forEach abaixo, pula aqui.
      if (isConcluido && !isOrfao) return;

      const pag = pagamentoPorServico.get(s.id);
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
        equipe_id: s.equipe_id,
        equipe_nome: s.equipe_nome,
        valor: finalValor,
        descricao: s.descricao,
        // Snapshot do servico bruto para a regeneracao saber tudo que precisa
        _servicoRaw: isOrfao ? s : null,
        precisaRegerar: isOrfao,
      });
    });

    // Adiciona Atendimentos (Concluídos)
    atendimentos.forEach(a => {
      const pag = (a.id && pagamentoPorAtendimento.get(a.id)) || (a.servico_id && pagamentoPorServico.get(a.servico_id)) || null;
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

      const itemDate = parseHistoricoData(item.data);
      if (itemDate) {
        if (!grupos[nome].ultimaData || itemDate > grupos[nome].ultimaData) {
          grupos[nome].ultimaData = itemDate;
        }
      }
    });

    const clientesFiltrados = {};
    const searchLower = debouncedSearch.toLowerCase();
    Object.values(grupos).forEach(grupo => {
      const matchClienteNomeOuTel = matchClienteSearch(grupo.nome, grupo.telefone, debouncedSearch);
      const matchItens = !!debouncedSearch && grupo.itens.some(i =>
        i.tipo_servico?.toLowerCase().includes(searchLower) ||
        i.descricao?.toLowerCase().includes(searchLower)
      );

      if (matchClienteNomeOuTel || matchItens) {
        grupo.itens.sort((a, b) => (parseHistoricoData(b.data)?.getTime() || 0) - (parseHistoricoData(a.data)?.getTime() || 0));
        clientesFiltrados[grupo.nome] = grupo;
      }
    });

    return clientesFiltrados;
  }, [atendimentos, servicos, servicosComAtendimento, debouncedSearch, pagamentoPorServico, pagamentoPorAtendimento]);

  const totalServicosHistorico = servicos.length + atendimentos.length;
  const totalValorHistorico = atendimentos.reduce((sum, item) => sum + (item.valor || 0), 0);

  const clientesArray = Object.values(agrupadoPorCliente).sort((a, b) => (b.ultimaData || 0) - (a.ultimaData || 0));
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

                            const sortedGroups = Object.values(byDate).sort((a, b) => (parseHistoricoData(b.data)?.getTime() || 0) - (parseHistoricoData(a.data)?.getTime() || 0));
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
                                          {(() => { const d = parseHistoricoData(group.data); return d ? format(d, 'dd/MM/yyyy', { locale: ptBR }) : '—'; })()}
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
                                    <div className="flex items-center gap-2 flex-wrap">
                                       <h5 className="font-bold text-gray-200 text-sm">{formatTipoServicoCompact(item.tipo_servico) || 'Serviço Não Especificado'}</h5>
                                       <span className="text-[10px] font-bold text-gray-500">#{item.originalId}</span>
                                       {item.precisaRegerar && (
                                         <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wide">
                                           ⚠️ Sem atendimento
                                         </Badge>
                                       )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Calendar className="w-3 h-3 text-blue-400" />
                                      <span className="text-[11px] text-gray-400 font-medium tracking-wide">
                                        {(() => { const d = parseHistoricoData(item.data); return d ? format(d, "dd/MM/yyyy") : '-'; })()}
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
                                    {item.precisaRegerar && (
                                      <Button
                                        size="sm"
                                        onClick={() => handleRegerar(item._servicoRaw)}
                                        disabled={regerarMutation.isPending}
                                        className="h-7 px-3 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] font-bold rounded-full"
                                        title="Criar atendimento + comissao + preventiva para este servico"
                                      >
                                        {regerarMutation.isPending ? '...' : '🔁 Regerar'}
                                      </Button>
                                    )}
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