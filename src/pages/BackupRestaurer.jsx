import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Upload, Database, Loader2, CheckCircle, AlertCircle, FileJson } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function BackupRestaurerPage() {
  const [importFile, setImportFile] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const queryClient = useQueryClient();

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list(),
  });

  const { data: servicos = [] } = useQuery({
    queryKey: ['servicos'],
    queryFn: () => base44.entities.Servico.list(),
  });

  const { data: atendimentos = [] } = useQuery({
    queryKey: ['atendimentos'],
    queryFn: () => base44.entities.Atendimento.list(),
  });

  const handleExportBackup = async () => {
    setExporting(true);
    try {
      const backup = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        data: {
          clientes: clientes,
          servicos: servicos,
          atendimentos: atendimentos
        },
        metadata: {
          total_clientes: clientes.length,
          total_servicos: servicos.length,
          total_atendimentos: atendimentos.length
        }
      };

      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_casa_do_ar_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Backup exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar backup:', error);
      toast.error('Erro ao exportar backup');
    } finally {
      setExporting(false);
    }
  };

  const handleImportBackup = async () => {
    if (!importFile) {
      toast.error('Selecione um arquivo de backup');
      return;
    }

    setImporting(true);
    try {
      const text = await importFile.text();
      const backup = JSON.parse(text);

      if (!backup.data || !backup.version) {
        throw new Error('Formato de backup inválido');
      }

      let importedCount = 0;

      // Importar clientes
      if (backup.data.clientes && backup.data.clientes.length > 0) {
        for (const cliente of backup.data.clientes) {
          const { id, created_date, updated_date, created_by, ...clienteData } = cliente;
          await base44.entities.Cliente.create(clienteData);
          importedCount++;
        }
      }

      // Importar serviços
      if (backup.data.servicos && backup.data.servicos.length > 0) {
        for (const servico of backup.data.servicos) {
          const { id, created_date, updated_date, created_by, ...servicoData } = servico;
          await base44.entities.Servico.create(servicoData);
          importedCount++;
        }
      }

      // Importar atendimentos
      if (backup.data.atendimentos && backup.data.atendimentos.length > 0) {
        for (const atendimento of backup.data.atendimentos) {
          const { id, created_date, updated_date, created_by, ...atendimentoData } = atendimento;
          await base44.entities.Atendimento.create(atendimentoData);
          importedCount++;
        }
      }

      queryClient.invalidateQueries();
      toast.success(`Backup restaurado! ${importedCount} registros importados.`);
      setImportFile(null);
    } catch (error) {
      console.error('Erro ao importar backup:', error);
      toast.error('Erro ao importar backup: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  const totalRegistros = clientes.length + servicos.length + atendimentos.length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Backup e Restaurar</h1>
        <p className="text-gray-500 mt-1">Faça backup ou restaure seus dados do sistema</p>
      </div>

      {/* Card de Estatísticas */}
      <Card className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-6 h-6" />
            Dados do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm opacity-90">Total de Registros</p>
              <p className="text-2xl font-bold">{totalRegistros}</p>
            </div>
            <div>
              <p className="text-sm opacity-90">Clientes</p>
              <p className="text-2xl font-bold">{clientes.length}</p>
            </div>
            <div>
              <p className="text-sm opacity-90">Serviços</p>
              <p className="text-2xl font-bold">{servicos.length}</p>
            </div>
            <div>
              <p className="text-sm opacity-90">Atendimentos</p>
              <p className="text-2xl font-bold">{atendimentos.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card de Exportar Backup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <Download className="w-5 h-5 text-blue-600" />
            Exportar Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600">
            Faça o download de todos os dados do sistema em formato JSON. 
            Este arquivo contém clientes, serviços e atendimentos.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">O backup inclui:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>{clientes.length} clientes cadastrados</li>
                <li>{servicos.length} serviços registrados</li>
                <li>{atendimentos.length} atendimentos realizados</li>
              </ul>
            </div>
          </div>
          <Button 
            onClick={handleExportBackup}
            disabled={exporting || totalRegistros === 0}
            className="w-full h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
          >
            {exporting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="w-5 h-5 mr-2" />
                Exportar Backup Completo
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Card de Importar Backup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <Upload className="w-5 h-5 text-green-600" />
            Importar Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600">
            Selecione um arquivo de backup (.json) para restaurar os dados no sistema.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Atenção:</p>
              <p className="mt-1">
                A importação irá ADICIONAR os dados do backup ao sistema. 
                Os dados existentes não serão removidos.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <Label htmlFor="backup-file" className="text-gray-700">
              Arquivo de Backup (.json)
            </Label>
            <div className="flex items-center gap-3">
              <Input
                id="backup-file"
                type="file"
                accept=".json,application/json"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="flex-1"
              />
              {importFile && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <FileJson className="w-4 h-4" />
                  <span>{importFile.name}</span>
                </div>
              )}
            </div>
          </div>
          <Button 
            onClick={handleImportBackup}
            disabled={!importFile || importing}
            className="w-full h-12 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
          >
            {importing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 mr-2" />
                Restaurar Backup
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}