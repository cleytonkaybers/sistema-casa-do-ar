import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar, Mail, FileText, Loader2, Download, Trash2, Pencil, Play, Pause } from 'lucide-react';
import { toast } from 'sonner';
import ConfiguracaoRelatorioForm from '../components/relatorios/ConfiguracaoRelatorioForm';
import RelatoriosHistorico from '../components/relatorios/RelatoriosHistorico';
import GerarRelatorioManual from '../components/relatorios/GerarRelatorioManual';

import { usePermissions } from '@/components/auth/PermissionGuard';
import NoPermission from '@/components/NoPermission';

export default function RelatoriosAutomaticosPage() {
  const { isAdmin } = usePermissions();
  const [showForm, setShowForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [showHistorico, setShowHistorico] = useState(false);
  const [showGerarManual, setShowGerarManual] = useState(false);
  const queryClient = useQueryClient();

  const { data: configuracoes = [], isLoading } = useQuery({
    queryKey: ['configuracoes-relatorio'],
    queryFn: () => base44.entities.ConfiguracaoRelatorio.list('-created_date'),
    enabled: isAdmin,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ConfiguracaoRelatorio.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracoes-relatorio'] });
      toast.success('Configuração excluída!');
    },
    onError: () => toast.error('Erro ao excluir configuração'),
  });

  const toggleAtivoMutation = useMutation({
    mutationFn: ({ id, ativo }) => base44.entities.ConfiguracaoRelatorio.update(id, { ativo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracoes-relatorio'] });
      toast.success('Status atualizado!');
    },
    onError: () => toast.error('Erro ao atualizar status'),
  });

  if (!isAdmin) return <NoPermission />;

  const handleDelete = (config) => {
    if (confirm(`Excluir configuração "${config.nome}"?`)) {
      deleteMutation.mutate(config.id);
    }
  };

  const handleToggleAtivo = (config) => {
    toggleAtivoMutation.mutate({ id: config.id, ativo: !config.ativo });
  };

  const getPeriodicidadeBadge = (periodicidade) => {
    const configs = {
      diaria: { label: 'Diária', color: 'bg-blue-100 text-blue-700' },
      semanal: { label: 'Semanal', color: 'bg-green-100 text-green-700' },
      mensal: { label: 'Mensal', color: 'bg-purple-100 text-purple-700' },
    };
    return configs[periodicidade] || configs.diaria;
  };

  const getDiaSemanaTexto = (dia) => {
    const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return dias[dia] || '';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Relatórios Automáticos</h1>
          <p className="text-purple-200 mt-1">Configure relatórios periódicos e automáticos</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowHistorico(true)}
            variant="outline"
            className="bg-white/10 text-white border-white/20 hover:bg-white/20"
          >
            <FileText className="w-4 h-4 mr-2" />
            Histórico
          </Button>
          <Button
            onClick={() => setShowGerarManual(true)}
            variant="outline"
            className="bg-white/10 text-white border-white/20 hover:bg-white/20"
          >
            <Download className="w-4 h-4 mr-2" />
            Gerar Manual
          </Button>
          <Button
            onClick={() => {
              setEditingConfig(null);
              setShowForm(true);
            }}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Configuração
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        </div>
      ) : configuracoes.length === 0 ? (
        <Card className="bg-white/10 backdrop-blur border-white/20">
          <CardContent className="py-12 text-center">
            <Calendar className="w-16 h-16 mx-auto text-purple-300 mb-4" />
            <p className="text-white text-lg">Nenhuma configuração de relatório cadastrada</p>
            <p className="text-purple-200 mt-2">Crie sua primeira configuração para gerar relatórios automaticamente</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {configuracoes.map((config) => {
            const periodicidadeInfo = getPeriodicidadeBadge(config.periodicidade);
            
            return (
              <Card key={config.id} className="bg-white/10 backdrop-blur border-white/20 hover:bg-white/15 transition-all">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-white text-lg">{config.nome}</CardTitle>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge className={periodicidadeInfo.color}>
                          <Calendar className="w-3 h-3 mr-1" />
                          {periodicidadeInfo.label}
                        </Badge>
                        <Badge className={config.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                          {config.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2 text-sm">
                    {config.periodicidade === 'semanal' && config.dia_envio !== undefined && (
                      <div className="flex items-center gap-2 text-purple-200">
                        <Calendar className="w-4 h-4" />
                        <span>Envio: {getDiaSemanaTexto(config.dia_envio)}</span>
                      </div>
                    )}
                    {config.periodicidade === 'mensal' && config.dia_envio && (
                      <div className="flex items-center gap-2 text-purple-200">
                        <Calendar className="w-4 h-4" />
                        <span>Envio: Dia {config.dia_envio}</span>
                      </div>
                    )}
                    
                    {config.destinatarios_admins && config.destinatarios_admins.length > 0 && (
                      <div className="flex items-center gap-2 text-purple-200">
                        <Mail className="w-4 h-4" />
                        <span>{config.destinatarios_admins.length} destinatário(s)</span>
                      </div>
                    )}
                    
                    {config.ultimo_envio && (
                      <div className="text-purple-300 text-xs">
                        Último envio: {new Date(config.ultimo_envio).toLocaleString('pt-BR')}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-white/10">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleAtivo(config)}
                      className="flex-1 bg-white/5 text-white border-white/20 hover:bg-white/10"
                    >
                      {config.ativo ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                      {config.ativo ? 'Pausar' : 'Ativar'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingConfig(config);
                        setShowForm(true);
                      }}
                      className="bg-white/5 text-white border-white/20 hover:bg-white/10"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(config)}
                      className="bg-white/5 text-red-300 border-white/20 hover:bg-red-500/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ConfiguracaoRelatorioForm
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingConfig(null);
        }}
        configuracao={editingConfig}
      />

      <RelatoriosHistorico
        open={showHistorico}
        onClose={() => setShowHistorico(false)}
      />

      <GerarRelatorioManual
        open={showGerarManual}
        onClose={() => setShowGerarManual(false)}
      />
    </div>
  );
}