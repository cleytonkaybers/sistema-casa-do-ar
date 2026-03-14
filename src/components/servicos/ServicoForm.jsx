import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input as UIInput } from '@/components/ui/input';
import { ChevronDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, MapPin, Search, ExternalLink, Users, Plus, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import TimePickerClock from '@/components/ui/time-picker-clock';
import { base44 } from '@/api/base44Client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { TIPOS_SERVICOS } from '@/components/utils/tiposServicos';

export default function ServicoForm({ open, onClose, onSave, servico, isLoading, prefilledData, equipes = [], currentUserEquipeId = null, isAdmin = false }) {
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [clienteSearch, setClienteSearch] = useState('');
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const clienteSearchRef = useRef(null);

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list(),
  });

  const { data: precificacoes = [] } = useQuery({
    queryKey: ['precificacoes'],
    queryFn: () => base44.entities.PrecificacaoServico.list(),
  });

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (clienteSearchRef.current && !clienteSearchRef.current.contains(e.target)) {
        setShowClienteDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const clientesFiltrados = clienteSearch.trim().length > 0
    ? clientes.filter(c =>
        c.nome?.toLowerCase().includes(clienteSearch.toLowerCase()) ||
        c.telefone?.includes(clienteSearch)
      )
    : clientes.slice(0, 8);

  const [tipoOpen, setTipoOpen] = useState(null); // null ou índice
  const [tipoSearch, setTipoSearch] = useState('');

  const handleSelectCliente = (cliente) => {
    setFormData(prev => ({
      ...prev,
      cliente_nome: cliente.nome || '',
      telefone: cliente.telefone || '',
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
    latitude: null,
    longitude: null,
    tipos_servico: [{ tipo: 'Limpeza de 9k', multiplicador: 1 }],
    dia_semana: '',
    data_programada: '',
    horario: '',
    descricao: '',
    valor: '',
    ativo: true,
    equipe_id: '',
    equipe_nome: ''
  });

  useEffect(() => {
    if (!open) setSemRegistroCliente(false);
  }, [open]);

  useEffect(() => {
    if (servico) {
      setFormData({
        cliente_nome: servico.cliente_nome || '',
        cpf: servico.cpf || '',
        telefone: servico.telefone || '',
        endereco: servico.endereco || '',
        latitude: servico.latitude || null,
        longitude: servico.longitude || null,
        tipos_servico: servico.tipo_servico ? [{ tipo: servico.tipo_servico, multiplicador: 1 }] : [{ tipo: 'Limpeza de 9k', multiplicador: 1 }],
        dia_semana: servico.dia_semana || '',
        data_programada: servico.data_programada || '',
        horario: servico.horario || '',
        descricao: servico.descricao || '',
        valor: servico.valor || '',
        ativo: servico.ativo !== false,
        equipe_id: servico.equipe_id || '',
        equipe_nome: servico.equipe_nome || ''
      });
    } else if (prefilledData) {
      setFormData({
        cliente_nome: prefilledData.cliente_nome || '',
        cpf: prefilledData.cpf || '',
        telefone: prefilledData.telefone || '',
        endereco: prefilledData.endereco || '',
        latitude: prefilledData.latitude || null,
        longitude: prefilledData.longitude || null,
        tipos_servico: [{ tipo: 'Limpeza de 9k', multiplicador: 1 }],
        dia_semana: '',
        data_programada: '',
        horario: '',
        descricao: '',
        valor: '',
        ativo: true,
        equipe_id: currentUserEquipeId || '',
        equipe_nome: ''
      });
    } else {
      setFormData({
        cliente_nome: '',
        cpf: '',
        telefone: '',
        endereco: '',
        latitude: null,
        longitude: null,
        tipos_servico: [{ tipo: 'Limpeza de 9k', multiplicador: 1 }],
        dia_semana: '',
        data_programada: '',
        horario: '',
        descricao: '',
        valor: '',
        ativo: true,
        equipe_id: currentUserEquipeId || '',
        equipe_nome: ''
      });
    }
  }, [servico, prefilledData, open, currentUserEquipeId]);

  const formatPhoneInput = (value) => {
    const cleaned = value.replace(/\D/g, '');
    let formatted = cleaned;
    if (cleaned.length > 0) {
      if (cleaned.length <= 2) {
        formatted = `+${cleaned}`;
      } else if (cleaned.length <= 4) {
        formatted = `+${cleaned.slice(0, 2)} ${cleaned.slice(2)}`;
      } else if (cleaned.length <= 9) {
        formatted = `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4)}`;
      } else {
        formatted = `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 9)}-${cleaned.slice(9, 13)}`;
      }
    }
    return formatted;
  };

  const handlePhoneChange = (e) => {
    const formatted = formatPhoneInput(e.target.value);
    setFormData({ ...formData, telefone: formatted });
  };

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

  const handleImportContact = async () => {
    if (!('contacts' in navigator && 'ContactsManager' in window)) {
      toast.error('Seu navegador não suporta importação de contatos. Use um dispositivo móvel com Chrome ou Edge.');
      return;
    }

    setLoadingContacts(true);
    try {
      const props = ['name', 'tel', 'address'];
      const opts = { multiple: false };
      const contacts = await navigator.contacts.select(props, opts);
      
      if (contacts && contacts.length > 0) {
        const contact = contacts[0];
        const nome = contact.name?.[0] || '';
        let telefone = contact.tel?.[0] || '';
        
        if (telefone) {
          telefone = telefone.replace(/\D/g, '');
          if (telefone.startsWith('55') && telefone.length > 11) {
            telefone = telefone.slice(2);
          }
          telefone = formatPhoneInput(telefone);
        }
        
        let endereco = '';
        if (contact.address && contact.address.length > 0) {
          const addr = contact.address[0];
          const parts = [addr.streetAddress, addr.locality, addr.region].filter(Boolean);
          endereco = parts.join(', ');
        }

        setFormData(prev => ({
          ...prev,
          cliente_nome: nome || prev.cliente_nome,
          telefone: telefone || prev.telefone,
          endereco: endereco || prev.endereco
        }));
        
        toast.success('Contato importado com sucesso!');
      }
    } catch (error) {
      if (error.name !== 'TypeError') {
        console.error('Erro ao importar contato:', error);
        toast.error('Não foi possível importar o contato');
      }
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleSearchLocation = async () => {
    const input = formData.endereco?.trim();
    if (!input) {
      toast.error('Digite um endereço, coordenadas ou cole um link do Google Maps');
      return;
    }

    setLoadingLocation(true);
    try {
      const coordRegex = /^-?\d+\.?\d*,\s*-?\d+\.?\d*$/;
      if (coordRegex.test(input)) {
        const [lat, lng] = input.split(',').map(c => parseFloat(c.trim()));
        if (lat < -34 || lat > 5 || lng < -74 || lng > -34) {
          toast.error('Coordenadas fora do Brasil. Verifique os valores.');
          setLoadingLocation(false);
          return;
        }
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
          if (lat >= -34 && lat <= 5 && lng >= -74 && lng <= -34) {
            setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
            toast.success(`Localização vinculada: ${lat}, ${lng}`);
            setLoadingLocation(false);
            return;
          }
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
    } catch (error) {
      toast.error('Erro ao buscar localização');
    } finally {
      setLoadingLocation(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validar campos obrigatórios
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
    
    // Validar que a data não seja anterior à data de hoje
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataProgramada = new Date(formData.data_programada + 'T00:00:00');
    dataProgramada.setHours(0, 0, 0, 0);
    
    if (dataProgramada < hoje) {
      toast.error('Data programada não pode ser anterior à data de hoje!');
      return;
    }
    
    // Calcular dia da semana automaticamente a partir da data programada
    const data = parseISO(formData.data_programada);
    const diaSemanaFormatado = format(data, 'EEEE', { locale: ptBR });
    const diaSemana = diaSemanaFormatado.charAt(0).toUpperCase() + diaSemanaFormatado.slice(1);
    
    // Resolve nome da equipe
    const equipeSelecionada = equipes.find(e => e.id === formData.equipe_id);

    const dataToSave = {
      ...formData,
      tipo_servico: formData.tipos_servico.map(t => t.multiplicador > 1 ? `${t.tipo} (x${t.multiplicador})` : t.tipo).join(' + '),
      dia_semana: diaSemana,
      valor: formData.valor ? parseFloat(formData.valor) : 0,
      equipe_id: formData.equipe_id || null,
      equipe_nome: equipeSelecionada?.nome || null,
      sem_registro_cliente: semRegistroCliente
    };
    delete dataToSave.tipos_servico;
    
    onSave(dataToSave);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{servico ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {!servico && (
            <div className="space-y-1">
              <Label>Buscar Cliente Cadastrado</Label>
              <div className="relative" ref={clienteSearchRef}>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                  <Input
                    value={clienteSearch}
                    onChange={(e) => {
                      setClienteSearch(e.target.value);
                      setShowClienteDropdown(true);
                    }}
                    onFocus={() => setShowClienteDropdown(true)}
                    placeholder="Digite o nome ou telefone do cliente..."
                    className="pl-9 border-purple-200 focus:border-purple-400"
                  />
                  {clienteSearch && (
                    <button
                      type="button"
                      onClick={() => { setClienteSearch(''); setShowClienteDropdown(false); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {showClienteDropdown && clientesFiltrados.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {clientesFiltrados.map(cliente => (
                      <button
                        key={cliente.id}
                        type="button"
                        onClick={() => handleSelectCliente(cliente)}
                        className="w-full text-left px-4 py-2.5 hover:bg-purple-50 transition-colors border-b border-gray-100 last:border-0"
                      >
                        <p className="font-medium text-gray-800 text-sm">{cliente.nome}</p>
                        <p className="text-xs text-gray-500">{cliente.telefone}{cliente.endereco ? ` • ${cliente.endereco.slice(0, 40)}...` : ''}</p>
                      </button>
                    ))}
                  </div>
                )}
                {showClienteDropdown && clienteSearch.trim().length > 0 && clientesFiltrados.length === 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-center text-sm text-gray-500">
                    Nenhum cliente encontrado
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cliente_nome">Nome do Cliente *</Label>
              <Input
                id="cliente_nome"
                value={formData.cliente_nome}
                onChange={(e) => setFormData({ ...formData, cliente_nome: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone *</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={handlePhoneChange}
                required
                maxLength={18}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cpf">CPF (Opcional)</Label>
            <Input
              id="cpf"
              value={formData.cpf}
              onChange={handleCPFChange}
              placeholder="000.000.000-00"
              maxLength={14}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endereco">Endereço / Link Google Maps</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="endereco"
                  value={formData.endereco}
                  onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                  className="pl-10"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleSearchLocation}
                disabled={loadingLocation || !formData.endereco}
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
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tipos de Serviço *</Label>
            <div className="space-y-2">
              {formData.tipos_servico.map((item, index) => {
                const tiposFiltrados = tipoOpen === index && tipoSearch.trim()
                  ? TIPOS_SERVICOS.filter(t => t.toLowerCase().includes(tipoSearch.toLowerCase()))
                  : tipoOpen === index ? TIPOS_SERVICOS : [];

                return (
                <div key={index} className="flex gap-2">
                  <Popover open={tipoOpen === index} onOpenChange={(open) => {
                    setTipoOpen(open ? index : null);
                    setTipoSearch('');
                  }}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="flex-1 justify-between text-left">
                        <span className="truncate">{item.tipo}</span>
                        <ChevronDown className="w-4 h-4 ml-2 flex-shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-0" align="start">
                      <div className="sticky top-0 bg-white border-b p-2 z-10">
                        <UIInput
                          placeholder="Buscar serviço..."
                          value={tipoSearch}
                          onChange={(e) => setTipoSearch(e.target.value)}
                          className="h-8 text-sm"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {tiposFiltrados.length > 0 ? (
                          tiposFiltrados.map(tipo => (
                            <button
                              key={tipo}
                              type="button"
                              onClick={() => {
                                const newTipos = [...formData.tipos_servico];
                                newTipos[index].tipo = tipo;

                                // Calcular soma dos valores
                                let valorTotal = 0;
                                newTipos.forEach(tipoItem => {
                                  const prec = precificacoes.find(p => p.tipo_servico === tipoItem.tipo);
                                  if (prec && prec.preco_padrao) {
                                    valorTotal += Number(prec.preco_padrao) * tipoItem.multiplicador;
                                  }
                                });

                                setFormData({ 
                                  ...formData, 
                                  tipos_servico: newTipos,
                                  valor: valorTotal > 0 ? valorTotal : formData.valor
                                });
                                setTipoOpen(null);
                                setTipoSearch('');
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 border-b last:border-0"
                            >
                              {tipo}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-gray-500 text-center">Nenhum serviço encontrado</div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <div className="w-20">
                    <Input
                      type="number"
                      min="1"
                      value={item.multiplicador}
                      onChange={(e) => {
                        const newTipos = [...formData.tipos_servico];
                        newTipos[index].multiplicador = Math.max(1, parseInt(e.target.value) || 1);

                        // Recalcular valor total
                        let valorTotal = 0;
                        newTipos.forEach(tipoItem => {
                          const prec = precificacoes.find(p => p.tipo_servico === tipoItem.tipo);
                          if (prec && prec.preco_padrao) {
                            valorTotal += Number(prec.preco_padrao) * tipoItem.multiplicador;
                          }
                        });

                        setFormData({ 
                          ...formData, 
                          tipos_servico: newTipos,
                          valor: valorTotal > 0 ? valorTotal : formData.valor
                        });
                      }}
                      placeholder="x1"
                      className="text-center"
                    />
                  </div>
                  {formData.tipos_servico.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const newTipos = formData.tipos_servico.filter((_, i) => i !== index);

                        // Recalcular valor total após remover
                        let valorTotal = 0;
                        newTipos.forEach(tipoItem => {
                          const prec = precificacoes.find(p => p.tipo_servico === tipoItem.tipo);
                          if (prec && prec.preco_padrao) {
                            valorTotal += Number(prec.preco_padrao) * tipoItem.multiplicador;
                          }
                        });

                        setFormData({ 
                          ...formData, 
                          tipos_servico: newTipos,
                          valor: valorTotal > 0 ? valorTotal : 0
                        });
                      }}
                      className="text-red-500 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                    )}
                    </div>
                    );
                    })}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const novoTipo = { tipo: 'Limpeza de 9k', multiplicador: 1 };
                  const novosTipos = [...formData.tipos_servico, novoTipo];

                  // Recalcular valor total
                  let valorTotal = 0;
                  novosTipos.forEach(tipoItem => {
                    const prec = precificacoes.find(p => p.tipo_servico === tipoItem.tipo);
                    if (prec && prec.preco_padrao) {
                      valorTotal += Number(prec.preco_padrao) * tipoItem.multiplicador;
                    }
                  });

                  setFormData({ 
                    ...formData, 
                    tipos_servico: novosTipos,
                    valor: valorTotal > 0 ? valorTotal : formData.valor
                  });
                }}
                className="w-full border-dashed"
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar outro tipo
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="data_programada">Data Programada *</Label>
            <Input
              id="data_programada"
              type="date"
              value={formData.data_programada}
              onChange={(e) => setFormData({ ...formData, data_programada: e.target.value })}

              className="w-full"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div className="space-y-2">
             <Label htmlFor="horario">Horário</Label>
             <TimePickerClock
               value={formData.horario}
               onChange={(time) => setFormData({ ...formData, horario: time })}
             />
           </div>
           <div className="space-y-2">
             <Label htmlFor="valor">Valor (R$)</Label>
             <Input
               id="valor"
               type="number"
               step="0.01"
               value={formData.valor}
               onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
             />
           </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              rows={3}
            />
          </div>

          {equipes.length > 0 && isAdmin && (
            <div className="space-y-2">
              <Label>Equipe Responsável</Label>
              <Select
                value={formData.equipe_id || 'sem-equipe'}
                onValueChange={(value) => setFormData({ ...formData, equipe_id: value === 'sem-equipe' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar equipe..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sem-equipe">Sem equipe específica</SelectItem>
                  {equipes.map(eq => (
                    <SelectItem key={eq.id} value={eq.id}>
                      {eq.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!servico && (
            <div className="flex items-start gap-3 p-3 rounded-lg border border-orange-200 bg-orange-50">
              <input
                type="checkbox"
                id="sem_registro_cliente"
                checked={semRegistroCliente}
                onChange={(e) => setSemRegistroCliente(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-orange-300 accent-orange-500 cursor-pointer"
              />
              <div>
                <label htmlFor="sem_registro_cliente" className="text-sm font-medium text-orange-800 cursor-pointer flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  Serviço avulso (sem vínculo)
                </label>
                <p className="text-xs text-orange-600 mt-0.5">
                  Não salva como cliente e não sincroniza com preventivas futuras.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-gradient-to-r from-blue-500 to-cyan-500">
              {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : servico ? 'Salvar' : 'Cadastrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}