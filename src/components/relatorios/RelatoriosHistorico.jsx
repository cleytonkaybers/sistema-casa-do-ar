import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Download, Mail, Calendar, TrendingUp, Loader2, Search } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function RelatoriosHistorico({ open, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: relatorios = [], isLoading } = useQuery({
    queryKey: ['relatorios-gerados'],
    queryFn: () => base44.entities.RelatorioGerado.list('-created_date', 100),
    enabled: open,
  });

  const filteredRelatorios = relatorios.filter(r => 
    r.configuracao_nome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status) => {
    const configs = {
      enviado: { label: 'Enviado', color: 'bg-green-100 text-green-700' },
      pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700' },
      erro: { label: 'Erro', color: 'bg-red-100 text-red-700' },
    };
    return configs[status] || configs.pendente;
  };

  const handleDownloadPDF = (relatorio) => {
    if (relatorio.pdf_url) {
      window.open(relatorio.pdf_url, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-6 h-6" />
            Histórico de Relatórios Gerados
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar por nome da configuração..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : filteredRelatorios.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {searchTerm ? 'Nenhum relatório encontrado' : 'Nenhum relatório gerado ainda'}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRelatorios.map((relatorio) => {
                const statusInfo = getStatusBadge(relatorio.status_envio);
                
                return (
                  <div key={relatorio.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{relatorio.configuracao_nome}</h3>
                          <Badge className={statusInfo.color}>
                            {statusInfo.label}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div className="flex items-center gap-2 text-gray-600">
                            <Calendar className="w-4 h-4" />
                            <span>
                              {format(new Date(relatorio.periodo_inicio), 'dd/MM/yy', { locale: ptBR })} - {format(new Date(relatorio.periodo_fim), 'dd/MM/yy', { locale: ptBR })}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-gray-600">
                            <TrendingUp className="w-4 h-4" />
                            <span>{relatorio.total_servicos || 0} serviços</span>
                          </div>
                          
                          {relatorio.valor_total > 0 && (
                            <div className="flex items-center gap-2 text-green-600 font-semibold">
                              <span>R$ {relatorio.valor_total.toFixed(2)}</span>
                            </div>
                          )}
                          
                          {relatorio.enviado_para && relatorio.enviado_para.length > 0 && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <Mail className="w-4 h-4" />
                              <span>{relatorio.enviado_para.length} destinatário(s)</span>
                            </div>
                          )}
                        </div>

                        <div className="text-xs text-gray-500">
                          Gerado em {format(new Date(relatorio.created_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </div>
                      </div>

                      {relatorio.pdf_url && (
                        <Button
                          size="sm"
                          onClick={() => handleDownloadPDF(relatorio)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Download className="w-4 h-4 mr-1" />
                          PDF
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}