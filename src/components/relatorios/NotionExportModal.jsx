import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { ExternalLink, Loader2, CheckCircle2, FileText } from 'lucide-react';

export default function NotionExportModal({ open, onClose }) {
  const [parentPageId, setParentPageId] = useState('');
  const [tipo, setTipo] = useState('todos');
  const [periodo, setPeriodo] = useState('mes');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');

  const handleEnviar = async () => {
    if (!parentPageId.trim()) {
      setErro('Informe o ID da página do Notion onde o relatório será salvo.');
      return;
    }
    setErro('');
    setLoading(true);
    setResultado(null);
    try {
      const res = await base44.functions.invoke('enviarRelatorioNotion', {
        parent_page_id: parentPageId.trim(),
        tipo,
        periodo,
      });
      setResultado(res.data);
    } catch (e) {
      setErro(e?.response?.data?.error || 'Erro ao enviar para o Notion.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setResultado(null);
    setErro('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-700" />
            Exportar Relatório para Notion
          </DialogTitle>
        </DialogHeader>

        {resultado ? (
          <div className="py-4 space-y-4">
            <div className="flex flex-col items-center gap-3 text-center py-4">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
              <p className="font-bold text-gray-800 text-lg">Relatório enviado!</p>
              <p className="text-sm text-gray-500">{resultado.blocks_created} blocos criados no Notion.</p>
              {resultado.page_url && (
                <a
                  href={resultado.page_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Abrir no Notion
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="py-3 space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                ID da Página do Notion (onde salvar)
              </label>
              <Input
                value={parentPageId}
                onChange={e => setParentPageId(e.target.value)}
                placeholder="Ex: 1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d"
                className="font-mono text-sm"
              />
              <p className="text-xs text-gray-400 mt-1.5">
                Abra a página no Notion → clique em "..." → "Copy link" → o ID é a parte final da URL (32 caracteres após o último "/").
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Tipo de Relatório</label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">📊 Relatório Completo (todos)</SelectItem>
                  <SelectItem value="pagamentos">💰 Pagamentos de Clientes</SelectItem>
                  <SelectItem value="servicos">🔧 Serviços Concluídos</SelectItem>
                  <SelectItem value="comissoes">💼 Comissões dos Técnicos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Período</label>
              <Select value={periodo} onValueChange={setPeriodo}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semana">Semana Atual</SelectItem>
                  <SelectItem value="mes">Mês Atual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {erro && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {resultado ? 'Fechar' : 'Cancelar'}
          </Button>
          {!resultado && (
            <Button onClick={handleEnviar} disabled={loading} className="bg-gray-900 hover:bg-gray-700 text-white gap-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : '📤 Enviar para Notion'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}