import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, X, CheckCircle2, Loader2, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const { data: notificacoes = [], isLoading } = useQuery({
    queryKey: ['notificacoes', currentUser?.email],
    queryFn: () => {
      if (!currentUser?.email) return [];
      return base44.entities.Notificacao.filter({ usuario_email: currentUser.email }, '-created_date', 50);
    },
    enabled: !!currentUser?.email,
    refetchInterval: 30000
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id) => base44.entities.Notificacao.update(id, { lida: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes'] });
    }
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (id) => base44.entities.Notificacao.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes'] });
    }
  });

  const notificacoesNaoLidas = notificacoes.filter((n) => !n.lida);

  const handleMarkAsRead = (id) => {
    markAsReadMutation.mutate(id);
  };

  const handleDelete = (id) => {
    deleteNotificationMutation.mutate(id);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)} className="text-slate-50 p-2 rounded-lg relative hover:bg-purple-700/30 transition-colors">


        <Bell className="w-5 h-5 text-purple-300" />
        {notificacoesNaoLidas.length > 0 &&
        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        }
      </button>

      {open &&
      <div className="fixed right-4 top-16 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-[60] max-h-96 overflow-y-auto">
          <div className="sticky top-0 bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-3 flex items-center justify-between">
            <h3 className="text-white font-bold">Notificações</h3>
            <button
            onClick={() => setOpen(false)}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors">

              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {isLoading ?
        <div className="flex justify-center items-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
            </div> :
        notificacoes.length === 0 ?
        <div className="p-6 text-center text-gray-500">
              <p>Sem notificações no momento</p>
            </div> :

        <div className="divide-y divide-gray-200">
              {notificacoes.map((notif) =>
          <div
            key={notif.id}
            className={cn(
              "p-4 hover:bg-gray-50 transition-colors",
              !notif.lida && notif.tipo === 'pagamento_agendado' ? 'bg-orange-50' : !notif.lida ? 'bg-blue-50' : ''
            )}>

                  <div className="flex items-start justify-between gap-3 mb-2">
                    {notif.tipo === 'pagamento_agendado' && (
                      <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <DollarSign className="w-4 h-4 text-orange-600" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className={`font-semibold text-sm ${notif.tipo === 'pagamento_agendado' ? 'text-orange-800' : 'text-gray-900'}`}>{notif.titulo}</p>
                      <p className="text-gray-600 text-xs mt-1">{notif.mensagem}</p>
                      {notif.cliente_nome &&
                <p className="text-gray-500 text-xs mt-2">Cliente: {notif.cliente_nome}</p>
                }
                    </div>
                    {!notif.lida &&
              <div className={`w-2 h-2 rounded-full mt-1 ${notif.tipo === 'pagamento_agendado' ? 'bg-orange-500' : 'bg-blue-500'}`} />
              }
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    {!notif.lida &&
              <button
                onClick={() => handleMarkAsRead(notif.id)}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">

                        <CheckCircle2 className="w-3 h-3" />
                        Marcar como lida
                      </button>
              }
                    <button
                onClick={() => handleDelete(notif.id)}
                className="text-xs text-gray-500 hover:text-red-600 ml-auto">

                      Remover
                    </button>
                  </div>
                </div>
          )}
            </div>
        }
        </div>
      }
    </div>);

}