import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AlertTriangle, X, Clock, Calendar, User, Phone, ChevronDown, CheckCircle2, Play } from 'lucide-react';
import { format, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function AlertaAtraso() {
  const [dismissed, setDismissed] = useState(false);
  const [notificacaoEnviada, setNotificacaoEnviada] = useState(false);
  const queryClient = useQueryClient();

  const { data: servicos = [] } = useQuery({
    queryKey: ['servicos'],
    queryFn: () => base44.entities.Servico.list(),
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ servico, novoStatus }) => {
      const currentUser = await base44.auth.me();
      const statusAnterior = servico.status || 'aberto';
      
      // Atualizar serviço
      await base44.entities.Servico.update(servico.id, {
        ...servico,
        status: novoStatus,
        usuario_atualizacao_status: currentUser?.email,
        data_atualizacao_status: new Date().toISOString()
      });
      
      // Registrar alteração de status
      await base44.entities.AlteracaoStatus.create({
        servico_id: servico.id,
        status_anterior: statusAnterior,
        status_novo: novoStatus,
        usuario: currentUser?.email,
        data_alteracao: new Date().toISOString(),
        tipo_registro: 'servico'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      toast.success('Status do serviço atualizado!');
    },
    onError: () => toast.error('Erro ao atualizar status'),
  });

  // Verificar serviços em atraso: status não concluído e mais de 48h após a data de CRIAÇÃO do serviço
  const servicosAtrasados = servicos.filter(s => {
    if (s.status === 'concluido') return false;
    
    const dataCriacao = new Date(s.created_date);
    const agora = new Date();
    const horasDesideCriacao = differenceInHours(agora, dataCriacao);
    
    return horasDesideCriacao >= 48;
  });

  // Enviar notificações para técnicos
  useEffect(() => {
    const enviarNotificacoesTecnicos = async () => {
      if (servicosAtrasados.length === 0 || notificacaoEnviada) return;

      const tecnicos = usuarios.filter(u => u.role === 'tecnico' || u.role === 'admin');
      
      for (const servico of servicosAtrasados) {
        const dataCriacao = new Date(servico.created_date);
        const horasAtraso = differenceInHours(new Date(), dataCriacao);
        const diasAtraso = Math.floor(horasAtraso / 24);
        
        for (const tecnico of tecnicos) {
          // Verificar preferências de notificação do técnico
          const preferencias = await base44.entities.PreferenciaNotificacao.filter({ 
            usuario_email: tecnico.email 
          });
          
          const deveNotificar = preferencias.length === 0 || preferencias[0]?.atendimento_atualizado !== false;
          
          if (deveNotificar) {
            // Criar notificação
            await base44.entities.Notificacao.create({
              usuario_email: tecnico.email,
              tipo: 'atendimento_atualizado',
              titulo: `⚠️ Serviço em Atraso - ${diasAtraso} dia(s)`,
              mensagem: `O serviço de ${servico.tipo_servico} para ${servico.cliente_nome} foi criado há ${diasAtraso} dia(s) e ainda não foi concluído.`,
              atendimento_id: servico.id,
              cliente_nome: servico.cliente_nome,
              lida: false
            });
          }
        }
      }
      
      setNotificacaoEnviada(true);
    };

    if (servicosAtrasados.length > 0 && usuarios.length > 0) {
      enviarNotificacoesTecnicos();
    }
  }, [servicosAtrasados, usuarios, notificacaoEnviada]);

  if (servicosAtrasados.length === 0 || dismissed) return null;

  return (
    <Card className="bg-gradient-to-r from-red-50 via-orange-50 to-red-50 border-2 border-red-300 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center animate-pulse">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-red-800 flex items-center gap-2">
                Serviços em Atraso
                <Badge className="bg-red-600 text-white">
                  {servicosAtrasados.length}
                </Badge>
              </CardTitle>
              <p className="text-red-700 text-sm mt-1">
                {servicosAtrasados.length === 1 
                  ? 'Um serviço está com mais de 24 horas de atraso'
                  : `${servicosAtrasados.length} serviços estão com mais de 24 horas de atraso`
                }
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDismissed(true)}
            className="text-red-600 hover:text-red-800 hover:bg-red-100"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {servicosAtrasados.slice(0, 5).map(servico => {
          const dataCriacao = new Date(servico.created_date);
          const horasAtraso = differenceInHours(new Date(), dataCriacao);
          const diasAtraso = Math.floor(horasAtraso / 24);
          
          return (
            <div 
              key={servico.id}
              className="bg-white rounded-lg p-4 border-l-4 border-red-500 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-500" />
                    <span className="font-semibold text-gray-800">{servico.cliente_nome}</span>
                    <Badge className="bg-red-100 text-red-800 border-red-200">
                      {diasAtraso} {diasAtraso === 1 ? 'dia' : 'dias'} atrasado
                    </Badge>
                  </div>
                  
                  <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Previsto: {format(dataPrograma, "dd/MM/yyyy", { locale: ptBR })}
                    </div>
                    {servico.horario && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {servico.horario}
                      </div>
                    )}
                    {servico.telefone && (
                      <div className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" />
                        {servico.telefone}
                      </div>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Serviço:</span> {servico.tipo_servico}
                  </p>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="flex items-center gap-1 shrink-0"
                    >
                      Alterar Status
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ servico, novoStatus: 'andamento' })}>
                      <Play className="w-4 h-4 mr-2 text-blue-600" />
                      Em Andamento
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ servico, novoStatus: 'concluido' })}>
                      <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                      Concluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
        
        {servicosAtrasados.length > 5 && (
          <p className="text-center text-sm text-red-700 pt-2">
            E mais {servicosAtrasados.length - 5} serviço(s) em atraso...
          </p>
        )}
      </CardContent>
    </Card>
  );
}