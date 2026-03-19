import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Download, Upload, Database, Loader2, CheckCircle, AlertCircle, FileJson, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import NoPermission from '../components/NoPermission';
import { usePermissions } from '../components/auth/PermissionGuard';

// Todas as entidades exportáveis e seus rótulos
const ENTIDADES = [
  { key: 'clientes',             entity: 'Cliente',                label: 'Clientes' },
  { key: 'servicos',             entity: 'Servico',                label: 'Serviços' },
  { key: 'atendimentos',         entity: 'Atendimento',            label: 'Atendimentos' },
  { key: 'equipes',              entity: 'Equipe',                 label: 'Equipes' },
  { key: 'alteracaoStatus',      entity: 'AlteracaoStatus',        label: 'Histórico de Status' },
  { key: 'notificacoes',         entity: 'Notificacao',            label: 'Notificações' },
  { key: 'preferenciasNotif',    entity: 'PreferenciaNotificacao', label: 'Preferências de Notificação' },
  { key: 'configuracaoRelat',    entity: 'ConfiguracaoRelatorio',  label: 'Configurações de Relatório' },
  { key: 'relatoriosGerados',    entity: 'RelatorioGerado',        label: 'Relatórios Gerados' },
  { key: 'manutencaoPreventiva', entity: 'ManutencaoPreventiva',   label: 'Manutenções Preventivas' },
  { key: 'usuarios',             entity: 'User',                   label: 'Usuários' },
];

