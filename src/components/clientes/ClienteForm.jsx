import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Loader2, MapPin, Contact, Smartphone, Search, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export default function ClienteForm({ open, onClose, onSave, cliente, isLoading }) {
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    endereco: '',
    latitude: null,
    longitude: null,
    observacoes: '',
    ultima_manutencao: '',
    proxima_manutencao: ''
  });

  useEffect(() => {
    if (cliente) {
      setFormData({
        nome: cliente.nome || '',
        telefone: cliente.telefone || '',
        endereco: cliente.endereco || '',
        latitude: cliente.latitude || null,
        longitude: cliente.longitude || null,
        observacoes: cliente.observacoes || '',
        ultima_manutencao: cliente.ultima_manutencao || '',
        proxima_manutencao: cliente.proxima_manutencao || ''
      });
    } else {
      setFormData({
        nome: '',
        telefone: '',
        endereco: '',
        latitude: null,
        longitude: null,
        observacoes: '',
        ultima_manutencao: '',
        proxima_manutencao: ''
      });
    }
  }, [cliente, open]);

  const formatPhoneInput = (value) => {
    const cleaned = value.replace(/\D/g, '');
    let formatted = cleaned;
    
    // Formato com código do país: +55 66 98121-4583
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

  const handleUltimaManutencaoChange = (date) => {
    const formattedDate = date ? format(date, 'yyyy-MM-dd') : '';
    const proximaDate = date ? format(addMonths(date, 6), 'yyyy-MM-dd') : '';
    
    setFormData({
      ...formData,
      ultima_manutencao: formattedDate,
      proxima_manutencao: proximaDate
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  // Função para buscar dados de localização a partir de um link do Google Maps, coordenadas ou endereço
  const handleSearchLocation = async () => {
    const input = formData.endereco?.trim();
    if (!input) {
      toast.error('Digite um endereço, coordenadas ou cole um link do Google Maps');
      return;
    }

    setLoadingLocation(true);
    try {
      // Verifica se são coordenadas (formato: -10.123, -59.456)
      const coordRegex = /^-?\d+\.?\d*,\s*-?\d+\.?\d*$/;
      if (coordRegex.test(input)) {
        const [lat, lng] = input.split(',').map(c => parseFloat(c.trim()));
        
        const result = await base44.integrations.Core.InvokeLLM({
          prompt: `Faça uma busca reversa de geocodificação para as coordenadas: ${lat}, ${lng}
                   Encontre e retorne EXATAMENTE o endereço completo, bairro, cidade e estado desta localização no Brasil.
                   Use Google Maps ou outro serviço de mapas para obter as informações mais precisas.`,
          add_context_from_internet: true,
          response_json_schema: {
            type: "object",
            properties: {
              endereco_completo: { type: "string", description: "Endereço completo com rua e número" },
              bairro: { type: "string", description: "Nome do bairro" },
              cidade: { type: "string", description: "Nome da cidade" },
              estado: { type: "string", description: "Sigla do estado" }
            }
          }
        });

        setFormData(prev => ({
          ...prev,
          endereco: result?.endereco_completo || `Coordenadas: ${lat}, ${lng}`,
          latitude: lat,
          longitude: lng
        }));
        toast.success('Coordenadas salvas e endereço encontrado!');
        return;
      }

      // Verifica se é um link do Google Maps e tenta extrair coordenadas
      const isGoogleMapsLink = input.includes('google.com/maps') || input.includes('maps.app.goo.gl') || input.includes('goo.gl/maps');
      
      if (isGoogleMapsLink) {
        const result = await base44.integrations.Core.InvokeLLM({
          prompt: `Acesse este link do Google Maps e extraia TODAS as informações da localização: "${input}"
                   
                   IMPORTANTE: Retorne as informações EXATAS que aparecem no Google Maps:
                   - Endereço completo (rua, número, complemento se houver)
                   - Bairro ou distrito
                   - Cidade
                   - Estado (sigla)
                   - Coordenadas exatas (latitude e longitude)
                   
                   Use a busca na internet para acessar o link e obter os dados precisos.`,
          add_context_from_internet: true,
          response_json_schema: {
            type: "object",
            properties: {
              endereco_completo: { type: "string", description: "Endereço completo formatado" },
              bairro: { type: "string", description: "Nome do bairro ou distrito" },
              cidade: { type: "string", description: "Nome da cidade" },
              estado: { type: "string", description: "Sigla do estado (ex: MT, SP)" },
              latitude: { type: "number", description: "Latitude exata" },
              longitude: { type: "number", description: "Longitude exata" }
            }
          }
        });

        if (result) {
          setFormData(prev => ({
            ...prev,
            endereco: result.endereco_completo || prev.endereco,
            latitude: result.latitude || prev.latitude,
            longitude: result.longitude || prev.longitude
          }));
          toast.success('Localização do Maps encontrada!');
        } else {
          toast.error('Não foi possível extrair dados do link');
        }
      } else {
        // É um endereço texto - busca geocodificação
        const result = await base44.integrations.Core.InvokeLLM({
          prompt: `Faça uma geocodificação do seguinte endereço no Brasil: "${input}"
                   
                   Use Google Maps ou outro serviço de mapas para encontrar:
                   - O endereço completo e formatado corretamente
                   - Bairro
                   - Cidade
                   - Estado
                   - Coordenadas geográficas (latitude e longitude)
                   
                   IMPORTANTE: Retorne apenas informações verificadas e precisas.`,
          add_context_from_internet: true,
          response_json_schema: {
            type: "object",
            properties: {
              endereco_completo: { type: "string", description: "Endereço completo formatado" },
              bairro: { type: "string", description: "Nome do bairro" },
              cidade: { type: "string", description: "Nome da cidade" },
              estado: { type: "string", description: "Sigla do estado" },
              latitude: { type: "number", description: "Latitude" },
              longitude: { type: "number", description: "Longitude" }
            }
          }
        });

        if (result) {
          setFormData(prev => ({
            ...prev,
            endereco: result.endereco_completo || prev.endereco,
            latitude: result.latitude || prev.latitude,
            longitude: result.longitude || prev.longitude
          }));
          toast.success('Endereço encontrado e dados preenchidos!');
        }
      }
    } catch (error) {
      console.error('Erro ao buscar localização:', error);
      toast.error('Erro ao buscar localização. Verifique os dados e tente novamente.');
    } finally {
      setLoadingLocation(false);
    }
  };

  const handleImportContact = async () => {
    // Verifica se a API de Contatos está disponível
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
        
        // Preenche os campos com os dados do contato
        const nome = contact.name?.[0] || '';
        let telefone = contact.tel?.[0] || '';
        
        // Formata o telefone
        if (telefone) {
          telefone = telefone.replace(/\D/g, '');
          // Remove o código do país se existir
          if (telefone.startsWith('55') && telefone.length > 11) {
            telefone = telefone.slice(2);
          }
          telefone = formatPhoneInput(telefone);
        }
        
        // Tenta extrair endereço
        let endereco = '';
        if (contact.address && contact.address.length > 0) {
          const addr = contact.address[0];
          const parts = [
            addr.streetAddress,
            addr.locality,
            addr.region
          ].filter(Boolean);
          endereco = parts.join(', ');
        }

        setFormData(prev => ({
          ...prev,
          nome: nome || prev.nome,
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-800">
            {cliente ? 'Editar Cliente' : 'Novo Cliente'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Botão Importar Contato */}
          {!cliente && (
            <Button
              type="button"
              variant="outline"
              onClick={handleImportContact}
              disabled={loadingContacts}
              className="w-full h-12 border-dashed border-2 border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400"
            >
              {loadingContacts ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Contact className="w-5 h-5 mr-2" />
                  Importar da Agenda do Telefone
                </>
              )}
            </Button>
          )}

          {/* Nome e Telefone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Nome do cliente"
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone *</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={handlePhoneChange}
                placeholder="(00) 00000-0000"
                required
                className="h-11"
                maxLength={18}
              />
            </div>
          </div>

          {/* Endereço */}
          <div className="space-y-2">
            <Label htmlFor="endereco">Endereço Completo ou Link do Google Maps</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="endereco"
                  value={formData.endereco}
                  onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                  placeholder="Link do Maps, coordenadas ou endereço"
                  className="h-11 pl-10"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleSearchLocation}
                disabled={loadingLocation || !formData.endereco}
                className="h-11 px-4 border-blue-300 text-blue-600 hover:bg-blue-50"
                title="Buscar localização"
              >
                {loadingLocation ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
              {(formData.latitude && formData.longitude) || formData.endereco ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const mapsUrl = formData.latitude && formData.longitude
                      ? `https://www.google.com/maps?q=${formData.latitude},${formData.longitude}`
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formData.endereco)}`;
                    window.open(mapsUrl, '_blank');
                  }}
                  className="h-11 px-4 border-green-300 text-green-600 hover:bg-green-50"
                  title="Abrir no Google Maps"
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-gray-500">
              Cole um link do Google Maps, coordenadas (ex: -10.173, -59.446) ou digite o endereço e clique em buscar
            </p>
          </div>

          {/* Datas de Manutenção */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Última Manutenção</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-11 justify-start text-left font-normal",
                      !formData.ultima_manutencao && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.ultima_manutencao ? (
                      format(new Date(formData.ultima_manutencao), "dd/MM/yyyy", { locale: ptBR })
                    ) : (
                      "Selecione a data"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.ultima_manutencao ? new Date(formData.ultima_manutencao) : undefined}
                    onSelect={handleUltimaManutencaoChange}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Próxima Manutenção (Auto: +6 meses)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-11 justify-start text-left font-normal",
                      !formData.proxima_manutencao && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.proxima_manutencao ? (
                      format(new Date(formData.proxima_manutencao), "dd/MM/yyyy", { locale: ptBR })
                    ) : (
                      "Selecione a data"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.proxima_manutencao ? new Date(formData.proxima_manutencao) : undefined}
                    onSelect={(date) => setFormData({ ...formData, proxima_manutencao: date ? format(date, 'yyyy-MM-dd') : '' })}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Observações sobre o cliente..."
              rows={3}
            />
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                cliente ? 'Salvar Alterações' : 'Cadastrar Cliente'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}