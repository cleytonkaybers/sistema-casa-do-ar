import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  MoreVertical, 
  MapPin, 
  Phone,
  Edit,
  Trash2,
  Clock,
  Calendar
} from 'lucide-react';

export default function ClientesTable({ 
  clientes, 
  onEdit, 
  onDelete, 
  onViewHistory,
  isAdmin 
}) {
  const formatPhone = (phone) => {
    if (!phone) return '-';
    return phone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const getStatusColor = (cliente) => {
    const dataUltima = cliente.ultima_manutencao ? new Date(cliente.ultima_manutencao) : null;
    const dataProxima = cliente.proxima_manutencao ? new Date(cliente.proxima_manutencao) : null;
    const hoje = new Date();

    if (!dataProxima) return 'bg-gray-100 text-gray-700';
    if (dataProxima < hoje) return 'bg-red-100 text-red-700';
    if (dataProxima < new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000)) return 'bg-yellow-100 text-yellow-700';
    return 'bg-green-100 text-green-700';
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b-2 border-gray-200">
              <TableHead className="h-12 text-gray-700 font-bold">Nome</TableHead>
              <TableHead className="h-12 text-gray-700 font-bold">Telefone</TableHead>
              <TableHead className="h-12 text-gray-700 font-bold">Endereço</TableHead>
              <TableHead className="h-12 text-gray-700 font-bold">Última Manutenção</TableHead>
              <TableHead className="h-12 text-gray-700 font-bold">Próxima Manutenção</TableHead>
              <TableHead className="h-12 text-gray-700 font-bold">Status</TableHead>
              <TableHead className="h-12 text-right text-gray-700 font-bold">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientes.map((cliente, index) => (
              <TableRow 
                key={cliente.id}
                className={`border-b transition-colors hover:bg-blue-50/50 ${
                  index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                }`}
              >
                <TableCell className="font-semibold text-gray-900 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white font-bold text-sm">
                      {cliente.nome?.charAt(0).toUpperCase()}
                    </div>
                    {cliente.nome}
                  </div>
                </TableCell>
                <TableCell className="text-gray-600 py-4">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    {formatPhone(cliente.telefone)}
                  </div>
                </TableCell>
                <TableCell className="text-gray-600 py-4">
                  <div className="flex items-center gap-2 max-w-xs truncate">
                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{cliente.endereco || '-'}</span>
                  </div>
                </TableCell>
                <TableCell className="text-gray-600 py-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {formatDate(cliente.ultima_manutencao)}
                  </div>
                </TableCell>
                <TableCell className="text-gray-600 py-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    {formatDate(cliente.proxima_manutencao)}
                  </div>
                </TableCell>
                <TableCell className="py-4">
                  <Badge className={getStatusColor(cliente)}>
                    {!cliente.proxima_manutencao ? 'Sem agendamento' : 
                     new Date(cliente.proxima_manutencao) < new Date() ? 'Atrasada' :
                     new Date(cliente.proxima_manutencao) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) ? 'Próxima semana' :
                     'No prazo'}
                  </Badge>
                </TableCell>
                <TableCell className="py-4">
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 hover:bg-blue-100"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem 
                          onClick={() => onViewHistory?.(cliente)}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Clock className="w-4 h-4" />
                          Ver Histórico
                        </DropdownMenuItem>
                        {onEdit && (
                          <DropdownMenuItem 
                            onClick={() => onEdit(cliente)}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Edit className="w-4 h-4 text-blue-600" />
                            <span className="text-blue-600">Editar</span>
                          </DropdownMenuItem>
                        )}
                        {onDelete && (
                          <DropdownMenuItem 
                            onClick={() => onDelete(cliente)}
                            className="flex items-center gap-2 cursor-pointer text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                            Deletar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}