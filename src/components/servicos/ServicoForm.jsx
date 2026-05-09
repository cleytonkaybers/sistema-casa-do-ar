import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Search, ExternalLink, Plus, X, Minus, Wrench, Calendar, User } from 'lucide-react';
import { toast } from 'sonner';
import TimePickerClock from '@/components/ui/time-picker-clock';
import { base44 } from '@/api/base44Client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { MARCAS_AR, isInstalacao, embutirMarca, extrairMarca, removerMarca } from '@/lib/marcasAr';
import { matchClienteSearch } from '@/lib/utils/buscaCliente';

export default function ServicoForm({ open, onClose, onSave, servico, isLoading, prefilledData, equipes = [], currentUserEquipeId = null, isAdmin = false }) {
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [clienteSearch, setClienteSearch] = useState('');
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [servicoSearch, setServicoSearch] = useState('');
  const clienteSearchRef = useRef(null);

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list(),
  });

  const { data: tiposServicoValores = [] } = useQuery({
    queryKey: ['tiposServicoValor'],
    queryFn: () => base44.entities.TipoServicoValor.list(),
  });

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (clienteSearchRef.current && !clienteSearchRef.current.contains(e.target)) {
        setShowClienteDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const clientesFiltrados = clienteSearch.trim().length > 0
    ? clientes.filter(c => matchClienteSearch(c.nome, c.telefone, clienteSearch))
    : clientes.slice(0, 8);

  const servicosDisponiveis = tiposServicoValores.map(t => t.tipo_servico);

  const servicosFiltrados = servicoSearch.trim().length > 0
    ? servicosDisponiveis.filter(s => s.toLowerCase().includes(servicoSearch.toLowerCase()))
    : servicosDisponiveis;

  const calcularValorTotal = () => {
    let total = 0;
    formData.tipos_servico.forEach(item => {
      const tipoEncontrado = tiposServicoValores.find(t => t.tipo_servico === item.tipo);
      const valor = tipoEncontrado?.valor_tabela || 0;
      total += valor * (Number(item.quantidade) || 1);
    });
    return total;
  };

  const getValorTipo = (tipo) => {
    const tipoEncontrado = tiposServicoValores.find(t => t.tipo_servico === tipo);
    return tipoEncontrado?.valor_tabela || 0;
  };

  const handleSelectCliente = (cliente) => {
    const telefoneNormalizado = stripAndFormatPhone(cliente.telefone || '');
    setFormData(prev => ({
      ...prev,
      cliente_nome: cliente.nome || '',
      telefone: telefoneNormalizado,
      cpf: cliente.cpf || '',
      endereco: cliente.endereco || '',
      latitude: cliente.latitude || null,
      longitude: cliente.longitude || null,
    }));
    setClienteSearch(cliente.nome || '');
    setShowClienteDropdown(false);
    toast.success(`Cliente "${cliente.nome}" selecionado!`);
  };

  const [semRegistroCliente, setSemRegistroCliente] = useState(false);

  const [formData, setFormData] = useState({
    cliente_nome: '',
    cpf: '',
    telefone: '',
    endereco: '',
    google_maps_link: '',
    latitude: null,
    longitude: null,
    tipos_servico: [{ tipo: 'Limpeza de 9k', quantidade: 1, equipamento: '', marca: '' }],
    dia_semana: '',
    data_programada: '',
    horario: '',
    horario_alerta: false,
    descricao: '',
    valor: '',
    ativo: true,
    equipe_id: '',
    equipe_nome: '',
    equipamento: ''
  });

  useEffect(() => {
    if (!open) setSemRegistroCliente(false);
  }, [open]);

  useEffect(() => {
    if (servico) {
      setFormData({
        cliente_nome: servico.cliente_nome || '',
        cpf: servico.cpf || '',
        telefone: stripAndFormatPhone(servico.telefone || ''),
        endereco: servico.endereco || '',
        google_maps_link: servico.google_maps_link || '',
        latitude: servico.latitude || null,
        longitude: servico.longitude || null,
        tipos_servico: parseTiposServico(servico.tipo_servico),
        dia_semana: servico.dia_semana || '',
        data_programada: servico.data_programada || '',
        horario: servico.horario || '',
        horario_alerta: servico.horario_alerta || false,
        descricao: servico.descricao || '',
        valor: servico.valor || '',
        ativo: servico.ativo !== false,
        equipe_id: servico.equipe_id || '',
        equipe_nome: servico.equipe_nome || '',
        equipamento: servico.equipamento || ''
      });
    } else if (prefilledData) {
      setFormData({
        cliente_nome: prefilledData.cliente_nome || '',
        cpf: prefilledData.cpf || '',
        telefone: stripAndFormatPhone(prefilledData.telefone || ''),
        endereco: prefilledData.endereco || '',
        google_maps_link: prefilledData.google_maps_link || '',
        latitude: prefilledData.latitude || null,
        longitude: prefilledData.longitude || null,
        tipos_servico: prefilledData.tipos_servico
          ? prefilledData.tipos_servico.map(t => ({ ...t, marca: t.marca || '' }))
          : [{ tipo: 'Limpeza de 9k', quantidade: 1, equipamento: '', marca: '' }],
        dia_semana: prefilledData.dia_semana || '',
        data_programada: prefilledData.data_programada || '',
        horario: prefilledData.horario || '',
        descricao: prefilledData.descricao || '',
        valor: '',
        ativo: true,
        equipe_id: currentUserEquipeId || '',
        equipe_nome: '',
        equipamento: ''
      });
    } else {
      setFormData({
        cliente_nome: '',
        cpf: '',
        telefone: '',
        endereco: '',
        google_maps_link: '',
        latitude: null,
        longitude: null,
        tipos_servico: [{ tipo: 'Limpeza de 9k', quantidade: 1, equipamento: '', marca: '' }],
        dia_semana: '',
        data_programada: '',
        horario: '',
        descricao: '',
        valor: '',
        ativo: true,
        equipe_id: currentUserEquipeId || '',
        equipe_nome: '',
        equipamento: ''
      });
    }
  }, [servico, prefilledData, open, currentUserEquipeId]);

  useEffect(() => {
    const valorCalculado = calcularValorTotal();
    if (valorCalculado > 0) {
      setFormData(prev => ({ ...prev, valor: valorCalculado }));
    }
  }, [formData.tipos_servico, tiposServicoValores]);

  const parseTiposServico = (tipoServicoStr) => {
    if (!tipoServicoStr) return [{ tipo: 'Limpeza de 9k', quantidade: 1, equipamento: '', marca: '' }];
    const partes = tipoServicoStr.split(' + ').filter(Boolean);
    const chaves = [];
    const contagem = {};
    partes.forEach(p => {
      const match = p.match(/^(.+?)\s*\[(.+)\]$/);
      const tipo = match ? match[1].trim() : p.trim();
      const equipamentoBruto = match ? match[2].trim() : '';
      // Extrai marca do equipamento (formato "Marca: LG | Sala")
      const marca = extrairMarca(equipamentoBruto) || '';
      const equipamento = removerMarca(equipamentoBruto);
      const key = `${tipo}||${marca}||${equipamento}`;
      if (!contagem[key]) { contagem[key] = { tipo, quantidade: 0, marca, equipamento }; chaves.push(key); }
      contagem[key].quantidade += 1;
    });
    return chaves.map(k => contagem[k]);
  };

  const formatPhoneInput = (value) => {
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned) return '';
    if (cleaned.length <= 2) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 2)} ${cleaned.slice(2)}`;
    if (cleaned.length <= 10) return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
  };

  const stripAndFormatPhone = (value) => {
    let cleaned = (value || '').replace(/\D/g, '');
    if (cleaned.startsWith('55') && cleaned.length > 11) cleaned = cleaned.slice(2);
    return formatPhoneInput(cleaned);
  };

  const handlePhoneChange = (e) => {
    setFormData({ ...formData, telefone: stripAndFormatPhone(e.target.value) });
  };

  // Busca automática ao colar link do Google Maps
  useEffect(() => {
    const link = formData.google_maps_link?.trim();
    if (link && (link.includes('google.com/maps') || link.includes('goo.gl/maps')) && !formData.latitude) {
      const timer = setTimeout(() => {
        handleSearchLocation();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [formData.google_maps_link]);

  const formatCPF = (value) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
    if (cleaned.length <= 9) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
    return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9, 11)}`;
  };

  const handleCPFChange = (e) => {
    const formatted = formatCPF(e.target.value);
    setFormData({ ...formData, cpf: formatted });
  };

  const handleSearchLocation = async () => {
    const input = (formData.google_maps_link || formData.endereco)?.trim();
    if (!input) {
      toast.error('Digite um endereço ou cole um link do Google Maps');
      return;
    }

    setLoadingLocation(true);
    try {
      const coordRegex = /^-?\d+\.?\d*,\s*-?\d+\.?\d*$/;
      if (coordRegex.test(input)) {
        const [lat, lng] = input.split(',').map(c => parseFloat(c.trim()));
        setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
        toast.success(`Coordenadas salvas: ${lat}, ${lng}`);
        setLoadingLocation(false);
        return;
      }

      const isGoogleMapsLink = input.includes('google.com/maps') || input.includes('maps.app.goo.gl') || input.includes('goo.gl/maps') || input.includes('maps.google.com');

      if (isGoogleMapsLink) {
        const coordMatch = input.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
        if (coordMatch) {
          const lat = parseFloat(coordMatch[1]);
          const lng = parseFloat(coordMatch[2]);
          setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
          toast.success(`Localização vinculada: ${lat}, ${lng}`);
          setLoadingLocation(false);
          return;
        }

        const result = await base44.integrations.Core.InvokeLLM({
          prompt: `Acesse este link do Google Maps e extraia as coordenadas EXATAS: "${input}"`,
          add_context_from_internet: true,
          response_json_schema: {
            type: "object",
            properties: {
              latitude: { type: "number" },
              longitude: { type: "number" }
            },
            required: ["latitude", "longitude"]
          }
        });

        if (result?.latitude && result?.longitude) {
          setFormData(prev => ({ ...prev, latitude: result.latitude, longitude: result.longitude }));
          toast.success(`Localização vinculada: ${result.latitude}, ${result.longitude}`);
        }
      } else {
        const result = await base44.integrations.Core.InvokeLLM({
          prompt: `Encontre as coordenadas para: "${input}" no Brasil`,
          add_context_from_internet: true,
          response_json_schema: {
            type: "object",
            properties: {
              latitude: { type: "number" },
              longitude: { type: "number" }
            },
            required: ["latitude", "longitude"]
          }
        });

        if (result?.latitude && result?.longitude) {
          setFormData(prev => ({ ...prev, latitude: result.latitude, longitude: result.longitude }));
          toast.success(`Coordenadas encontradas: ${result.latitude}, ${result.longitude}`);
        }
      }
    } catch {
      toast.error('Erro ao buscar localização');
    } finally {
      setLoadingLocation(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.cliente_nome?.trim()) {
      toast.error('Nome do cliente é obrigatório!');
      return;
    }

    if (!formData.telefone?.trim()) {
      toast.error('Telefone é obrigatório!');
      return;
    }

    if (!formData.data_programada) {
      toast.error('Data programada é obrigatória!');
      return;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataProgramada = new Date(formData.data_programada + 'T00:00:00');
    dataProgramada.setHours(0, 0, 0, 0);

    if (dataProgramada < hoje) {
      toast.error('Data programada não pode ser anterior à data de hoje!');
      return;
    }

    const data = parseISO(formData.data_programada);
    const diaSemanaFormatado = format(data, 'EEEE', { locale: ptBR });
    const diaSemana = diaSemanaFormatado.charAt(0).toUpperCase() + diaSemanaFormatado.slice(1);

    const equipeSelecionada = equipes.find(e => e.id === formData.equipe_id);

    const tiposExpandidos = formData.tipos_servico.flatMap(item => {
      // Embute marca apenas para Instalacao; demais tipos so usam equipamento
      const equipFinal = embutirMarca(
        isInstalacao(item.tipo) ? (item.marca || '') : '',
        item.equipamento || ''
      );
      const label = equipFinal ? `${item.tipo} [${equipFinal}]` : item.tipo;
      return Array(Number(item.quantidade) || 1).fill(label);
    });

    const equipamentoGlobal = formData.tipos_servico
      .map(item => item.equipamento)
      .filter(Boolean)
      .join(' | ') || null;

    const telLimpo = (formData.telefone || '').replace(/\D/g, '');
    const telefoneFinal = telLimpo
      ? (telLimpo.startsWith('55') && telLimpo.length > 11 ? '+' + telLimpo : '+55' + telLimpo)
      : '';

    const dataToSave = {
      ...formData,
      telefone: telefoneFinal,
      tipo_servico: tiposExpandidos.join(' + '),
      dia_semana: diaSemana,
      valor: formData.valor ? parseFloat(formData.valor) : 0,
      equipe_id: formData.equipe_id || null,
      equipe_nome: equipeSelecionada?.nome || null,
      sem_registro_cliente: semRegistroCliente,
      equipamento: equipamentoGlobal,
      google_maps_link: formData.google_maps_link || null
    };
    delete dataToSave.tipos_servico;

    onSave(dataToSave);
  };

  // Estilos reutilizáveis para o tema escuro
  const inputDark = "bg-[#1e2a3a] border-[#2d3f55] text-white placeholder:text-gray-500 focus:border-blue-400 focus:ring-blue-400/20";
  const labelDark = "text-gray-300 text-sm font-medium";
  const selectDark = "bg-[#1e2a3a] border-[#2d3f55] text-white";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto border-0 p-0"
        style={{ background: '#0f1923', boxShadow: '0 25px 60px rgba(0,0,0,0.8)' }}
      >
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-white/10">
          <DialogTitle className="text-white text-xl font-bold flex items-center gap-2">
            <span className="text-lg">📋</span>
            {servico ? 'Editar Serviço' : 'Novo Serviço'}
            {servico?.os_numero && (
              <span className="ml-2 text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                {servico.os_numero}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6">

          {/* ── SEÇÃO: Dados do Cliente ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-purple-400" />
              <span className="text-purple-400 font-semibold text-sm tracking-wide uppercase">Dados do Cliente</span>
            </div>

            {/* Nome + Telefone — nome tem autocomplete de clientes cadastrados */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className={labelDark}>Nome do Cliente *</Label>
                <div className="relative" ref={clienteSearchRef}>
                  <Input
                    value={formData.cliente_nome}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({ ...formData, cliente_nome: val });
                      setClienteSearch(val);
                      setShowClienteDropdown(val.trim().length > 0);
                    }}
                    onFocus={() => {
                      if (formData.cliente_nome.trim().length > 0) setShowClienteDropdown(true);
                    }}
                    placeholder="Nome completo"
                    required
                    autoComplete="off"
                    className={inputDark}
                  />
                  {showClienteDropdown && clientesFiltrados.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-[#1e2a3a] border border-[#2d3f55] rounded-lg shadow-2xl max-h-52 overflow-y-auto">
                      {clientesFiltrados.map(cliente => (
                        <button
                          key={cliente.id}
                          type="button"
                          onPointerDown={(e) => e.preventDefault()}
                          onClick={() => { handleSelectCliente(cliente); setShowClienteDropdown(false); }}
                          className="w-full text-left px-3 py-2.5 hover:bg-white/10 active:bg-white/20 transition-colors border-b border-white/5 last:border-0"
                        >
                          <p className="font-medium text-white text-sm">{cliente.nome}</p>
                          <p className="text-xs text-gray-400">{cliente.telefone}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <Label className={labelDark}>Telefone *</Label>
                <Input
                  value={formData.telefone}
                  onChange={handlePhoneChange}
                  onPaste={(e) => {
                    e.preventDefault();
                    setFormData({ ...formData, telefone: stripAndFormatPhone(e.clipboardData.getData('text')) });
                  }}
                  placeholder="(00) 00000-0000"
                  required
                  maxLength={14}
                  className={inputDark}
                />
              </div>
            </div>

            {/* CPF */}
            <div className="space-y-1">
              <Label className={labelDark}>CPF / CNPJ</Label>
              <Input
                value={formData.cpf}
                onChange={handleCPFChange}
                placeholder="000.000.000-00"
                maxLength={14}
                className={inputDark}
              />
            </div>

            {/* Endereço */}
            <div className="space-y-1">
              <Label className={labelDark}>Endereço do Serviço</Label>
              <Input
                value={formData.endereco}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                placeholder="Rua, número, bairro, cidade"
                className={inputDark}
              />
            </div>

            {/* Link Google Maps */}
            <div className="space-y-1">
              <Label className={labelDark}>Link do Google Maps</Label>
              <div className="flex gap-2">
                <Input
                  value={formData.google_maps_link}
                  onChange={(e) => setFormData({ ...formData, google_maps_link: e.target.value })}
                  placeholder="https://maps.google.com/..."
                  className={`flex-1 ${inputDark}`}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSearchLocation}
                  disabled={loadingLocation || (!formData.google_maps_link && !formData.endereco)}
                  className="border-[#2d3f55] bg-[#1e2a3a] text-white hover:bg-white/10"
                >
                  {loadingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
                {(formData.latitude && formData.longitude) || formData.endereco ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const url = formData.latitude && formData.longitude
                        ? `https://www.google.com/maps?q=${formData.latitude},${formData.longitude}`
                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formData.endereco)}`;
                      window.open(url, '_blank');
                    }}
                    className="border-[#2d3f55] bg-[#1e2a3a] text-white hover:bg-white/10"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-gray-500">Cole aqui o link do Google Maps para o endereço do cliente</p>
            </div>
          </div>

          {/* ── SEÇÃO: Detalhes do Serviço ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pt-1">
              <Wrench className="w-4 h-4 text-blue-400" />
              <span className="text-blue-400 font-semibold text-sm tracking-wide uppercase">Detalhes do Serviço</span>
            </div>

            {/* Tipos de Serviço + Valor */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <div className="space-y-1">
                <Label className={labelDark}>Tipo de Serviço *</Label>
                <div className="space-y-3">
                  {formData.tipos_servico.map((item, index) => (
                    <div key={index} className="rounded-lg border border-[#2d3f55] bg-[#152236] p-2.5 space-y-2">
                      {/* Linha 1: Select de tipo + botao remover */}
                      <div className="flex gap-2 items-center">
                        <Select
                          value={item.tipo}
                          onValueChange={(value) => {
                            const newTipos = [...formData.tipos_servico];
                            newTipos[index] = { ...newTipos[index], tipo: value };
                            setFormData({ ...formData, tipos_servico: newTipos });
                            setServicoSearch('');
                          }}
                        >
                          <SelectTrigger className={`flex-1 ${selectDark}`}>
                            {/* Children explicito garante que o tipo SALVO no servico
                                aparece mesmo se a TabelaServicos atual nao tiver
                                exatamente o mesmo nome (tipo renomeado/excluido). */}
                            <SelectValue placeholder="Selecione o serviço">
                              {item.tipo || 'Selecione o serviço'}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent
                            className="bg-[#1e2a3a] border-[#2d3f55] text-white max-h-80"
                            onOpenAutoFocus={(e) => e.preventDefault()}
                          >
                            <div className="sticky top-0 bg-[#1e2a3a] border-b border-[#2d3f55] p-2">
                              <Input
                                placeholder="Buscar serviço..."
                                value={servicoSearch}
                                onChange={(e) => setServicoSearch(e.target.value)}
                                className={`h-8 text-sm ${inputDark}`}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                              />
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                              {/* Garante que o tipo atual sempre esta na lista
                                  (mesmo se foi removido do TipoServicoValor, evita
                                  ficar selecionado um valor que nao existe nos items). */}
                              {item.tipo && !servicosFiltrados.includes(item.tipo) && (
                                <SelectItem
                                  key={`__atual_${item.tipo}`}
                                  value={item.tipo}
                                  className="text-amber-300 hover:bg-white/10 italic"
                                >
                                  {item.tipo} <span className="text-[10px] text-amber-400/70">(atual)</span>
                                </SelectItem>
                              )}
                              {servicosFiltrados.map(s => (
                                <SelectItem key={s} value={s} className="text-white hover:bg-white/10">{s}</SelectItem>
                              ))}
                            </div>
                          </SelectContent>
                        </Select>

                        {formData.tipos_servico.length > 1 && (
                          <Button
                            type="button" variant="outline" size="icon"
                            onClick={() => setFormData({ ...formData, tipos_servico: formData.tipos_servico.filter((_, i) => i !== index) })}
                            className="h-10 w-10 border-red-800 bg-red-900/30 text-red-400 hover:bg-red-900/50 flex-shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>

                      {/* Linha de quantidade — em mobile fica em sua propria linha
                          com botoes maiores (40x40px, easy-to-tap) e contador grande */}
                      <div className="flex items-center justify-between gap-2 bg-[#0f1a2b] rounded-md px-3 py-2 border border-[#2d3f55]">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Quantidade</span>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button" variant="outline" size="icon"
                            className="h-10 w-10 border-[#2d3f55] bg-[#1e2a3a] text-white hover:bg-white/10 flex-shrink-0"
                            style={{ touchAction: 'manipulation' }}
                            onClick={() => {
                              const newTipos = [...formData.tipos_servico];
                              newTipos[index] = { ...newTipos[index], quantidade: Math.max(1, (Number(item.quantidade) || 1) - 1) };
                              setFormData({ ...formData, tipos_servico: newTipos });
                            }}
                            disabled={item.quantidade <= 1}
                            aria-label="Diminuir quantidade"
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <Input
                            type="number" min={1} max={99}
                            inputMode="numeric"
                            value={item.quantidade}
                            onChange={(e) => {
                              const newTipos = [...formData.tipos_servico];
                              newTipos[index] = { ...newTipos[index], quantidade: Math.max(1, Math.min(99, parseInt(e.target.value) || 1)) };
                              setFormData({ ...formData, tipos_servico: newTipos });
                            }}
                            className={`w-14 h-10 text-center font-bold text-base px-1 ${inputDark}`}
                          />
                          <Button
                            type="button" variant="outline" size="icon"
                            className="h-10 w-10 border-[#2d3f55] bg-[#1e2a3a] text-white hover:bg-white/10 flex-shrink-0"
                            style={{ touchAction: 'manipulation' }}
                            onClick={() => {
                              const newTipos = [...formData.tipos_servico];
                              newTipos[index] = { ...newTipos[index], quantidade: Math.min(99, (Number(item.quantidade) || 1) + 1) };
                              setFormData({ ...formData, tipos_servico: newTipos });
                            }}
                            disabled={item.quantidade >= 99}
                            aria-label="Aumentar quantidade"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Linha 2a: Marca do AR (so para Instalacao) */}
                      {isInstalacao(item.tipo) && (
                        <Select
                          value={item.marca || ''}
                          onValueChange={(value) => {
                            const newTipos = [...formData.tipos_servico];
                            newTipos[index] = { ...newTipos[index], marca: value };
                            setFormData({ ...formData, tipos_servico: newTipos });
                          }}
                        >
                          <SelectTrigger className={`h-8 text-sm ${selectDark}`}>
                            <SelectValue placeholder="🏷️ Marca do ar-condicionado (opcional)" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1e2a3a] border-[#2d3f55] text-white max-h-72">
                            {MARCAS_AR.map(m => (
                              <SelectItem key={m} value={m} className="text-white hover:bg-white/10">{m}</SelectItem>
                            ))}
                            <SelectItem value="Outra" className="text-white hover:bg-white/10 italic">Outra (digite no equipamento)</SelectItem>
                          </SelectContent>
                        </Select>
                      )}

                      {/* Linha 2b: Equipamento */}
                      <Input
                        value={item.equipamento || ''}
                        onChange={(e) => {
                          const newTipos = [...formData.tipos_servico];
                          newTipos[index] = { ...newTipos[index], equipamento: e.target.value };
                          setFormData({ ...formData, tipos_servico: newTipos });
                        }}
                        placeholder={isInstalacao(item.tipo)
                          ? "Local / detalhes (ex: Sala, Quarto, 220V...)"
                          : "Equipamento (ex: Sala, Quarto, 9.000 BTUs...)"}
                        className={`h-8 text-sm ${inputDark}`}
                      />
                    </div>
                  ))}
                  <Button
                    type="button" variant="outline"
                    onClick={() => setFormData({ ...formData, tipos_servico: [...formData.tipos_servico, { tipo: servicosFiltrados[0] || 'Limpeza de 9k', quantidade: 1, equipamento: '', marca: '' }] })}
                    className="w-full border-dashed border-[#2d3f55] bg-transparent text-gray-400 hover:bg-white/5 hover:text-white text-xs"
                  >
                    <Plus className="w-3 h-3 mr-1" /> Adicionar tipo de serviço
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className={labelDark}>Valor (R$)</Label>
                <Input
                  type="number" step="0.01"
                  value={formData.valor}
                  onChange={(e) => isAdmin && setFormData({ ...formData, valor: e.target.value })}
                  placeholder="0.00"
                  readOnly={!isAdmin}
                  className={`${inputDark} ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
                {formData.tipos_servico.length > 0 && calcularValorTotal() > 0 && (
                  <div className="text-xs text-gray-500 space-y-0.5 mt-1">
                    {formData.tipos_servico.map((item, idx) => {
                      const valor = getValorTipo(item.tipo);
                      return valor > 0 ? (
                        <div key={idx}>{item.tipo}: R$ {valor.toFixed(2)} × {item.quantidade}</div>
                      ) : null;
                    })}
                    <div className="font-semibold text-gray-400 pt-0.5 border-t border-gray-700">
                      Total: R$ {calcularValorTotal().toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Equipe */}
            {equipes.length > 0 && isAdmin && (
              <div className="space-y-1">
                <Label className={labelDark}>Equipe Responsável *</Label>
                <Select
                  value={formData.equipe_id || 'sem-equipe'}
                  onValueChange={(value) => setFormData({ ...formData, equipe_id: value === 'sem-equipe' ? '' : value })}
                >
                  <SelectTrigger className={selectDark}>
                    <SelectValue placeholder="Selecione a equipe" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1e2a3a] border-[#2d3f55] text-white">
                    <SelectItem value="sem-equipe" className="text-gray-400">Sem equipe específica</SelectItem>
                    {equipes.map(eq => (
                      <SelectItem key={eq.id} value={eq.id} className="text-white hover:bg-white/10">{eq.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* ── SEÇÃO: Agendamento ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pt-1">
              <Calendar className="w-4 h-4 text-blue-400" />
              <span className="text-blue-400 font-semibold text-sm tracking-wide uppercase">Agendamento</span>
            </div>

            {/* Data + Horário */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className={labelDark}>Data Programada *</Label>
                <Input
                  type="date"
                  value={formData.data_programada}
                  onChange={(e) => setFormData({ ...formData, data_programada: e.target.value })}
                  className={inputDark}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className={labelDark}>Horário Programado</Label>
                <TimePickerClock
                  value={formData.horario}
                  onChange={(time) => setFormData({ ...formData, horario: time })}
                />
              </div>
            </div>

            {/* OBS para os técnicos */}
            <div className="space-y-1">
              <Label className={labelDark}>OBS (observações para os técnicos)</Label>
              <Textarea
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Ex: Portão azul, ligar antes de chegar, morador só à tarde..."
                rows={3}
                className={`resize-none ${inputDark}`}
              />
            </div>

            {/* Checkboxes compactos */}
            <div className="flex flex-wrap gap-2">
              <label htmlFor="horario_alerta" className={`flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer transition-colors select-none text-xs font-medium ${formData.horario_alerta ? 'border-yellow-600/60 bg-yellow-900/20 text-yellow-400' : 'border-white/10 bg-white/5 text-gray-400 hover:border-yellow-700/40 hover:text-yellow-500'}`}>
                <input
                  type="checkbox"
                  id="horario_alerta"
                  checked={formData.horario_alerta || false}
                  onChange={(e) => setFormData({ ...formData, horario_alerta: e.target.checked })}
                  className="hidden"
                />
                ⚠️ Horário Fixo — O técnico NÃO pode atrasar
              </label>

              {!servico && (
                <label htmlFor="sem_registro_cliente" className={`flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer transition-colors select-none text-xs font-medium ${semRegistroCliente ? 'border-orange-600/60 bg-orange-900/20 text-orange-400' : 'border-white/10 bg-white/5 text-gray-400 hover:border-orange-700/40 hover:text-orange-500'}`}>
                  <input
                    type="checkbox"
                    id="sem_registro_cliente"
                    checked={semRegistroCliente}
                    onChange={(e) => setSemRegistroCliente(e.target.checked)}
                    className="hidden"
                  />
                  Serviço avulso (sem vínculo)
                </label>
              )}
            </div>
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="border-[#2d3f55] bg-transparent text-gray-300 hover:bg-white/10 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              style={{ background: 'linear-gradient(135deg, #1e40af 0%, #0ea5e9 100%)' }}
              className="text-white font-semibold px-6 hover:opacity-90 border-0"
            >
              {isLoading
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
                : servico ? 'Salvar Alterações' : 'Agendar Serviço'
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