export default function BackupRestaurerPage() {
  const { isAdmin } = usePermissions();
  const [importFile, setImportFile] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null); // { current, total, label }
  const [importResult, setImportResult] = useState(null);
  const queryClient = useQueryClient();

  // Buscar contagens de todas as entidades
  const queries = ENTIDADES.map(e => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useQuery({
      queryKey: [e.key],
      queryFn: () => base44.entities[e.entity].list(),
      enabled: isAdmin,
    });
  });

  const counts = ENTIDADES.reduce((acc, e, i) => {
    acc[e.key] = queries[i].data?.length ?? 0;
    return acc;
  }, {});

  const totalRegistros = Object.values(counts).reduce((a, b) => a + b, 0);
  const isLoadingAny = queries.some(q => q.isLoading);

  const handleExportBackup = async () => {
    setExporting(true);
    try {
      const dataObj = {};
      const metaObj = {};

      // Fetch fresh data para garantir que nada fique pra trás
      for (const e of ENTIDADES) {
        const records = await base44.entities[e.entity].list();
        dataObj[e.key] = records;
        metaObj[`total_${e.key}`] = records.length;
      }

      const backup = {
        version: '2.0',
        app: 'Casa do Ar',
        exported_at: new Date().toISOString(),
        data: dataObj,
        metadata: metaObj,
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

      const totalExportado = Object.values(metaObj).reduce((a, b) => a + b, 0);
      toast.success(`Backup exportado! ${totalExportado} registros salvos.`);
    } catch (error) {
      toast.error('Erro ao exportar backup: ' + error.message);
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
    setImportResult(null);
    const result = {};

    try {
      const text = await importFile.text();
      const backup = JSON.parse(text);

      if (!backup.data || !backup.version) {
        throw new Error('Formato de backup inválido');
      }

      const entidadesParaImportar = ENTIDADES.filter(
        e => e.entity !== 'User' // Usuários não podem ser criados por API
      );

      for (let i = 0; i < entidadesParaImportar.length; i++) {
        const e = entidadesParaImportar[i];
        setImportProgress({ current: i + 1, total: entidadesParaImportar.length, label: e.label });

        const records = backup.data[e.key];
        if (!records || records.length === 0) {
          result[e.label] = 0;
          continue;
        }

        // Remove campos internos do banco
        const cleaned = records.map(({ id, created_date, updated_date, created_by, ...rest }) => rest);

        // Importa em lotes de 50 para não sobrecarregar
        const BATCH = 50;
        let count = 0;
        for (let j = 0; j < cleaned.length; j += BATCH) {
          const batch = cleaned.slice(j, j + BATCH);
          await base44.entities[e.entity].bulkCreate(batch);
          count += batch.length;
        }
        result[e.label] = count;
      }

      queryClient.invalidateQueries();
      setImportResult(result);
      setImportFile(null);

      const total = Object.values(result).reduce((a, b) => a + b, 0);
      toast.success(`Backup restaurado com sucesso! ${total} registros importados.`);
    } catch (error) {
      toast.error('Erro ao importar backup: ' + error.message);
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  };

  if (!isAdmin) return <NoPermission />;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-white">Backup e Restaurar</h1>
        <p className="text-blue-300/70 mt-1">Exporte ou restaure todos os dados do sistema</p>
      </div>

      {/* Estatísticas */}
      <Card className="border border-blue-800/40" style={{backgroundColor: '#243447'}}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Database className="w-6 h-6 text-blue-400" />
            Dados Atuais do Sistema
            {isLoadingAny && <Loader2 className="w-4 h-4 animate-spin text-blue-400 ml-auto" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {ENTIDADES.map(e => (
              <div key={e.key} className="rounded-xl p-3 border border-blue-800/40" style={{backgroundColor: 'rgba(30,64,175,0.15)'}}>
                <p className="text-xs text-blue-300/70 truncate">{e.label}</p>
                <p className="text-2xl font-bold text-white">{counts[e.key]}</p>
              </div>
            ))}
            <div className="rounded-xl p-3 border border-yellow-600/40" style={{backgroundColor: 'rgba(245,158,11,0.15)'}}>
              <p className="text-xs text-yellow-300/70">Total Geral</p>
              <p className="text-2xl font-bold text-yellow-300">{totalRegistros}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exportar */}
      <Card className="border border-blue-800/40" style={{backgroundColor: '#243447'}}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Download className="w-5 h-5 text-blue-400" />
            Exportar Backup Completo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-blue-300/80">
            Exporta <strong className="text-white">todos</strong> os dados do sistema em um único arquivo JSON.
          </p>
          <div className="bg-blue-900/30 border border-blue-700/40 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-200 mb-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              O backup inclui todas as entidades:
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {ENTIDADES.map(e => (
                <Badge key={e.key} className="bg-blue-800/50 text-blue-200 border-blue-700/50 border">
                  {e.label} ({counts[e.key]})
                </Badge>
              ))}
            </div>
          </div>
          <Button
            onClick={handleExportBackup}
            disabled={exporting}
            className="w-full h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 font-semibold"
          >
            {exporting ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Exportando todos os dados...</>
            ) : (
              <><Download className="w-5 h-5 mr-2" />Exportar Backup Completo ({totalRegistros} registros)</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Importar */}
      <Card className="border border-blue-800/40" style={{backgroundColor: '#243447'}}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Upload className="w-5 h-5 text-green-400" />
            Importar Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-blue-300/80">
            Selecione um arquivo de backup (.json) para restaurar os dados no sistema.
          </p>
          <div className="bg-amber-900/20 border border-amber-600/40 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-200">
              <p className="font-medium">Atenção:</p>
              <p className="mt-1">A importação irá <strong>ADICIONAR</strong> os dados do backup sem remover os dados existentes. Para uma restauração limpa, apague os dados antes.</p>
              <p className="mt-1 text-amber-300/70">Nota: Usuários não são importados (requerem convite manual).</p>
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="backup-file" className="text-blue-200">Arquivo de Backup (.json)</Label>
            <Input
              id="backup-file"
              type="file"
              accept=".json,application/json"
              onChange={(e) => { setImportFile(e.target.files?.[0] || null); setImportResult(null); }}
              className="border-blue-800/50 text-white"
              style={{backgroundColor: 'rgba(30,64,175,0.2)'}}
            />
            {importFile && (
              <div className="flex items-center gap-2 text-sm text-green-400">
                <FileJson className="w-4 h-4" />
                <span>{importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)</span>
              </div>
            )}
          </div>

          {/* Progresso */}
          {importing && importProgress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-blue-200">
                <span>Importando: <strong>{importProgress.label}</strong></span>
                <span>{importProgress.current}/{importProgress.total}</span>
              </div>
              <div className="w-full bg-blue-900/40 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-green-500 to-emerald-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Resultado da importação */}
          {importResult && (
            <div className="bg-green-900/20 border border-green-700/40 rounded-lg p-4">
              <p className="text-green-300 font-medium mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Importação concluída com sucesso!
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(importResult).map(([label, count]) => (
                  <div key={label} className="flex items-center justify-between bg-green-900/30 rounded-lg px-3 py-2">
                    <span className="text-sm text-green-200 truncate">{label}</span>
                    <Badge className="bg-green-700/50 text-green-200 ml-2">{count}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={handleImportBackup}
            disabled={!importFile || importing}
            className="w-full h-12 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 font-semibold"
          >
            {importing ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Importando...</>
            ) : (
              <><Upload className="w-5 h-5 mr-2" />Restaurar Backup</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}