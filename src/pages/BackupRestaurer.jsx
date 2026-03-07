import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Download, Upload, Database, Loader2, CheckCircle, AlertCircle, FileJson, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import NoPermission from '../components/NoPermission';
import { usePermissions } from '../components/auth/PermissionGuard';

// Todas as entidades do sistema
const ENTITIES = [
  { key: 'clientes',              label: 'Clientes',                  entity: 'Cliente' },
  { key: 'servicos',              label: 'Serviços',                  entity: 'Servico' },
  { key: 'atendimentos',         label: 'Atendimentos',              entity: 'Atendimento' },
  { key: 'equipes',               label: 'Equipes',                   entity: 'Equipe' },
  { key: 'alteracaoStatus',       label: 'Histórico de Status',       entity: 'AlteracaoStatus' },
  { key: 'notificacoes',          label: 'Notificações',              entity: 'Notificacao' },
  { key: 'preferenciasNotif',     label: 'Preferências de Notif.',    entity: 'PreferenciaNotificacao' },
  { key: 'configuracaoRelatorio', label: 'Config. de Relatórios',     entity: 'ConfiguracaoRelatorio' },
  { key: 'relatoriosGerados',     label: 'Relatórios Gerados',        entity: 'RelatorioGerado' },
  { key: 'companySettings',       label: 'Configurações da Empresa',  entity: 'CompanySettings' },
  { key: 'usuarios',              label: 'Usuários',                  entity: 'User' },
];

