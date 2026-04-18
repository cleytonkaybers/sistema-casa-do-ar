import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function BotaoGerarRelatorioCobranca({ className = '' }) {
  const [loading, setLoading] = useState(false);

  const handleGerar = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('gerarRelatorioCobrancaDrive');
      const data = response?.data || {};

      if (data.status === 'success') {
        toast.success(
          `Excel gerado: ${data.totalClientes} clientes em aberto`,
          {
            description: `Total devido: R$ ${(data.totalDevido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            action: data.driveLink
              ? {
                  label: 'Abrir no Drive',
                  onClick: () => window.open(data.driveLink, '_blank'),
                }
              : undefined,
            duration: 8000,
          }
        );
      } else if (data.status === 'skipped') {
        toast.info('Sem mudanças desde o último relatório', {
          description: 'O arquivo Excel anterior foi preservado no Drive',
        });
      } else {
        toast.error(data.message || 'Erro ao gerar relatório');
      }
    } catch (error) {
      toast.error('Erro ao gerar relatório: ' + (error?.message || 'desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleGerar}
      disabled={loading}
      className={className}
      title="Gera planilha Excel com todos os débitos em aberto e envia ao Google Drive"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
          Gerando…
        </>
      ) : (
        <>
          <FileSpreadsheet className="w-4 h-4 mr-1.5" />
          Backup Cobrança Excel
        </>
      )}
    </Button>
  );
}
