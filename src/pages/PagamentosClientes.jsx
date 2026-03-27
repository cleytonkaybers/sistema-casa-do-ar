import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Search, DollarSign, CheckCircle2, Clock, AlertCircle, Calendar,
  MessageCircle, ChevronDown, ChevronUp, Filter, X, Plus, History
} from 'lucide-react';
import { usePermissions } from '@/components/auth/PermissionGuard';
import NoPermission from '@/components/NoPermission';

const formatCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const formatPhone = (p) => {
  if (!p) return '';
  const c = p.replace(/\D/g, '');
  if (c.length === 11) return `(${c.slice(0,2)}) ${c.slice(2,7)}-${c.slice(7)}`;
  return p;
};
const getWhatsApp = (phone) => {
  if (!phone) return '#';
  const n = phone.replace(/\D/g, '');
  return `https://wa.me/55${n}`;
};

function PagamentoModal({ open, onClose, pagamento, onSave }) {
  const [valor, setValor] = useState('');
  const [obs, setObs] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (open) { setValor(''); setObs(''); }
  }, [open]);

  const saldo = (pagamento?.valor_total || 0) - (pagamento?.valor_pago || 0);

  const handleSave = async () => {
    const v = parseFloat(valor.replace(',', '.'));
    if (!v || v <= 0) return toast.error('Informe um valor válido');
    if (v > saldo + 0.01) return toast.error(`Valor maior que o saldo devedor (${formatCurrency(saldo)})`);
    setLoading(true);
    await onSave(pagamento, v, obs);
    setLoading(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-gray-50 rounded-lg p-3 space-y-1">
            <p className="font-semibold text-gray-800">{pagamento?.cliente_nome}</p>
            <p className="text-sm text-gray-500">{pagamento?.tipo_servico}</p>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-gray-500">Total: <span className="font-medium text-gray-800">{formatCurrency(pagamento?.valor_total)}</span></span>
              <span className="text-gray-500">Pago: <span className="font-medium text-green-600">{formatCurrency(pagamento?.valor_pago)}</span></span>
              <span className="text-gray-500">Saldo: <span className="font-bold text-red-600">{formatCurrency(saldo)}</span></span>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Valor a registrar (R$)</label>
            <Input
              placeholder="0,00"
              value={valor}
              onChange={e => setValor(e.target.value)}
              className="h-12 text-lg font-semibold"
              autoFocus
            />
            <button
              onClick={() => setValor(saldo.toFixed(2).replace('.', ','))}
              className="text-xs text-blue-600 mt-1 underline"
            >
              Preencher valor total restante ({formatCurrency(saldo)})
            </button>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Observação (opcional)</label>
            <Input placeholder="Ex: PIX, dinheiro..." value={obs} onChange={e => setObs(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white">
            {loading ? 'Salvando...' : 'Confirmar Pagamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditarValorModal({ open, onClose, pagamento, onSave }) {
  const [valor, setValor] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (open && pagamento) setValor(String(pagamento.valor_total || '').replace('.', ','));
  }, [open, pagamento]);

  const handleSave = async () => {
    const v = parseFloat(valor.replace(',', '.'));
    if (!v || v <= 0) return toast.error('Valor inválido');
    setLoading(true);
    await onSave(pagamento, v);
    setLoading(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Editar Valor</DialogTitle></DialogHeader>
        <div className="py-2 space-y-3">
          <p className="text-sm text-gray-600">{pagamento?.cliente_nome} — {pagamento?.tipo_servico}</p>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Novo valor (R$)</label>
            <Input value={valor} onChange={e => setValor(e.target.value)} className="h-12 text-lg font-semibold" autoFocus />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CardPagamento({ pag, onPagar, onEditarValor }) {
  const [expandido, setExpandido] = useState(false);
  const saldo = (pag.valor_total || 0) - (pag.valor_pago || 0);
  const isPago = pag.status === 'pago';
  const isParcial = pag.status === 'parcial';

  const statusBadge = isPago
    ? <Badge className="bg-green-100 text-green-700 border-green-200 border text-xs">Pago</Badge>
    : isParcial
    ? <Badge className="bg-amber-100 text-amber-700 border-amber-200 border text-xs">Parcial</Badge>
    : <Badge className="bg-red-100 text-red-700 border-red-200 border text-xs">Pendente</Badge>;

  return (
    <Card className={`border shadow-sm ${isPago ? 'border-green-200 bg-green-50/30' : isParcial ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200 bg-white'}`}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-gray-800">{pag.cliente_nome}</p>
              {statusBadge}
            </div>
            <p className="text-sm text-gray-500 truncate">{pag.tipo_servico}</p>
            {pag.equipe_nome && <p className="text-xs text-blue-600 font-medium">👷 {pag.equipe_nome}</p>}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-bold text-lg text-gray-800">{formatCurrency(pag.valor_total)}</p>
            {!isPago && <p className="text-xs text-red-600 font-semibold">Deve: {formatCurrency(saldo)}</p>}
          </div>
        </div>

        {/* Info row */}
        <div className="flex items-center justify-between text-sm text-gray-500 flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {pag.data_conclusao ? format(parseISO(pag.data_conclusao), "dd/MM/yy HH:mm", { locale: ptBR }) : '-'}
          </div>
          {pag.telefone && (
            <a href={getWhatsApp(pag.telefone)} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg">
              <MessageCircle className="w-3.5 h-3.5" />
              {formatPhone(pag.telefone)}
            </a>
          )}
        </div>

        {/* Histórico pagamentos */}
        {pag.historico_pagamentos?.length > 0 && (
          <div>
            <button onClick={() => setExpandido(!expandido)} className="flex items-center gap-1 text-xs text-blue-600 underline">
              {expandido ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {pag.historico_pagamentos.length} pagamento(s) registrado(s)
            </button>
            {expandido && (
              <div className="mt-2 space-y-1">
                {pag.historico_pagamentos.map((h, i) => (
                  <div key={i} className="flex justify-between text-xs bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                    <span className="text-gray-600">{h.data} {h.observacao && `— ${h.observacao}`}</span>
                    <span className="font-semibold text-green-600">{formatCurrency(h.valor)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Ações */}
        {!isPago && (
          <div className="flex gap-2 pt-1 border-t border-gray-100">
            <Button variant="outline" size="sm" onClick={() => onEditarValor(pag)} className="text-xs h-9">
              Editar Valor
            </Button>
            <Button onClick={() => onPagar(pag)} size="sm"
              className="flex-1 h-9 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold">
              <DollarSign className="w-3.5 h-3.5 mr-1" />
              Registrar Pagamento
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PagamentosClientes() {
  const queryClient = useQueryClient();
  const { isAdmin } = usePermissions();

  const [searchTerm, setSearchTerm] = useState('');
  const [pagarModal, setPagarModal] = useState(null);
  const [editarModal, setEditarModal] = useState(null);

  // Relatórios
  const [abaAtiva, setAbaAtiva] = useState('semana'); // semana | debitos | relatorio
  const [relFiltro, setRelFiltro] = useState('semana');
  const [relDataInicio, setRelDataInicio] = useState('');
  const [relDataFim, setRelDataFim] = useState('');
  const [relCliente, setRelCliente] = useState('');

  const { data: atendimentos = [] } = useQuery({
    queryKey: ['atendimentos-pag'],
    queryFn: () => base44.entities.Atendimento.list('-data_conclusao'),
  });

  const { data: servicosConcluidos = [] } = useQuery({
    queryKey: ['servicos-concluidos-pag'],
    queryFn: () => base44.entities.Servico.filter({ status: 'concluido' }, '-data_conclusao'),
  });

  const { data: pagamentos = [], isLoading } = useQuery({
    queryKey: ['pagamentos-clientes'],
    queryFn: () => base44.entities.PagamentoCliente.list('-data_conclusao'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PagamentoCliente.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pagamentos-clientes'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PagamentoCliente.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pagamentos-clientes'] }),
  });

  // Sincronizar apenas serviços/atendimentos DA SEMANA ATUAL que ainda não têm registro de pagamento
  // Valores são independentes - não sincronizam com outras páginas
  useEffect(() => {
    if (isLoading) return;
    const idsRegistrados = new Set(pagamentos.map(p => p.atendimento_id).filter(Boolean));
    const servicosIdsRegistrados = new Set(pagamentos.map(p => p.servico_id).filter(Boolean));

    // Atendimentos da semana atual
    const atendimentosSemana = atendimentos.filter(a => {
      if (idsRegistrados.has(a.id)) return false;
      if (!a.data_conclusao && !a.created_date) return false;
      try {
        const data = parseISO(a.data_conclusao || a.created_date);
        return isWithinInterval(data, { start: inicioSemana, end: fimSemana });
      } catch { return false; }
    });

    // Serviços concluídos da semana que não vieram de atendimentos
    const servicosSemana = servicosConcluidos.filter(s => {
      if (servicosIdsRegistrados.has(s.id)) return false;
      // Evitar duplicar se já tem atendimento para esse serviço
      if (atendimentos.some(a => a.servico_id === s.id)) return false;
      const dataRef = s.data_conclusao || s.updated_date || s.created_date;
      if (!dataRef) return false;
      try {
        const data = parseISO(dataRef);
        return isWithinInterval(data, { start: inicioSemana, end: fimSemana });
      } catch { return false; }
    });

    atendimentosSemana.forEach(a => {
      createMutation.mutate({
        atendimento_id: a.id,
        servico_id: a.servico_id || '',
        cliente_nome: a.cliente_nome || '',
        telefone: a.telefone || '',
        tipo_servico: a.tipo_servico || '',
        data_conclusao: a.data_conclusao || a.created_date,
        valor_total: a.valor || 0,
        valor_pago: 0,
        status: 'pendente',
        equipe_nome: a.equipe_nome || '',
        historico_pagamentos: [],
      });
    });

    servicosSemana.forEach(s => {
      createMutation.mutate({
        atendimento_id: '',
        servico_id: s.id,
        cliente_nome: s.cliente_nome || '',
        telefone: s.telefone || '',
        tipo_servico: s.tipo_servico || '',
        data_conclusao: s.data_conclusao || s.updated_date || s.created_date,
        valor_total: s.valor || 0,
        valor_pago: 0,
        status: 'pendente',
        equipe_nome: s.equipe_nome || '',
        historico_pagamentos: [],
      });
    });
  }, [atendimentos, servicosConcluidos, pagamentos, isLoading]);

  const handleRegistrarPagamento = async (pag, valor, obs) => {
    const novoPago = (pag.valor_pago || 0) + valor;
    const novoHistorico = [...(pag.historico_pagamentos || []), {
      valor,
      data: format(new Date(), "dd/MM/yyyy HH:mm"),
      observacao: obs,
    }];
    const isQuitado = novoPago >= (pag.valor_total || 0) - 0.01;
    await updateMutation.mutateAsync({
      id: pag.id,
      data: {
        valor_pago: novoPago,
        status: isQuitado ? 'pago' : 'parcial',
        historico_pagamentos: novoHistorico,
        data_pagamento_completo: isQuitado ? new Date().toISOString() : undefined,
      },
    });
    toast.success(isQuitado ? '✅ Pagamento quitado!' : 'Pagamento parcial registrado!');
  };

  const handleEditarValor = async (pag, novoValor) => {
    await updateMutation.mutateAsync({ id: pag.id, data: { valor_total: novoValor } });
    toast.success('Valor atualizado!');
  };

  // Filtros de data
  const hoje = new Date();
  const inicioSemana = startOfWeek(hoje, { weekStartsOn: 0 });
  const fimSemana = endOfWeek(hoje, { weekStartsOn: 0 });

  const pagsFiltrados = useMemo(() => {
    return pagamentos.filter(p =>
      !searchTerm || p.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [pagamentos, searchTerm]);

  const pagsSemana = useMemo(() => pagsFiltrados.filter(p => {
    if (!p.data_conclusao) return false;
    try {
      return isWithinInterval(parseISO(p.data_conclusao), { start: inicioSemana, end: fimSemana });
    } catch { return false; }
  }), [pagsFiltrados, inicioSemana, fimSemana]);

  const pagsDebito = useMemo(() =>
    pagsFiltrados.filter(p => p.status !== 'pago')
  , [pagsFiltrados]);

  // Relatório
  const pagsRelatorio = useMemo(() => {
    let inicio, fim;
    if (relFiltro === 'semana') { inicio = inicioSemana; fim = fimSemana; }
    else if (relFiltro === 'mes') { inicio = startOfMonth(hoje); fim = endOfMonth(hoje); }
    else if (relFiltro === 'personalizado' && relDataInicio && relDataFim) {
      inicio = new Date(relDataInicio);
      fim = new Date(relDataFim + 'T23:59:59');
    }

    return pagamentos.filter(p => {
      const matchCliente = !relCliente || p.cliente_nome?.toLowerCase().includes(relCliente.toLowerCase());
      let matchData = true;
      if (inicio && fim && p.data_conclusao) {
        try { matchData = isWithinInterval(parseISO(p.data_conclusao), { start: inicio, end: fim }); }
        catch { matchData = false; }
      }
      return matchCliente && matchData;
    });
  }, [pagamentos, relFiltro, relDataInicio, relDataFim, relCliente, inicioSemana, fimSemana, hoje]);

  const totalRelatorio = pagsRelatorio.reduce((s, p) => s + (p.valor_total || 0), 0);
  const totalPagoRelatorio = pagsRelatorio.reduce((s, p) => s + (p.valor_pago || 0), 0);
  const totalDebitoRelatorio = totalRelatorio - totalPagoRelatorio;

  const abas = [
    { key: 'semana', label: `Semana Atual (${pagsSemana.length})` },
    { key: 'debitos', label: `Em Débito (${pagsDebito.length})` },
    { key: 'relatorio', label: 'Relatórios' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={{ backgroundColor: '#1e3a8a' }}>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Pagamentos dos Clientes</h1>
          <p className="text-blue-200/80 text-sm mt-1">Controle de cobranças dos serviços concluídos</p>
        </div>
        <div className="flex gap-2 text-sm">
          <div className="bg-white/10 rounded-xl px-4 py-2 text-center">
            <p className="text-white font-bold">{pagsDebito.length}</p>
            <p className="text-blue-200 text-xs">Em débito</p>
          </div>
          <div className="bg-green-500/20 rounded-xl px-4 py-2 text-center">
            <p className="text-green-300 font-bold">{pagamentos.filter(p => p.status === 'pago').length}</p>
            <p className="text-blue-200 text-xs">Pagos</p>
          </div>
        </div>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          placeholder="Buscar por nome do cliente..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-10 h-11 bg-white border-gray-200"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Abas */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {abas.map(a => (
          <button
            key={a.key}
            onClick={() => setAbaAtiva(a.key)}
            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
              abaAtiva === a.key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Aba: Semana Atual */}
      {abaAtiva === 'semana' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 font-medium">
              {format(inicioSemana, "dd/MM", { locale: ptBR })} – {format(fimSemana, "dd/MM/yyyy", { locale: ptBR })}
            </p>
            <div className="text-sm text-right">
              <span className="text-gray-500">Total: </span>
              <span className="font-bold text-gray-800">{formatCurrency(pagsSemana.reduce((s,p) => s+(p.valor_total||0), 0))}</span>
            </div>
          </div>
          {pagsSemana.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>Nenhum serviço concluído esta semana</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pagsSemana.map(p => (
                <CardPagamento key={p.id} pag={p} onPagar={setPagarModal} onEditarValor={setEditarModal} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Aba: Em Débito */}
      {abaAtiva === 'debitos' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-600 font-semibold flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              Todos os clientes com saldo devedor
            </p>
            <p className="text-sm font-bold text-red-700">
              {formatCurrency(pagsDebito.reduce((s,p) => s + ((p.valor_total||0)-(p.valor_pago||0)), 0))} em débito
            </p>
          </div>
          {pagsDebito.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-400 opacity-60" />
              <p>Nenhum cliente em débito!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pagsDebito.map(p => (
                <CardPagamento key={p.id} pag={p} onPagar={setPagarModal} onEditarValor={setEditarModal} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Aba: Relatórios */}
      {abaAtiva === 'relatorio' && (
        <div className="space-y-4">
          {/* Filtros */}
          <Card className="bg-white border border-gray-200">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-gray-600 font-medium">
                <Filter className="w-4 h-4" />
                Filtros do Relatório
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Select value={relFiltro} onValueChange={setRelFiltro}>
                  <SelectTrigger className="h-10 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semana">Semana Atual</SelectItem>
                    <SelectItem value="mes">Mês Atual</SelectItem>
                    <SelectItem value="personalizado">Personalizado</SelectItem>
                    <SelectItem value="todos">Todos</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Filtrar por cliente..."
                    value={relCliente}
                    onChange={e => setRelCliente(e.target.value)}
                    className="pl-9 h-10 bg-white"
                  />
                </div>
              </div>
              {relFiltro === 'personalizado' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Data início</label>
                    <Input type="date" value={relDataInicio} onChange={e => setRelDataInicio(e.target.value)} className="h-10" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Data fim</label>
                    <Input type="date" value={relDataFim} onChange={e => setRelDataFim(e.target.value)} className="h-10" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resumo */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-white border border-gray-200">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-gray-500">Total</p>
                <p className="font-bold text-gray-800 text-sm">{formatCurrency(totalRelatorio)}</p>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border border-green-200">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-green-600">Pago</p>
                <p className="font-bold text-green-700 text-sm">{formatCurrency(totalPagoRelatorio)}</p>
              </CardContent>
            </Card>
            <Card className="bg-red-50 border border-red-200">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-red-600">Débito</p>
                <p className="font-bold text-red-700 text-sm">{formatCurrency(totalDebitoRelatorio)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Lista relatório */}
          <div className="space-y-2">
            {pagsRelatorio.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <History className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p>Nenhum registro no período</p>
              </div>
            ) : (
              pagsRelatorio.map(p => {
                const isPago = p.status === 'pago';
                return (
                  <div key={p.id} className={`rounded-xl border p-4 ${isPago ? 'bg-green-50 border-green-200' : p.status === 'parcial' ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800">{p.cliente_nome}</p>
                        <p className="text-xs text-gray-500 truncate">{p.tipo_servico}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {p.data_conclusao ? format(parseISO(p.data_conclusao), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '-'}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-gray-800">{formatCurrency(p.valor_total)}</p>
                        <p className="text-xs text-green-600">Pago: {formatCurrency(p.valor_pago)}</p>
                        {!isPago && <p className="text-xs text-red-600 font-semibold">Deve: {formatCurrency((p.valor_total||0)-(p.valor_pago||0))}</p>}
                        <Badge className={`text-xs mt-1 ${isPago ? 'bg-green-100 text-green-700' : p.status === 'parcial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                          {isPago ? 'Pago' : p.status === 'parcial' ? 'Parcial' : 'Pendente'}
                        </Badge>
                      </div>
                    </div>
                    {p.historico_pagamentos?.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                        {p.historico_pagamentos.map((h, i) => (
                          <div key={i} className="flex justify-between text-xs text-gray-500">
                            <span>{h.data}{h.observacao ? ` — ${h.observacao}` : ''}</span>
                            <span className="font-medium text-green-600">{formatCurrency(h.valor)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Modais */}
      <PagamentoModal
        open={!!pagarModal}
        onClose={() => setPagarModal(null)}
        pagamento={pagarModal}
        onSave={handleRegistrarPagamento}
      />
      <EditarValorModal
        open={!!editarModal}
        onClose={() => setEditarModal(null)}
        pagamento={editarModal}
        onSave={handleEditarValor}
      />
    </div>
  );
}