export default function BackupRestaurerPage() {
  const { isAdmin } = usePermissions();
  const [importFile, setImportFile] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importLog, setImportLog] = useState([]);
  const queryClient = useQueryClient();

  // Buscar contagens de todas as entidades
  const queries = ENTITIES.map(e => ({
    ...e,
    result: useQuery({
      queryKey: [e.key],
      queryFn: () => base44.entities[e.entity].list(),
      enabled: !!isAdmin,
    })
  }));

  const dataMap = {};
  queries.forEach(q => {
    dataMap[q.key] = q.result.data || [];
  });

  const totalRegistros = Object.values(dataMap).reduce((sum, arr) => sum + arr.length, 0);

  const handleExportBackup = async () => {
    setExporting(true);
    try {
      const backup = {
        version: '2.0',
        app: 'Casa do Ar',
        timestamp: new Date().toISOString(),
        metadata: {},
        data: {}
      };

      ENTITIES.forEach(e => {
        backup.data[e.key] = dataMap[e.key];
        backup.metadata[`total_${e.key}`] = dataMap[e.key].length;
      });

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

      toast.success(`Backup exportado! ${totalRegistros} registros salvos.`);
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
    setImportProgress(0);
    setImportLog([]);

    try {
      const text = await importFile.text();
      const backup = JSON.parse(text);

      if (!backup.data || !backup.version) {
        throw new Error('Formato de backup inválido');
      }

      const log = [];
      let totalImported = 0;
      let step = 0;

      // Suporte a backup v1.0 (legado) e v2.0
      const entityMap = backup.version === '1.0'
        ? [
            { key: 'clientes',        entity: 'Cliente' },
            { key: 'servicos',        entity: 'Servico' },
            { key: 'atendimentos',    entity: 'Atendimento' },
            { key: 'alteracaoStatus', entity: 'AlteracaoStatus' },
          ]
        : ENTITIES.filter(e => e.entity !== 'User'); // Usuários não são recriáveis

      for (const e of entityMap) {
        const records = backup.data[e.key];
        if (!records || records.length === 0) {
          log.push(`⚪ ${e.entity}: nenhum registro encontrado`);
          step++;
          setImportProgress(Math.round((step / entityMap.length) * 100));
          setImportLog([...log]);
          continue;
        }

        let count = 0;
        for (const record of records) {
          const { id, created_date, updated_date, created_by, ...data } = record;
          await base44.entities[e.entity].create(data);
          count++;
        }

        totalImported += count;
        log.push(`✅ ${e.entity}: ${count} registros importados`);
        step++;
        setImportProgress(Math.round((step / entityMap.length) * 100));
        setImportLog([...log]);
      }

      queryClient.invalidateQueries();
      toast.success(`Backup restaurado! ${totalImported} registros importados.`);
      setImportFile(null);
    } catch (error) {
      toast.error('Erro ao importar backup: ' + error.message);
    } finally {
      setImporting(false);
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
      <Card className="border-blue-800/40" style={{backgroundColor: '#243447'}}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Database className="w-5 h-5 text-blue-400" />
            Dados Atuais no Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {ENTITIES.filter(e => e.entity !== 'User').map(e => (
              <div key={e.key} className="rounded-xl p-3 border border-blue-800/30" style={{backgroundColor: 'rgba(30,64,175,0.15)'}}>
                <p className="text-xs text-blue-300/70">{e.label}</p>
                <p className="text-xl font-bold text-white">{dataMap[e.key]?.length ?? 0}</p>
              </div>
            ))}
            <div className="rounded-xl p-3 border border-yellow-700/30" style={{backgroundColor: 'rgba(245,158,11,0.1)'}}>
              <p className="text-xs text-yellow-300/70">Total Geral</p>
              <p className="text-xl font-bold text-yellow-300">{totalRegistros}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exportar */}
      <Card className="border-blue-800/40" style={{backgroundColor: '#243447'}}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Download className="w-5 h-5 text-blue-400" />
            Exportar Backup Completo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-blue-200/80 text-sm">
            Exporta <strong className="text-white">todos</strong> os dados do sistema em um arquivo JSON.
          </p>
          <div className="bg-blue-900/30 border border-blue-700/40 rounded-xl p-4 space-y-1">
            {ENTITIES.map(e => (
              <div key={e.key} className="flex justify-between text-sm text-blue-200">
                <span>{e.label}</span>
                <span className="font-bold text-white">{dataMap[e.key]?.length ?? 0} registros</span>
              </div>
            ))}
          </div>
          <Button
            onClick={handleExportBackup}
            disabled={exporting || totalRegistros === 0}
            className="w-full h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 font-semibold text-base"
          >
            {exporting ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Exportando...</>
            ) : (
              <><Download className="w-5 h-5 mr-2" />Exportar Backup Completo ({totalRegistros} registros)</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Importar */}
      <Card className="border-blue-800/40" style={{backgroundColor: '#243447'}}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Upload className="w-5 h-5 text-green-400" />
            Importar / Restaurar Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-200">
              <p className="font-medium">Atenção:</p>
              <p className="mt-1">A importação <strong>ADICIONA</strong> os dados do backup ao sistema sem remover os existentes. Compatível com backups v1.0 e v2.0.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Label className="text-blue-200 mb-2 block">Arquivo de Backup (.json)</Label>
              <Input
                type="file"
                accept=".json,application/json"
                onChange={(e) => { setImportFile(e.target.files?.[0] || null); setImportLog([]); setImportProgress(0); }}
                className="border-blue-800/50 text-white"
                style={{backgroundColor: 'rgba(30,64,175,0.15)'}}
              />
            </div>
            {importFile && (
              <div className="flex items-center gap-2 text-sm text-green-400 mt-6">
                <FileJson className="w-4 h-4" />
                <span className="truncate max-w-[140px]">{importFile.name}</span>
              </div>
            )}
          </div>

          {importing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-blue-200">
                <span>Importando...</span>
                <span>{importProgress}%</span>
              </div>
              <Progress value={importProgress} className="h-2" />
            </div>
          )}

          {importLog.length > 0 && (
            <div className="rounded-xl border border-blue-800/30 p-4 space-y-1 text-sm" style={{backgroundColor: 'rgba(15,25,35,0.6)'}}>
              {importLog.map((line, i) => (
                <p key={i} className="text-blue-100 font-mono">{line}</p>
              ))}
            </div>
          )}

          <Button
            onClick={handleImportBackup}
            disabled={!importFile || importing}
            className="w-full h-12 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 font-semibold text-base"
          >
            {importing ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Importando... {importProgress}%</>
            ) : (
              <><Upload className="w-5 h-5 mr-2" />Restaurar Backup</>
            )}
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-xs text-blue-400/60 justify-center pb-4">
        <Shield className="w-3 h-3" />
        <span>Backup v2.0 — inclui todas as entidades do sistema</span>
      </div>
    </div>
  );
}