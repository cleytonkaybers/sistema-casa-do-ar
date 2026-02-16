import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, MapPin, Search, ExternalLink, Contact, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import TimePickerClock from '@/components/ui/time-picker-clock';
import { base44 } from '@/api/base44Client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ServicoForm({ open, onClose, onSave, servico, isLoading, prefilledData }) {
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [formData, setFormData] = useState({
    cliente_nome: '',
    cpf: '',
    telefone: '',
    endereco: '',
    latitude: null,
    longitude: null,
    tipos_servico: ['Limpeza de 9k'],
    dia_semana: '',
    data_programada: '',
    horario: '',
    descricao: '',
    valor: '',
    ativo: true
  });

  useEffect(() => {
    if (servico) {
      setFormData({
        cliente_nome: servico.cliente_nome || '',
        cpf: servico.cpf || '',
        telefone: servico.telefone || '',
        endereco: servico.endereco || '',
        latitude: servico.latitude || null,
        longitude: servico.longitude || null,
        tipos_servico: servico.tipo_servico ? [servico.tipo_servico] : ['Limpeza de 9k'],
        dia_semana: servico.dia_semana || '',
        data_programada: servico.data_programada || '',
        horario: servico.horario || '',
        descricao: servico.descricao || '',
        valor: servico.valor || '',
        ativo: servico.ativo !== false
      });
    } else if (prefilledData) {
      setFormData({
        cliente_nome: prefilledData.cliente_nome || '',
        cpf: prefilledData.cpf || '',
        telefone: prefilledData.telefone || '',
        endereco: prefilledData.endereco || '',
        latitude: prefilledData.latitude || null,
        longitude: prefilledData.longitude || null,
        tipos_servico: ['Limpeza de 9k'],
        dia_semana: '',
        data_programada: '',
        horario: '',
        descricao: '',
        valor: '',
        ativo: true
      });
    } else {
      setFormData({
        cliente_nome: '',
        cpf: '',
        telefone: '',
        endereco: '',
        latitude: null,
        longitude: null,
        tipos_servico: ['Limpeza de 9k'],
        dia_semana: '',
        data_programada: '',
        horario: '',
        descricao: '',
        valor: '',
        ativo: true
      });
    }
  }, [servico, prefilledData, open]);

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
    
    // Validar que a data não seja no passado
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const dataProgramada = new Date(formData.data_programada + 'T00:00:00');
    
    if (dataProgramada < hoje) {
      toast.error('Data não pode ser no passado!');
      return;
    }
    
    // Calcular dia da semana automaticamente a partir da data programada
    const data = parseISO(formData.data_programada);
    const diaSemanaFormatado = format(data, 'EEEE', { locale: ptBR });
    const diaSemana = diaSemanaFormatado.charAt(0).toUpperCase() + diaSemanaFormatado.slice(1);
    
    const dataToSave = {
      ...formData,
      tipo_servico: formData.tipos_servico.join(' + '),
      dia_semana: diaSemana,
      valor: formData.valor ? parseFloat(formData.valor) : 0
    };
    delete dataToSave.tipos_servico;
    
    console.log('Salvando serviço:', dataToSave);
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
            <Button
              type="button"
              variant="outline"
              onClick={handleImportContact}
              disabled={loadingContacts}
              className="w-full h-12 border-dashed border-2 border-purple-300 text-purple-600 hover:bg-purple-50 hover:border-purple-400"
            >
              {loadingContacts ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Contact className="w-5 h-5 mr-2" />
                  Buscar na Agenda do Telefone
                </>
              )}
            </Button>
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
              {formData.tipos_servico.map((tipo, index) => (
                <div key={index} className="flex gap-2">
                  <Select 
                    value={tipo} 
                    onValueChange={(value) => {
                      const newTipos = [...formData.tipos_servico];
                      newTipos[index] = value;
                      setFormData({ ...formData, tipos_servico: newTipos });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Limpeza de 9k">Limpeza de 9k</SelectItem>
                      <SelectItem value="Limpeza de 12k">Limpeza de 12k</SelectItem>
                      <SelectItem value="Limpeza de 18k">Limpeza de 18k</SelectItem>
                      <SelectItem value="Limpeza de 22 a 24k">Limpeza de 22 a 24k</SelectItem>
                      <SelectItem value="Limpeza de 24k">Limpeza de 24k</SelectItem>
                      <SelectItem value="Limpeza de 30 a 32k">Limpeza de 30 a 32k</SelectItem>
                      <SelectItem value="Limpeza piso e teto">Limpeza piso e teto</SelectItem>
                      <SelectItem value="Instalação de 9k">Instalação de 9k</SelectItem>
                      <SelectItem value="Instalação de 12k">Instalação de 12k</SelectItem>
                      <SelectItem value="Instalação de 18k">Instalação de 18k</SelectItem>
                      <SelectItem value="Instalação de 22 a 24k">Instalação de 22 a 24k</SelectItem>
                      <SelectItem value="Instalação de 24k">Instalação de 24k</SelectItem>
                      <SelectItem value="Instalação de 30 a 32k">Instalação de 30 a 32k</SelectItem>
                      <SelectItem value="Instalação piso e teto">Instalação piso e teto</SelectItem>
                      <SelectItem value="Troca de capacitor">Troca de capacitor</SelectItem>
                      <SelectItem value="Recarga de gás">Recarga de gás</SelectItem>
                      <SelectItem value="Carga de gás completa">Carga de gás completa</SelectItem>
                      <SelectItem value="Serviço de solda">Serviço de solda</SelectItem>
                      <SelectItem value="Troca de relé da placa">Troca de relé da placa</SelectItem>
                      <SelectItem value="Troca de sensor">Troca de sensor</SelectItem>
                      <SelectItem value="Troca de chave contadora">Troca de chave contadora</SelectItem>
                      <SelectItem value="Conserto de placa eletrônica">Conserto de placa eletrônica</SelectItem>
                      <SelectItem value="Retirada de ar condicionado">Retirada de ar condicionado</SelectItem>
                      <SelectItem value="Serviço de passar tubulação de infra">Serviço de passar tubulação de infra</SelectItem>
                      <SelectItem value="Ver defeito">Ver defeito</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.tipos_servico.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const newTipos = formData.tipos_servico.filter((_, i) => i !== index);
                        setFormData({ ...formData, tipos_servico: newTipos });
                      }}
                      className="text-red-500 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormData({ ...formData, tipos_servico: [...formData.tipos_servico, 'Limpeza de 9k'] })}
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