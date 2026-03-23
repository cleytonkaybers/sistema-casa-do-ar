import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Phone, MapPin, Calendar, MessageCircle, Navigation, Search, Loader2, Clock, Wrench, Share2, Eye, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePermissions } from '../components/auth/PermissionGuard';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format, differenceInDays, addMonths, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ServicoForm from '../components/servicos/ServicoForm';
import { Label } from '@/components/ui/label';
import { TableSkeleton } from '@/components/LoadingSkeleton';

export default function PreventivasFuturasPage() {
  const { isAdmin } = usePermissions();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showServicoForm, setShowServicoForm] = useState(false);
  const [editingDate, setEditingDate] = useState(false);
  const [newDate, setNewDate] = useState('');
  const queryClient = useQueryClient();

  const { data: clientes = [], isLoading: loadingClientes } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list('-created_date'),
  });

  const { data: servicos = [], isLoading: loadingServicos } = useQuery({
    queryKey: ['servicos'],
    queryFn: () => base44.entities.Servico.list('-created_date'),
  });

  const { data: equipes = [] } = useQuery({
    queryKey: ['equipes'],
    queryFn: () => base44.entities.Equipe.list(),
  });

  const formatPhone = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const getWhatsAppLink = (phone) => {
    const cleaned = phone?.replace(/\D/g, '') || '';
    const mensagem = encodeURIComponent(
      `Olá! 👋\nNotamos que já está no período recomendado para a manutenção do seu ar-condicionado.\nA limpeza preventiva melhora o desempenho, reduz o consumo de energia, evita mau cheiro e aumenta a vida útil do aparelho.\nQuer que eu agende um horário para você?`
    );
    return `https://wa.me/55${cleaned}?text=${mensagem}`;
  };

  const getGoogleMapsLink = (item) => {
    if (item.latitude && item.longitude) {
      return `https://www.google.com/maps?q=${item.latitude},${item.longitude}`;
    }
    if (item.endereco) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.endereco)}`;
    }
    return null;
  };

  const getManutencaoStatus = (proximaManutencao) => {
    if (!proximaManutencao) return null;
    const daysUntil = differenceInDays(new Date(proximaManutencao), new Date());
    
    // Vencidos ou vencendo (180 dias ou mais de atraso)
    if (daysUntil < 0) {
      return { 
        label: `VENCIDA - ${Math.abs(daysUntil)} dias atrasado`, 
        color: 'bg-red-100 text-red-700 border-red-300',
        priority: 1,
        days: daysUntil,
        vencida: true
      };
    }
    if (daysUntil <= 7) {
      return { 
        label: `URGENTE - Faltam ${daysUntil} ${daysUntil === 1 ? 'dia' : 'dias'}`, 
        color: 'bg-orange-100 text-orange-700 border-orange-300',
        priority: 2,
        days: daysUntil,
        vencida: false
      };
    }
    if (daysUntil <= 30) {
      return { 
        label: `Faltam ${daysUntil} dias`, 
        color: 'bg-amber-100 text-amber-700 border-amber-300',
        priority: 3,
        days: daysUntil,
        vencida: false
      };
    }
    if (daysUntil <= 90) {
      return { 
        label: `Faltam ${daysUntil} dias`, 
        color: 'bg-blue-100 text-blue-700 border-blue-300',
        priority: 4,
        days: daysUntil,
        vencida: false
      };
    }
    return { 
      label: `Faltam ${daysUntil} dias`, 
      color: 'bg-gray-100 text-gray-700 border-gray-300',
      priority: 5,
      days: daysUntil,
      vencida: false
    };
  };

  // Preparar dados de clientes com manutenção programada
  const clientesComManutencao = clientes
    .map(cliente => {
      // Se não tem próxima manutenção mas tem última, calcula 6 meses
      let proximaManutencao = cliente.proxima_manutencao;
      if (!proximaManutencao && cliente.ultima_manutencao) {
        const dataUltima = new Date(cliente.ultima_manutencao);
        proximaManutencao = format(addMonths(dataUltima, 6), 'yyyy-MM-dd');
      }
      
      return {
        ...cliente,
        tipo: 'cliente',
        proximaManutencao,
        status: getManutencaoStatus(proximaManutencao)
      };
    })
    .filter(c => c.proximaManutencao && c.status);

  // Combinar e filtrar (apenas clientes)
  const todosItens = [...clientesComManutencao]
    .filter(item => {
      const matchNome = item.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       item.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchTelefone = item.telefone?.includes(searchTerm);
      return matchNome || matchTelefone;
    })
    .sort((a, b) => {
      // Ordenar por dias restantes em ordem crescente (menos dias primeiro)
      const daysA = a.status?.days ?? 999;
      const daysB = b.status?.days ?? 999;
      return daysA - daysB;
    });

  // Paginação
  const totalPages = Math.ceil(todosItens.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItens = todosItens.slice(startIndex, endIndex);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const isLoading = loadingClientes || loadingServicos;

  const createServicoMutation = useMutation({
    mutationFn: async (servicoData) => {
      const servico = await base44.entities.Servico.create(servicoData);
      
      // Remover preventiva do cliente (será regenerada ao concluir o serviço)
      const todosClientes = await base44.entities.Cliente.list();
      const clienteExistente = todosClientes.find(c => 
        c.telefone?.replace(/\D/g, '') === servicoData.telefone?.replace(/\D/g, '')
      );
      
      if (clienteExistente) {
        await base44.entities.Cliente.update(clienteExistente.id, {
          proxima_manutencao: null
        });
      }
      
      return servico;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      setShowServicoForm(false);
      setSelectedItem(null);
      toast.success('Serviço agendado! Preventiva será gerada ao concluir.');
    },
  });

  const updateClienteDateMutation = useMutation({
    mutationFn: ({ id, proxima_manutencao }) => 
      base44.entities.Cliente.update(id, { proxima_manutencao }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      setEditingDate(false);
      setNewDate('');
      setShowDetails(false);
      toast.success('Data de manutenção atualizada!');
    },
  });

  const deleteClienteMutation = useMutation({
    mutationFn: (id) => base44.entities.Cliente.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      toast.success('Cliente excluído com sucesso!');
    },
    onError: () => toast.error('Erro ao excluir cliente'),
  });

  const handleDelete = async (item) => {
    if (confirm(`Excluir ${item.nome}?`)) {
      await deleteClienteMutation.mutateAsync(item.id);
    }
  };

  const handleViewDetails = (item) => {
    setSelectedItem(item);
    setShowDetails(true);
    setEditingDate(false);
    setNewDate(item.proximaManutencao || '');
  };

  const handleSaveDate = () => {
    if (!newDate || !selectedItem) return;
    updateClienteDateMutation.mutate({
      id: selectedItem.id,
      proxima_manutencao: newDate
    });
  };

  const handleCreateServico = (item) => {
    setSelectedItem(item);
    setShowServicoForm(true);
  };

  const handleSaveServico = async (servicoData) => {
    createServicoMutation.mutate(servicoData);
  };

  const handleShare = async (item) => {
    const isCliente = item.tipo === 'cliente';
    const nome = isCliente ? item.nome : item.cliente_nome;
    const mapsLink = getGoogleMapsLink(item);
    
    let shareText = `📋 *${nome}*\n\n📞 ${formatPhone(item.telefone)}\n`;
    
    if (item.endereco) {
      shareText += `📍 ${item.endereco}\n`;
    }
    
    if (mapsLink) {
      shareText += `🗺️ ${mapsLink}\n`;
    }
    
    if (isCliente && item.proximaManutencao) {
      shareText += `\n📅 Próxima manutenção: ${format(new Date(item.proximaManutencao), "dd/MM/yyyy", { locale: ptBR })}\n`;
    }
    
    if (!isCliente) {
      shareText += `\n🔧 ${item.tipo_servico}`;
      if (item.dia_semana) shareText += `\n📆 ${item.dia_semana}`;
      if (item.horario) shareText += ` às ${item.horario}`;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: nome,
          text: shareText
        });
      } catch (error) {
        if (error.name !== 'AbortError') {
          navigator.clipboard.writeText(shareText);
          toast.success('Informações copiadas!');
        }
      }
    } else {
      navigator.clipboard.writeText(shareText);
      toast.success('Informações copiadas!');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Preventivas Futuras</h1>
          <p className="text-gray-500 mt-1">Manutenções programadas e serviços ativos</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          placeholder="Buscar por nome ou telefone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 h-11 border-gray-200 text-gray-700 placeholder:text-gray-400 bg-white"
        />
      </div>

      {isLoading ? (
        <TableSkeleton rows={10} />
      ) : (
        <>
          {todosItens.length > 0 && (
            <div className="bg-white rounded-lg p-4 border border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Mostrando <span className="font-medium">{startIndex + 1}</span> a <span className="font-medium">{Math.min(endIndex, todosItens.length)}</span> de <span className="font-medium">{todosItens.length}</span> manutenções
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="border-gray-200"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-600">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="border-gray-200"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
          {todosItens.length === 0 ? (
        <div className="text-center py-12 rounded-xl border-2 border-dashed border-gray-200 bg-white">
          <p className="text-gray-400">
            {searchTerm 
              ? 'Nenhum resultado encontrado'
              : 'Nenhuma manutenção programada ou serviço ativo'
            }
          </p>
        </div>
      ) : (
        <div className="rounded-xl shadow-sm border border-gray-200 overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200" style={{ backgroundColor: '#1e3a8a' }}>
                  <TableHead className="text-white font-semibold">Tipo</TableHead>
                  <TableHead className="text-white font-semibold">Nome</TableHead>
                  <TableHead className="text-white font-semibold">Telefone</TableHead>
                  <TableHead className="text-white font-semibold">Endereço</TableHead>
                  <TableHead className="text-white font-semibold">Serviço/Data</TableHead>
                  <TableHead className="text-white font-semibold">Status</TableHead>
                  <TableHead className="text-white font-semibold text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todosItens.map((item) => {
                  const isCliente = item.tipo === 'cliente';
                  const mapsLink = getGoogleMapsLink(item);

                  return (
                    <TableRow key={`${item.tipo}-${item.id}`} className="border-gray-100 hover:bg-gray-50">
                      <TableCell>
                        <Badge className={isCliente ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-purple-100 text-purple-700 border-purple-200'}>
                          {isCliente ? 'Cliente' : 'Serviço'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-gray-800">
                        {isCliente ? item.nome : item.cliente_nome}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone className="w-4 h-4 text-gray-400" />
                          {formatPhone(item.telefone)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          {item.endereco ? (
                            <div className="flex items-start gap-2 text-gray-600">
                              <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                              <span className="text-sm line-clamp-2">{item.endereco}</span>
                            </div>
                          ) : (
                            <span className="text-gray-300 text-sm">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isCliente && item.proximaManutencao ? (
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <Calendar className="w-4 h-4 text-blue-500" />
                            {format(new Date(item.proximaManutencao), "dd/MM/yyyy", { locale: ptBR })}
                          </div>
                        ) : !isCliente ? (
                          <div className="text-sm space-y-1">
                            <div className="font-medium text-gray-800">{item.tipo_servico}</div>
                            {item.dia_semana && (
                              <div className="flex items-center gap-1 text-gray-500">
                                <Calendar className="w-3 h-3" />
                                {item.dia_semana}
                                {item.horario && ` - ${item.horario}`}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300 text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={item.status.color}>
                          {item.status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(item)}
                            className="text-gray-500 hover:text-blue-600"
                            title="Ver Detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCreateServico(item)}
                            className="text-gray-500 hover:text-purple-600"
                            title="Agendar Serviço"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleShare(item)}
                            className="text-gray-500 hover:text-amber-500"
                            title="Compartilhar"
                          >
                            <Share2 className="w-4 h-4" />
                          </Button>
                          {isCliente && isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(item)}
                              className="text-gray-500 hover:text-red-500"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                          <a
                            href={getWhatsAppLink(item.telefone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-8 px-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-md transition-colors"
                            title="WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>
                          {mapsLink && (
                            <a
                              href={mapsLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center h-8 px-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-md transition-colors"
                              title="Google Maps"
                            >
                              <Navigation className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
          )}
        </>
      )}

      {/* Modal de Detalhes */}
      {selectedItem && (
        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-gray-800">
                Detalhes {selectedItem.tipo === 'cliente' ? 'do Cliente' : 'do Serviço'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 mt-4">
              <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white p-4 rounded-lg">
                <h3 className="text-lg font-semibold">
                  {selectedItem.tipo === 'cliente' ? selectedItem.nome : selectedItem.cliente_nome}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className="bg-white/20 text-white border-white/30">
                    {selectedItem.tipo === 'cliente' ? 'Cliente' : 'Serviço Ativo'}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Telefone</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-800">{formatPhone(selectedItem.telefone)}</span>
                  </div>
                </div>

                {selectedItem.cpf && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">CPF</label>
                    <p className="text-gray-800 mt-1">{selectedItem.cpf}</p>
                  </div>
                )}

                {selectedItem.tipo !== 'cliente' && selectedItem.tipo_servico && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Tipo de Serviço</label>
                    <p className="text-gray-800 mt-1">{selectedItem.tipo_servico}</p>
                  </div>
                )}

                {selectedItem.dia_semana && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Dia da Semana</label>
                    <p className="text-gray-800 mt-1">{selectedItem.dia_semana}</p>
                  </div>
                )}

                {selectedItem.horario && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Horário</label>
                    <p className="text-gray-800 mt-1">{selectedItem.horario}</p>
                  </div>
                )}

                {selectedItem.valor && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Valor</label>
                    <p className="text-gray-800 mt-1">R$ {selectedItem.valor.toFixed(2)}</p>
                  </div>
                )}
              </div>

              {selectedItem.endereco && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Endereço</label>
                  <div className="flex items-start gap-2 mt-1">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <span className="text-gray-800">{selectedItem.endereco}</span>
                  </div>
                </div>
              )}

              {selectedItem.tipo === 'cliente' && selectedItem.proximaManutencao && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Próxima Manutenção</label>
                  
                  {editingDate ? (
                    <div className="space-y-3 mt-2">
                      <Input
                        type="date"
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                        className="max-w-xs"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleSaveDate}
                          disabled={updateClienteDateMutation.isPending}
                          className="bg-gradient-to-r from-blue-500 to-cyan-500"
                        >
                          {updateClienteDateMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Salvando...
                            </>
                          ) : (
                            'Salvar Data'
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingDate(false);
                            setNewDate(selectedItem.proximaManutencao);
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 mt-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-800">
                          {format(new Date(selectedItem.proximaManutencao), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingDate(true)}
                          className="ml-2 text-blue-600 hover:text-blue-700"
                        >
                          Editar
                        </Button>
                      </div>
                      <Badge className={`${selectedItem.status.color}`}>
                        {selectedItem.status.label}
                      </Badge>
                    </div>
                  )}
                </div>
              )}

              {(selectedItem.observacoes || selectedItem.descricao) && (
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    {selectedItem.tipo === 'cliente' ? 'Observações' : 'Descrição'}
                  </label>
                  <p className="text-gray-800 bg-gray-50 p-3 rounded-lg mt-1">
                    {selectedItem.observacoes || selectedItem.descricao}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={() => {
                    setShowDetails(false);
                    handleCreateServico(selectedItem);
                  }}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Agendar Novo Serviço
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDetails(false)}
                >
                  Fechar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de Criar Serviço */}
      {selectedItem && (
        <ServicoForm
          open={showServicoForm}
          onClose={() => {
            setShowServicoForm(false);
            setSelectedItem(null);
          }}
          onSave={handleSaveServico}
          servico={null}
          isLoading={createServicoMutation.isPending}
          equipes={equipes}
          isAdmin={true}
          prefilledData={{
            cliente_nome: selectedItem.tipo === 'cliente' ? selectedItem.nome : selectedItem.cliente_nome,
            telefone: selectedItem.telefone,
            cpf: selectedItem.cpf || '',
            endereco: selectedItem.endereco || '',
            latitude: selectedItem.latitude,
            longitude: selectedItem.longitude
          }}
        />
      )}
    </div>
  );
}