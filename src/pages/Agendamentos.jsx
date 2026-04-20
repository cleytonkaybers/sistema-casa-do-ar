import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, MapPin, Phone, User, Calendar, Clock, Search, X, MessageCircle, ClipboardList } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ServicoForm from '@/components/servicos/ServicoForm';
import { toast } from 'sonner';
import { usePermissions } from '@/components/auth/PermissionGuard';
import { formatTipoServicoCompact } from '@/utils';

const STATUS_CONFIG = {
  agendado:   { label: 'Agendado',   color: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  confirmado: { label: 'Confirmado', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  concluido:  { label: 'Concluído',  color: 'bg-white/5 text-gray-400 border-white/10' },
  cancelado:  { label: 'Cancelado',  color: 'bg-red-500/15 text-red-300 border-red-500/30' },
};

const EMPTY_FORM = {
  nome: '',
  telefone: '',
  localizacao: '',
  local: '',
  data_agendamento: '',
  horario: '',
  tipo_servico: '',
  observacoes: '',
  status: 'agendado',
};

function formatPhone(tel) {
  const d = (tel || '').replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return tel;
}

function whatsappLink(tel) {
  const d = (tel || '').replace(/\D/g, '');
  const num = d.length <= 11 ? `55${d}` : d;
  return `https://wa.me/${num}`;
}

function AgendamentoForm({ open, onClose, inicial, onSave }) {
  const [form, setForm] = useState(inicial || EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nome || !form.telefone || !form.data_agendamento) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <DialogTitle>{inicial?.id ? 'Editar Agendamento' : 'Novo Agendamento'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Nome *</label>
            <Input placeholder="Nome do cliente" value={form.nome} onChange={e => set('nome', e.target.value)} required />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Telefone / WhatsApp *</label>
            <Input placeholder="(00) 00000-0000" value={form.telefone} onChange={e => set('telefone', e.target.value)} required />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Localização (Endereço)</label>
            <Input placeholder="Rua, número, bairro, cidade" value={form.localizacao} onChange={e => set('localizacao', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Local do Serviço</label>
            <Input placeholder="Ex: Sala, Quarto, Escritório" value={form.local} onChange={e => set('local', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Data *</label>
              <Input type="date" value={form.data_agendamento} onChange={e => set('data_agendamento', e.target.value)} required />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Horário</label>
              <Input type="time" value={form.horario} onChange={e => set('horario', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Tipo de Serviço</label>
            <Input placeholder="Ex: Limpeza de 12k, Instalação..." value={form.tipo_servico} onChange={e => set('tipo_servico', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Status</label>
            <select
              className="w-full border border-white/10 rounded-md h-10 px-3 text-sm bg-[#0f1a2b] text-gray-200"
              value={form.status}
              onChange={e => set('status', e.target.value)}
            >
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Observações</label>
            <Input placeholder="Observações adicionais" value={form.observacoes} onChange={e => set('observacoes', e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving} style={{ backgroundColor: '#1e3a8a', color: '#fff' }}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Agendamentos() {
  const queryClient = useQueryClient();
  const { isAdmin } = usePermissions();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [novoServicoOpen, setNovoServicoOpen] = useState(false);
  const [novoServicoData, setNovoServicoData] = useState(null);

  const { data: agendamentos = [], isLoading } = useQuery({
    queryKey: ['agendamentos'],
    queryFn: () => base44.entities.Agendamento.list('-data_agendamento'),
  });

  const { data: equipes = [] } = useQuery({
    queryKey: ['equipes'],
    queryFn: () => base44.entities.Equipe.list(),
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.Agendamento.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agendamentos'] }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Agendamento.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agendamentos'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Agendamento.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agendamentos'] }),
  });

  const handleSave = async (form) => {
    if (editItem?.id) {
      await updateMut.mutateAsync({ id: editItem.id, data: form });
    } else {
      await createMut.mutateAsync(form);
    }
  };

  const handleEdit = (ag) => { setEditItem(ag); setFormOpen(true); };
  const handleNew = () => { setEditItem(null); setFormOpen(true); };
  const handleClose = () => { setFormOpen(false); setEditItem(null); };

  const handleCriarServico = (ag) => {
    setNovoServicoData({
      cliente_nome: ag.nome || '',
      telefone: ag.telefone || '',
      endereco: ag.localizacao || '',
      descricao: ag.observacoes || '',
      data_programada: ag.data_agendamento || '',
      horario: ag.horario || '',
      tipos_servico: ag.tipo_servico
        ? [{ tipo: ag.tipo_servico, quantidade: 1, equipamento: '' }]
        : [{ tipo: 'Limpeza de 9k', quantidade: 1, equipamento: '' }],
    });
    setNovoServicoOpen(true);
  };

  const handleSalvarNovoServico = async (data) => {
    try {
      const { sem_registro_cliente, tipos_servico, ...rest } = data;
      const tipoStr = Array.isArray(tipos_servico)
        ? tipos_servico.map(t => `${t.quantidade || 1}x ${t.tipo}`).join(', ')
        : '';
      // Gerar número de OS sequencial
      const todosServicos = await base44.entities.Servico.list();
      const maxOs = todosServicos
        .map(s => parseInt((s.os_numero || '').replace(/\D/g, '') || '0'))
        .reduce((max, n) => Math.max(max, n), 0);
      const os_numero = `OS-${String(maxOs + 1).padStart(4, '0')}`;
      await base44.entities.Servico.create({ ...rest, tipo_servico: tipoStr, status: 'aberto', os_numero });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      toast.success(`Serviço ${os_numero} criado com sucesso!`);
      setNovoServicoOpen(false);
      setNovoServicoData(null);
    } catch (err) {
      toast.error('Erro ao criar serviço');
    }
  };

  const lista = agendamentos.filter(a =>
    !search ||
    a.nome?.toLowerCase().includes(search.toLowerCase()) ||
    a.telefone?.includes(search)
  );

  // Agrupar por data
  const grupos = lista.reduce((acc, ag) => {
    const key = ag.data_agendamento || 'sem-data';
    if (!acc[key]) acc[key] = [];
    acc[key].push(ag);
    return acc;
  }, {});
  const datasOrdenadas = Object.keys(grupos).sort((a, b) => a > b ? 1 : -1);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl p-4 sm:p-5" style={{ backgroundColor: '#1e3a8a' }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Agendamentos</h1>
            <p className="text-blue-200/80 text-xs sm:text-sm mt-0.5">Clientes com serviços futuros agendados</p>
          </div>
          <Button onClick={handleNew} className="gap-2 flex-shrink-0" style={{ backgroundColor: '#f59e0b', color: '#1e3a8a' }}>
            <Plus className="w-4 h-4" /> Novo
          </Button>
        </div>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <Input
          placeholder="Buscar por nome ou telefone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 bg-[#0f1a2b] border-white/10 text-gray-200 placeholder:text-gray-500"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Lista agrupada por data */}
      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-400 rounded-full animate-spin" /></div>
      ) : lista.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <Calendar className="w-12 h-12 mb-3 text-gray-600" />
          <p className="font-medium">Nenhum agendamento encontrado</p>
          <p className="text-sm">Clique em "Novo" para adicionar</p>
        </div>
      ) : (
        <div className="space-y-6">
          {datasOrdenadas.map(data => (
            <div key={data}>
              {/* Cabeçalho da data */}
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-blue-400" />
                <h2 className="font-bold text-gray-200 text-sm">
                  {data === 'sem-data' ? 'Sem data definida' : (() => {
                    try { return format(parseISO(data), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR }); }
                    catch { return data; }
                  })()}
                </h2>
                <span className="text-xs text-gray-500 font-medium ml-1">({grupos[data].length})</span>
              </div>

              {/* Cards */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {grupos[data].map(ag => {
                  const sc = STATUS_CONFIG[ag.status] || STATUS_CONFIG.agendado;
                  return (
                    <div key={ag.id} className="bg-[#152236] rounded-2xl border border-white/5 shadow-sm p-4 flex flex-col gap-3 hover:border-white/10 transition-colors">
                      {/* Topo: nome + status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-500/20 border border-blue-500/30">
                            <User className="w-4 h-4 text-blue-300" />
                          </div>
                          <span className="font-semibold text-gray-200 truncate text-sm">{ag.nome}</span>
                        </div>
                        <Badge className={`text-xs border flex-shrink-0 ${sc.color}`}>{sc.label}</Badge>
                      </div>

                      {/* Horário + tipo */}
                      {(ag.horario || ag.tipo_servico) && (
                        <div className="flex flex-wrap gap-2">
                          {ag.horario && (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <Clock className="w-3 h-3" /> {ag.horario}
                            </span>
                          )}
                          {ag.tipo_servico && (
                            <span className="text-xs bg-blue-500/15 text-blue-300 px-2 py-0.5 rounded-full font-medium border border-blue-500/20">{formatTipoServicoCompact(ag.tipo_servico)}</span>
                          )}
                        </div>
                      )}

                      {/* Localização */}
                      {ag.localizacao && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ag.localizacao)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start gap-1.5 text-xs text-blue-400 hover:text-blue-300 hover:underline"
                        >
                          <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-2">{ag.localizacao}</span>
                        </a>
                      )}

                      {/* Local do serviço */}
                      {ag.local && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <span className="font-medium text-gray-300">Local:</span> {ag.local}
                        </div>
                      )}

                      {/* Observações */}
                      {ag.observacoes && (
                        <p className="text-xs text-gray-500 italic line-clamp-2">{ag.observacoes}</p>
                      )}

                      {/* Rodapé: WhatsApp + ações */}
                      <div className="flex items-center justify-between pt-1 border-t border-white/5">
                        <a
                          href={whatsappLink(ag.telefone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
                        >
                          <MessageCircle className="w-4 h-4" />
                          {formatPhone(ag.telefone)}
                        </a>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleCriarServico(ag)}
                            title="Criar serviço com dados deste agendamento"
                            className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-emerald-400 hover:text-emerald-300 transition-colors"
                          >
                            <ClipboardList className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleEdit(ag)} className="p-1.5 rounded-lg hover:bg-blue-500/10 text-blue-400 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteMut.mutate(ag.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <AgendamentoForm
        open={formOpen}
        onClose={handleClose}
        inicial={editItem}
        onSave={handleSave}
      />

      <ServicoForm
        open={novoServicoOpen}
        onClose={() => { setNovoServicoOpen(false); setNovoServicoData(null); }}
        onSave={handleSalvarNovoServico}
        prefilledData={novoServicoData}
        equipes={equipes}
        isAdmin={isAdmin}
      />
    </div>
  );
}