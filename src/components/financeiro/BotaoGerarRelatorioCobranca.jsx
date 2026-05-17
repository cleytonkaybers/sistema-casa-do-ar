import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function BotaoGerarRelatorioCobranca({ className = '' }) {
  const [loading, setLoading] = useState(false);

  const handleGerar = async () => {
    setLoading(true);
    console.log('[backup-cobranca] iniciando...');
    try {
      const response = await base44.functions.invoke('gerarRelatorioCobrancaDrive');
      console.log('[backup-cobranca] resposta completa:', response);
      const data = response?.data || {};
      console.log('[backup-cobranca] data:', data);

      if (data.status === 'success') {
        toast.success(
          `✓ Excel gerado: ${data.totalClientes} cliente(s) em aberto`,
          {
            description: `Total devido: R$ ${(data.totalDevido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            action: data.driveLink
              ? {
                  label: 'Abrir no Drive',
                  onClick: () => window.open(data.driveLink, '_blank'),
                }
              : undefined,
            duration: 12000,
          }
        );
      } else if (data.status === 'skipped') {
        toast.info('Sem mudanças desde o último relatório', {
          description: 'O arquivo Excel anterior foi preservado no Drive',
          duration: 8000,
        });
      } else if (data.status === 'error' || data.error) {
        const msg = data.message || data.error || 'erro desconhecido';
        toast.error(`❌ Backend retornou erro: ${msg}`, {
          description: 'Veja Console (F12) para detalhes',
          duration: 15000,
        });
      } else {
        toast.error('Backend retornou resposta inesperada — abra Console (F12)', { duration: 12000 });
      }
    } catch (error) {
      console.error('[backup-cobranca] EXCECAO:', error);
      // Tenta extrair detalhes uteis da exception
      const detalhes = error?.response?.data?.message
        || error?.response?.data?.error
        || error?.message
        || JSON.stringify(error);
      // Erros comuns
      let dica = '';
      if (String(detalhes).toLowerCase().includes('googledrive')) {
        dica = ' — Verifique se Google Drive está conectado no painel Base44 (Settings → Integrations)';
      } else if (String(detalhes).toLowerCase().includes('relatoriocobrancapdf') || String(detalhes).toLowerCase().includes('entity')) {
        dica = ' — A entidade RelatorioCobrancaPDF pode não existir no painel Base44';
      } else if (String(detalhes).toLowerCase().includes('not found') || String(detalhes).includes('404')) {
        dica = ' — Function pode não estar publicada no painel Base44';
      }
      toast.error(`❌ ${detalhes}${dica}`, { duration: 20000 });
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
