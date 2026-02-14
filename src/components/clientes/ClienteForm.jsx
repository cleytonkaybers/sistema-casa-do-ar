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
        
        // Validação básica para Brasil (lat: -34 a 5, lng: -74 a -34)
        if (lat < -34 || lat > 5 || lng < -74 || lng > -34) {
          toast.error('Coordenadas fora do Brasil. Verifique os valores.');
          setLoadingLocation(false);
          return;
        }
        
        const result = await base44.integrations.Core.InvokeLLM({
          prompt: `Faça uma busca reversa de geocodificação EXATA para estas coordenadas no Brasil: ${lat}, ${lng}
                   
                   Acesse o Google Maps nesta URL: https://www.google.com/maps?q=${lat},${lng}
                   
                   Retorne o endereço EXATO que aparece no Google Maps para essas coordenadas.`,
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
        toast.success(`Coordenadas salvas: ${lat}, ${lng}`);
        return;
      }

      // Verifica se é um link do Google Maps (incluindo links encurtados goo.gl)
      const isGoogleMapsLink = input.includes('google.com/maps') || 
                               input.includes('maps.app.goo.gl') || 
                               input.includes('goo.gl/maps') ||
                               input.includes('maps.google.com');
      
      if (isGoogleMapsLink) {
        // Tenta extrair coordenadas direto da URL primeiro
        const coordMatch = input.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
        
        if (coordMatch) {
          const lat = parseFloat(coordMatch[1]);
          const lng = parseFloat(coordMatch[2]);
          
          if (lat >= -34 && lat <= 5 && lng >= -74 && lng <= -34) {
            const result = await base44.integrations.Core.InvokeLLM({
              prompt: `Busca reversa para coordenadas ${lat}, ${lng} no Brasil. Retorne o endereço completo.`,
              add_context_from_internet: true,
              response_json_schema: {
                type: "object",
                properties: {
                  endereco_completo: { type: "string" },
                  cidade: { type: "string" },
                  estado: { type: "string" }
                }
              }
            });
            
            setFormData(prev => ({
              ...prev,
              endereco: result?.endereco_completo || `${result?.cidade || ''} - ${result?.estado || ''}`,
              latitude: lat,
              longitude: lng
            }));
            toast.success(`Localização vinculada: ${lat}, ${lng}`);
            return;
          }
        }
        
        // Se não encontrou na URL, acessa o link
        const result = await base44.integrations.Core.InvokeLLM({
          prompt: `TAREFA CRÍTICA: Acesse este link do Google Maps e extraia as coordenadas EXATAS mostradas: "${input}"
                   
                   PASSOS:
                   1. Abra o link (pode ser um link encurtado goo.gl - ele vai redirecionar)
                   2. Na página do Google Maps, localize as coordenadas exatas do pin/marcador
                   3. As coordenadas aparecem na URL após o "@" ou na interface do Maps
                   4. Copie EXATAMENTE os valores de latitude e longitude
                   
                   VALIDAÇÃO:
                   - Para locais no Brasil: latitude entre -34 e 5, longitude entre -74 e -34
                   - Exemplo Aripuanã-MT: lat ≈ -10.17, lng ≈ -59.45
                   
                   RETORNE: Endereço completo, cidade, estado e coordenadas PRECISAS do local.`,
          add_context_from_internet: true,
          response_json_schema: {
            type: "object",
            properties: {
              endereco_completo: { type: "string", description: "Endereço completo do local" },
              cidade: { type: "string", description: "Nome da cidade" },
              estado: { type: "string", description: "Sigla do estado" },
              latitude: { type: "number", description: "Latitude exata" },
              longitude: { type: "number", description: "Longitude exata" }
            },
            required: ["latitude", "longitude"]
          }
        });

        if (result && result.latitude && result.longitude) {
          if (result.latitude < -34 || result.latitude > 5 || result.longitude < -74 || result.longitude > -34) {
            toast.error('Coordenadas inválidas para Brasil. Verifique o link.');
            setLoadingLocation(false);
            return;
          }
          
          setFormData(prev => ({
            ...prev,
            endereco: result.endereco_completo || `${result.cidade || ''} - ${result.estado || ''}`,
            latitude: result.latitude,
            longitude: result.longitude
          }));
          toast.success(`${result.cidade || 'Localização'} vinculada: ${result.latitude}, ${result.longitude}`);
        } else {
          toast.error('Não foi possível extrair as coordenadas do link');
        }
      } else {
        // É um endereço texto - busca geocodificação
        const result = await base44.integrations.Core.InvokeLLM({
          prompt: `Busque no Google Maps e encontre as coordenadas EXATAS para este endereço no Brasil: "${input}"
                   
                   PROCESSO:
                   1. Acesse Google Maps e busque pelo endereço
                   2. Copie as coordenadas EXATAS que o Google Maps mostra
                   3. Verifique que as coordenadas estão no Brasil (lat: -34 a 5, lng: -74 a -34)
                   
                   RETORNE:
                   - Coordenadas precisas (com até 7 casas decimais)
                   - Endereço completo formatado
                   - Cidade e Estado
                   
                   CRÍTICO: Não invente coordenadas, use apenas as que o Google Maps mostrar.`,
          add_context_from_internet: true,
          response_json_schema: {
            type: "object",
            properties: {
              endereco_completo: { type: "string", description: "Endereço completo formatado" },
              cidade: { type: "string", description: "Nome da cidade" },
              estado: { type: "string", description: "Sigla do estado" },
              latitude: { type: "number", description: "Latitude em formato decimal preciso" },
              longitude: { type: "number", description: "Longitude em formato decimal preciso" }
            },
            required: ["latitude", "longitude", "cidade", "estado"]
          }
        });

        if (result && result.latitude && result.longitude) {
          if (result.latitude < -34 || result.latitude > 5 || result.longitude < -74 || result.longitude > -34) {
            toast.error('Coordenadas fora do Brasil. Verifique o endereço.');
            setLoadingLocation(false);
            return;
          }
          
          setFormData(prev => ({
            ...prev,
            endereco: result.endereco_completo || prev.endereco,
            latitude: result.latitude,
            longitude: result.longitude
          }));
          toast.success(`${result.cidade}-${result.estado}: ${result.latitude}, ${result.longitude}`);
        } else {
          toast.error('Não foi possível encontrar as coordenadas do endereço');
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
    setLoadingContacts(true);
    
    try {
      // Verifica se está rodando em contexto seguro (HTTPS)
      if (!window.isSecureContext) {
        toast.error('A importação de contatos requer conexão segura (HTTPS)');
        setLoadingContacts(false);
        return;
      }

      // Verifica se a API está disponível
      if (!navigator.contacts || typeof navigator.contacts.select !== 'function') {
        toast.error('Importação não suportada. Use Chrome/Edge Android atualizado.');
        setLoadingContacts(false);
        return;
      }

      // Solicita acesso aos contatos
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
          // Remove o código do país se existir (55 Brasil)
          if (telefone.startsWith('55') && telefone.length > 11) {
            telefone = telefone.slice(2);
          }
          // Adiciona +55 formatado
          if (telefone.length === 11 || telefone.length === 10) {
            telefone = '55' + telefone;
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
        
        toast.success(`Contato ${nome} importado!`);
      } else {
        toast.info('Seleção cancelada');
      }
    } catch (error) {
      console.error('Erro importação:', error);
      
      if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
        toast.error('Permissão negada pelo sistema');
      } else if (error.name === 'NotSupportedError') {
        toast.error('Use Chrome ou Edge em Android');
      } else if (error.name === 'InvalidStateError') {
        toast.error('Requer conexão HTTPS');
      } else if (error.name === 'AbortError') {
        // Usuário cancelou, não mostrar erro
      } else {
        toast.error('Erro ao importar. Atualize o navegador.');
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
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleImportContact}
                disabled={loadingContacts}
                className="w-full h-14 border-dashed border-2 border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400"
              >
                {loadingContacts ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Smartphone className="w-6 h-6 mr-2" />
                    <span className="font-semibold">Importar da Agenda do Celular</span>
                  </>
                )}
              </Button>
              <p className="text-xs text-center text-gray-500">
                Funciona apenas em smartphones Android com Chrome ou Edge
              </p>
            </div>
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