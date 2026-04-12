import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Phone, MapPin, Calendar, MessageCircle, Navigation, Search, Loader2, Clock, Wrench, Share2, Eye, Plus, Trash2, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
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
import { format, differenceInDays, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ServicoForm from '../components/servicos/ServicoForm';
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
    if (item.google_maps_link) return item.google_maps_link;
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
    
    if (daysUntil < 0) {
      return { 
        label: `VENCIDA - ${Math.abs(daysUntil)} dias`, 
        color: 'bg-red-500/10 text-red-500 border-red-500/20 shadow-inner',
        priority: 1,
        days: daysUntil,
        vencida: true
      };
    }
    if (daysUntil <= 7) {
      return { 
        label: `URGENTE - ${daysUntil} ${daysUntil === 1 ? 'dia' : 'dias'}`, 
        color: 'bg-orange-500/10 text-orange-400 border-orange-500/20 shadow-inner',
        priority: 2,
        days: daysUntil,
        vencida: false
      };
    }
    if (daysUntil <= 30) {
      return { 
        label: `Faltam ${daysUntil} dias`, 
        color: 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-inner',
        priority: 3,
        days: daysUntil,
        vencida: false
      };
    }
    if (daysUntil <= 90) {
      return { 
        label: `Faltam ${daysUntil} dias`, 
        color: 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-inner',
        priority: 4,
        days: daysUntil,
        vencida: false
      };
    }
    return { 
      label: `Faltam ${daysUntil} dias`, 
      color: 'bg-gray-500/10 text-gray-400 border-gray-500/20 shadow-inner',
      priority: 5,
      days: daysUntil,
      vencida: false
    };
  };

  const clientesComManutencao = clientes
    .map(cliente => {
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

  const todosItens = [...clientesComManutencao]
    .filter(item => {
      const matchNome = item.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       item.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchTelefone = item.telefone?.includes(searchTerm);
      return matchNome || matchTelefone;
    })
    .sort((a, b) => {
      const daysA = a.status?.days ?? 999;
      const daysB = b.status?.days ?? 999;
      return daysA - daysB;
    });

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
      
      const todosClientes = await base44.entities.Cliente.list();
      const clienteExistente = todosClientes.find(c => 
        c.telefone?.replace(/\D/g, '') === servicoData.telefone?.replace(/\D/g, '')
      );
      
      if (clienteExistente) {
        await base44.entities.Cliente.update(clienteExistente.id, {
          proxima_manutencao: null,
          ultima_manutencao: format(new Date(), 'yyyy-MM-dd')
        });
      }
      
      return servico;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      setShowServicoForm(false);
      setSelectedItem(null);
      toast.success('Serviço agendado! Preventiva removida — será gerada ao concluir.');
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
    <div className="space-y-6 max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-100 tracking-tight">Preventivas Futuras</h1>
          <p className="text-gray-400 mt-1 flex items-center gap-2 text-sm">
            Manutenções programadas ou serviços ativos
          </p>
        </div>
      </div>

      <div className="bg-[#152236] border border-white/5 rounded-2xl p-4 shadow-sm flex items-center">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-[#0d1826] border-white/10 text-gray-200 placeholder:text-gray-500 h-11 w-full rounded-xl"
          />
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={10} />
      ) : (
        <>
          {todosItens.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-2">
               <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest w-full sm:w-auto text-center sm:text-left">
                  Mostrando {startIndex + 1} a {Math.min(endIndex, todosItens.length)} de {todosItens.length}
               </p>
               <div className="flex items-center justify-center gap-2 pb-4 sm:pb-0">
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
          )}

          {todosItens.length === 0 ? (
            <div className="text-center py-20 bg-[#152236] border border-white/5 rounded-2xl flex flex-col items-center">
               <div className="w-20 h-20 bg-[#0d1826] border border-white/5 rounded-full flex items-center justify-center mb-5">
                 <AlertTriangle className="w-8 h-8 text-gray-600" />
               </div>
               <h3 className="text-lg font-bold text-gray-200 mb-2">
                  {searchTerm 
                     ? 'Nenhum resultado encontrado'
                     : 'Nenhuma manutenção programada'
                  }
               </h3>
               <p className="text-sm text-gray-500">Tente buscar por um cliente diferente ou limpe o filtro.</p>
            </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <Card className="hidden lg:block border border-white/5 bg-[#152236] shadow-sm rounded-2xl overflow-hidden">
            <Table>
              <TableHeader className="bg-[#0b1420] border-b border-white/5">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-gray-400 font-semibold h-12 w-28 text-center">Tipo</TableHead>
                  <TableHead className="text-gray-400 font-semibold h-12">Cliente</TableHead>
                  <TableHead className="text-gray-400 font-semibold h-12 w-40">Telefone</TableHead>
                  <TableHead className="text-gray-400 font-semibold h-12">Endereço</TableHead>
                  <TableHead className="text-gray-400 font-semibold h-12 w-48">Previsão</TableHead>
                  <TableHead className="text-gray-400 font-semibold h-12 w-40">Status</TableHead>
                  <TableHead className="text-gray-400 font-semibold h-12 w-[240px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-white/5">
                {paginatedItens.map((item) => {
                  const isCliente = item.tipo === 'cliente';
                  const mapsLink = getGoogleMapsLink(item);

                  return (
                    <TableRow key={`${item.tipo}-${item.id}`} className="hover:bg-white/5 border-none transition-colors group">
                      <TableCell className="text-center">
                        <Badge className={`${isCliente ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-pink-500/10 text-pink-400 border-pink-500/20'} font-semibold border`}>
                          {isCliente ? 'Cliente' : 'Serviço'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-gray-200">
                        {isCliente ? item.nome : item.cliente_nome}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-gray-400 bg-[#0d1826] border border-white/5 px-2 py-1 rounded-md w-max shadow-inner">
                          <Phone className="w-3 h-3 text-emerald-400" />
                          <span className="text-[12px]">{formatPhone(item.telefone)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          {item.endereco ? (
                            <div className="flex items-start gap-2 text-gray-400 truncate">
                              <MapPin className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                              <span className="text-sm truncate">{item.endereco}</span>
                            </div>
                          ) : (
                            <span className="text-gray-600 text-sm">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isCliente && item.proximaManutencao ? (
                          <div className="flex items-center gap-2 text-sm text-gray-300">
                            <Calendar className="w-4 h-4 text-blue-400" />
                            <span className="font-medium">{format(new Date(item.proximaManutencao), "dd/MM/yyyy", { locale: ptBR })}</span>
                          </div>
                        ) : !isCliente ? (
                          <div className="text-sm space-y-1">
                            <div className="font-medium text-gray-300">{item.tipo_servico}</div>
                            {item.dia_semana && (
                              <div className="flex items-center gap-1 text-gray-500 text-xs">
                                <Calendar className="w-3 h-3" />
                                {item.dia_semana}
                                {item.horario && ` - ${item.horario}`}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-600 text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${item.status.color} border px-2 py-0.5 whitespace-nowrap`}>
                          {item.status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                         {/* Action Buttons styled modernly */}
                         <div className="flex items-center justify-end gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                           <Button variant="ghost" size="icon" onClick={() => handleViewDetails(item)} className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10" title="Ver Detalhes">
                             <Eye className="w-4 h-4" />
                           </Button>
                           <Button variant="ghost" size="icon" onClick={() => handleCreateServico(item)} className="h-8 w-8 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10" title="Agendar Serviço">
                             <Plus className="w-4 h-4" />
                           </Button>
                           <Button variant="ghost" size="icon" onClick={() => handleShare(item)} className="h-8 w-8 text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10" title="Compartilhar">
                             <Share2 className="w-4 h-4" />
                           </Button>
                           {isCliente && isAdmin && (
                             <Button variant="ghost" size="icon" onClick={() => handleDelete(item)} className="h-8 w-8 text-gray-400 hover:text-red-400 hover:bg-red-500/10" title="Excluir">
                               <Trash2 className="w-4 h-4" />
                             </Button>
                           )}
                           <a href={getWhatsAppLink(item.telefone)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center h-8 w-8 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-md transition-colors border border-emerald-500/20 ml-1" title="WhatsApp">
                             <MessageCircle className="w-4 h-4" />
                           </a>
                           {mapsLink && (
                             <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center h-8 w-8 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-md transition-colors border border-blue-500/20" title="Google Maps">
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
          </Card>

          {/* Mobile Cards View */}
          <div className="lg:hidden flex flex-col gap-4">
             {paginatedItens.map((item) => {
               const isCliente = item.tipo === 'cliente';
               const mapsLink = getGoogleMapsLink(item);

               return (
                 <Card key={`${item.tipo}-${item.id}`} className="bg-[#152236] border border-white/5 shadow-md hover:border-white/10 transition-colors overflow-hidden rounded-2xl flex flex-col">
                   <CardContent className="p-4 sm:p-5 flex-1 flex flex-col">
                     {/* Client Info Header */}
                     <div className="flex items-start justify-between mb-3 gap-2">
                        <div className="flex-1 min-w-0">
                           <Badge className={`mb-1.5 ${isCliente ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-pink-500/10 text-pink-400 border-pink-500/20'} font-semibold border text-[9px] uppercase tracking-wider`}>
                             {isCliente ? 'Cliente' : 'Serviço'}
                           </Badge>
                           <p className="font-bold text-gray-100 text-lg truncate">{isCliente ? item.nome : item.cliente_nome}</p>
                           {item.telefone && (
                             <p className="text-xs text-emerald-400 font-medium flex items-center mt-1">
                               <Phone className="w-3 h-3 mr-1" />
                               {formatPhone(item.telefone)}
                             </p>
                           )}
                        </div>
                     </div>
                     
                     {/* Detail Blocks */}
                     <div className="space-y-3 bg-[#0d1826] rounded-xl p-3 border border-white/5 mb-4">
                       <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Status da Preventiva</span>
                          <Badge className={`${item.status.color} border px-2 py-0.5 w-max text-xs`}>
                            {item.status.label}
                          </Badge>
                       </div>
                       <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                          <div>
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-0.5">Agendamento</span>
                            {isCliente && item.proximaManutencao ? (
                               <p className="text-xs text-gray-300 flex items-center"><Calendar className="w-3 h-3 mr-1 text-blue-400"/> {format(new Date(item.proximaManutencao), "dd/MM/yyyy")}</p>
                            ) : !isCliente && item.dia_semana ? (
                               <p className="text-xs text-gray-300 flex items-center flex-wrap"><Calendar className="w-3 h-3 mr-1 text-blue-400"/> {item.dia_semana} {item.horario}</p>
                            ) : <p className="text-gray-600 text-xs">-</p>}
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-0.5">Localização</span>
                            <p className="text-xs text-gray-400 truncate">{item.endereco || '-'}</p>
                          </div>
                       </div>
                     </div>

                     {/* Actions Grid (Mobile Touch Friendly) */}
                     <div className="grid grid-cols-5 gap-2 mt-auto pt-2 border-t border-white/5">
                         <Button variant="outline" className="col-span-2 bg-[#0d1826] border-white/10 hover:bg-blue-500/10 hover:text-blue-400 text-gray-300 h-10 px-0 flex" onClick={() => handleCreateServico(item)}>
                            <Plus className="w-4 h-4 mr-1.5" />
                            <span className="text-xs font-semibold">Agendar</span>
                         </Button>
                         <Button variant="outline" className="col-span-1 bg-[#0d1826] border-white/10 hover:bg-white/10 text-gray-300 h-10 px-0 flex items-center justify-center" onClick={() => handleViewDetails(item)}>
                            <Eye className="w-4 h-4" />
                         </Button>
                         <a href={getWhatsAppLink(item.telefone)} target="_blank" rel="noopener noreferrer" className="col-span-1 flex items-center justify-center h-10 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-lg hover:bg-emerald-500/20">
                            <MessageCircle className="w-5 h-5" />
                         </a>
                         {mapsLink ? (
                           <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="col-span-1 flex items-center justify-center h-10 bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded-lg hover:bg-blue-500/20">
                              <Navigation className="w-5 h-5" />
                           </a>
                         ) : (
                           <Button variant="outline" disabled className="col-span-1 h-10 bg-[#0d1826]/50 border-white/5 opacity-50 px-0">
                             <Navigation className="w-5 h-5 text-gray-500" />
                           </Button>
                         )}
                     </div>
                     {isAdmin && isCliente && (
                        <div className="mt-2 pt-2 flex items-center justify-end">
                           <Button variant="ghost" size="sm" className="h-8 text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10 px-2" onClick={() => handleDelete(item)}>Excluir registro</Button>
                        </div>
                     )}
                   </CardContent>
                 </Card>
               );
             })}
          </div>
          </>
        )}
      </>
      )}

      {/* Modal de Detalhes Modernizado */}
      {selectedItem && (
        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-[#152236] border-white/10 text-gray-200">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Detalhes do Registro
                <Badge className={`ml-2 ${selectedItem.tipo === 'cliente' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-pink-500/10 text-pink-400 border-pink-500/20'} font-semibold border text-[10px] uppercase`}>
                  {selectedItem.tipo === 'cliente' ? 'Cliente' : 'Serviço Ativo'}
                </Badge>
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 mt-2">
              <div className="bg-[#0b1420] border border-white/5 p-5 rounded-xl shadow-inner">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">Nome Principal</p>
                <h3 className="text-2xl font-bold text-gray-100">
                  {selectedItem.tipo === 'cliente' ? selectedItem.nome : selectedItem.cliente_nome}
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#0d1826] p-4 rounded-xl border border-white/5">
                  <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Telefone</span>
                  <div className="flex items-center gap-2 text-emerald-400 font-medium">
                    <Phone className="w-4 h-4" />
                    {formatPhone(selectedItem.telefone)}
                  </div>
                </div>

                {selectedItem.cpf && (
                  <div className="bg-[#0d1826] p-4 rounded-xl border border-white/5">
                    <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest block mb-1">CPF</span>
                    <p className="text-gray-200 font-medium">{selectedItem.cpf}</p>
                  </div>
                )}

                {selectedItem.tipo !== 'cliente' && selectedItem.tipo_servico && (
                  <div className="bg-[#0d1826] p-4 rounded-xl border border-white/5">
                    <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Tipo de Serviço</span>
                    <p className="text-gray-200 font-medium">{selectedItem.tipo_servico}</p>
                  </div>
                )}

                {selectedItem.dia_semana && (
                  <div className="bg-[#0d1826] p-4 rounded-xl border border-white/5">
                    <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Agendamento Diário</span>
                    <p className="text-gray-200 font-medium">{selectedItem.dia_semana} {selectedItem.horario && ` às ${selectedItem.horario}`}</p>
                  </div>
                )}

                {selectedItem.valor && (
                  <div className="bg-[#0d1826] p-4 rounded-xl border border-white/5">
                    <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Valor</span>
                    <p className="text-emerald-400 font-bold text-lg">R$ {selectedItem.valor.toFixed(2)}</p>
                  </div>
                )}
              </div>

              {selectedItem.endereco && (
                <div className="bg-[#0b1420] p-4 rounded-xl border border-white/5">
                  <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest block mb-2">Endereço Completo</span>
                  <div className="flex items-start gap-2 text-gray-300">
                    <MapPin className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                    <span>{selectedItem.endereco}</span>
                  </div>
                </div>
              )}

              {selectedItem.tipo === 'cliente' && selectedItem.proximaManutencao && (
                <div className="bg-[#0d1826] p-5 rounded-xl border border-white/5 shadow-sm">
                  <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest block mb-3">Controle de Preventiva</span>
                  
                  {editingDate ? (
                    <div className="space-y-4">
                      <Input
                        type="date"
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                        className="max-w-[200px] bg-[#152236] border-white/10 text-white"
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={handleSaveDate}
                          disabled={updateClienteDateMutation.isPending}
                          className="bg-blue-600 hover:bg-blue-500 text-white font-medium"
                        >
                          {updateClienteDateMutation.isPending ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando</>
                          ) : 'Confirmar Data'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingDate(false);
                            setNewDate(selectedItem.proximaManutencao);
                          }}
                          className="border-white/10 text-gray-400 hover:text-white hover:bg-white/5"
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex gap-4 items-center">
                        <span className="text-gray-200 font-bold flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-blue-400" />
                          {format(new Date(selectedItem.proximaManutencao), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                        <Badge className={`${selectedItem.status.color} border px-2 py-0.5`}>
                          {selectedItem.status.label}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingDate(true)}
                        className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                      >
                        Editar
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {(selectedItem.observacoes || selectedItem.descricao) && (
                <div className="bg-[#0b1420] p-4 rounded-xl border border-white/5">
                  <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest block mb-2">
                    {selectedItem.tipo === 'cliente' ? 'Observações' : 'Descrição do Serviço'}
                  </span>
                  <p className="text-gray-300 italic text-sm">
                    "{selectedItem.observacoes || selectedItem.descricao}"
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button
                  onClick={() => {
                    setShowDetails(false);
                    handleCreateServico(selectedItem);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 font-bold h-12"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Agendar Novo Serviço
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDetails(false)}
                  className="bg-transparent border-white/10 text-gray-400 hover:text-white hover:bg-white/5 h-12 px-8"
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