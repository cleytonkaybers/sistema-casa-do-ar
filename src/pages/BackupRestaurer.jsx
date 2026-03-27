import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Download, Upload, Database, Loader2, CheckCircle, AlertCircle, FileJson, RefreshCw, Cloud, FileText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import NoPermission from '../components/NoPermission';
import { usePermissions } from '../components/auth/PermissionGuard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '@/lib/utils/formatters';

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
  { key: 'pagamentosClientes',   entity: 'PagamentoCliente',       label: 'Pagamentos dos Clientes' },
  { key: 'pagamentosTecnicos',   entity: 'PagamentoTecnico',       label: 'Pagamentos dos Técnicos' },
  { key: 'lancamentosFinanceiros', entity: 'LancamentoFinanceiro',  label: 'Lançamentos Financeiros' },
  { key: 'tecnicoFinanceiro',    entity: 'TecnicoFinanceiro',      label: 'Técnico Financeiro' },
  { key: 'tipoServicoValor',     entity: 'TipoServicoValor',       label: 'Tipos de Serviço e Valores' },
  { key: 'usuarios',             entity: 'User',                   label: 'Usuários' },
];

export default function BackupRestaurerPage() {
  const { isAdmin } = usePermissions();
  const [importFile, setImportFile] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null); // { current, total, label }
  const [importResult, setImportResult] = useState(null);
  const [selectedBackupId, setSelectedBackupId] = useState(null);
  const [restoringFromDrive, setRestoringFromDrive] = useState(false);
  const [limpando, setLimpando] = useState(false);
  const [diasRetencao, setDiasRetencao] = useState(7);
  const queryClient = useQueryClient();

  // Buscar backups do Google Drive
  const { data: backups = [] } = useQuery({
    queryKey: ['backups-drive'],
    queryFn: () => base44.entities.BackupIncremental.list('-data_backup', 20),
    enabled: isAdmin,
  });

  // Verificar se veio de um link direto
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const backupId = urlParams.get('backup_id');
    if (backupId) {
      setSelectedBackupId(backupId);
    }
  }, []);

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

  const handleLimparBackups = async () => {
    if (!window.confirm(`Remover todos os backups com mais de ${diasRetencao} dias?\n\nEsta ação não pode ser desfeita.`)) {
      return;
    }

    setLimpando(true);
    try {
      const response = await base44.functions.invoke('limparBackupsAntigos', { dias_retencao: diasRetencao });
      
      if (response.data.status === 'success') {
        toast.success(
          `${response.data.total_removidos} backup(s) removido(s) com sucesso!`
        );
        // Recarregar lista de backups
        setLoadingBackups(true);
        setTimeout(() => setLoadingBackups(false), 1000);
      } else {
        toast.error(response.data.message || 'Erro ao limpar backups');
      }
    } catch (error) {
      toast.error('Erro ao limpar backups: ' + error.message);
    } finally {
      setLimpando(false);
    }
  };

  const handleExportTxt = async () => {
    setExporting(true);
    try {
      // Entidades críticas para backup em TXT
      const entidadesCriticas = [
        { key: 'manutencaoPreventiva', entity: 'ManutencaoPreventiva', label: 'Futuras Preventivas' },
        { key: 'lancamentosFinanceiros', entity: 'LancamentoFinanceiro', label: 'Financeiro' },
        { key: 'pagamentosClientes', entity: 'PagamentoCliente', label: 'Pagamento de Clientes' },
      ];

      let txtContent = `BACKUP CRÍTICO - CASA DO AR\n`;
      txtContent += `Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}\n`;
      txtContent += `${'='.repeat(80)}\n\n`;

      let totalRecs = 0;

      // Exportar cada entidade crítica
      for (const e of entidadesCriticas) {
        const records = await base44.entities[e.entity].list();
        totalRecs += records.length;

        txtContent += `\n${e.label.toUpperCase()} (${records.length} registros)\n`;
        txtContent += `${'-'.repeat(80)}\n`;

        if (records.length === 0) {
          txtContent += 'Nenhum registro encontrado.\n';
          continue;
        }

        // Cabeçalho com campos
        const keys = Object.keys(records[0]).filter(k => !['id', 'created_by', 'created_date', 'updated_date'].includes(k));
        txtContent += keys.join(' | ') + '\n';
        txtContent += `${'-'.repeat(80)}\n`;

        // Dados
        records.forEach(rec => {
          const row = keys.map(k => {
            let val = rec[k];
            if (typeof val === 'object' && val !== null) {
              val = JSON.stringify(val).substring(0, 30);
            }
            if (val === null || val === undefined) val = '-';
            return String(val).substring(0, 40).replace(/\n/g, ' ');
          }).join(' | ');
          txtContent += row + '\n';
        });

        txtContent += '\n';
      }

      txtContent += `\n${'='.repeat(80)}\n`;
      txtContent += `TOTAL DE REGISTROS: ${totalRecs}\n`;
      txtContent += `Arquivo de backup para recuperação de dados críticos.\n`;

      // Exportar como TXT
      const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_critico_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Backup TXT crítico exportado com ${totalRecs} registros!`);
    } catch (error) {
      toast.error('Erro ao exportar TXT: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  const handleRestoreFromDrive = async (backupRecord) => {
    if (!backupRecord?.arquivo_drive_id) {
      toast.error('Backup inválido');
      return;
    }

    setRestoringFromDrive(true);
    setImportResult(null);
    const result = {};

    try {
      toast.info('Baixando backup do Google Drive...');
      
      // Buscar arquivo do Drive via backend
      const response = await fetch(backupRecord.arquivo_drive_url);
      if (!response.ok) throw new Error('Erro ao baixar backup do Drive');
      
      const text = await response.text();
      const backup = JSON.parse(text);

      if (!backup.data) {
        throw new Error('Formato de backup inválido');
      }

      const entidadesParaImportar = ENTIDADES.filter(
       e => e.entity !== 'User' && e.entity !== 'PagamentoCliente' && e.entity !== 'PagamentoTecnico' && e.entity !== 'LancamentoFinanceiro' && e.entity !== 'TecnicoFinanceiro'
      );

      toast.info('Iniciando restauração...');

      for (let i = 0; i < entidadesParaImportar.length; i++) {
        const e = entidadesParaImportar[i];
        setImportProgress({ current: i + 1, total: entidadesParaImportar.length, label: e.label });

        const records = backup.data[e.key];
        if (!records || records.length === 0) {
          result[e.label] = 0;
          continue;
        }

        const cleaned = records.map(({ id, created_date, updated_date, created_by, ...rest }) => rest);

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
      setSelectedBackupId(null);

      const total = Object.values(result).reduce((a, b) => a + b, 0);
      toast.success(`Backup restaurado com sucesso! ${total} registros importados.`);
    } catch (error) {
      toast.error('Erro ao restaurar backup: ' + error.message);
    } finally {
      setRestoringFromDrive(false);
      setImportProgress(null);
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
       e => e.entity !== 'User' && e.entity !== 'PagamentoCliente' && e.entity !== 'PagamentoTecnico' && e.entity !== 'LancamentoFinanceiro' && e.entity !== 'TecnicoFinanceiro'
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              onClick={handleExportBackup}
              disabled={exporting}
              className="h-12 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 font-semibold"
            >
              {exporting ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Exportando...</>
              ) : (
                <><Download className="w-5 h-5 mr-2" />JSON ({totalRegistros} registros)</>
              )}
            </Button>
            <Button
              onClick={handleExportTxt}
              disabled={exporting}
              className="h-12 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 font-semibold"
            >
              {exporting ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Exportando...</>
              ) : (
                <><FileText className="w-5 h-5 mr-2" />BACKUP CRÍTICO (TXT)</>
              )}
            </Button>
          </div>
          </CardContent>
          </Card>

          {/* Limpeza de Backups Antigos */}
          <Card className="border border-red-800/40" style={{backgroundColor: '#243447'}}>
          <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Trash2 className="w-5 h-5 text-red-400" />
            Limpeza de Backups Antigos
          </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
          <p className="text-blue-300/80">
            Remove automaticamente backups antigos do Google Drive para economizar espaço de armazenamento.
          </p>
          <div className="bg-red-900/20 border border-red-700/40 rounded-lg p-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-red-200 mb-2">
                  Remover backups com mais de:
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={diasRetencao}
                    onChange={(e) => setDiasRetencao(parseInt(e.target.value) || 7)}
                    className="w-20 px-3 py-2 border border-red-700/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    style={{backgroundColor: 'rgba(30,64,175,0.2)'}}
                  />
                  <span className="text-red-200 font-medium">dias</span>
                </div>
              </div>
              <Button
                onClick={handleLimparBackups}
                disabled={limpando}
                className="h-12 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 font-semibold whitespace-nowrap"
              >
                {limpando ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Limpando...</>
                ) : (
                  <><Trash2 className="w-5 h-5 mr-2" />LIMPAR</>
                )}
              </Button>
            </div>
            <p className="text-xs text-red-300/70 mt-3">
              ⚠️ Esta ação removerá permanentemente os arquivos do Google Drive. Use com cuidado.
            </p>
          </div>
          </CardContent>
          </Card>

          {/* Restaurar do Google Drive */}
      <Card className="border border-blue-800/40" style={{backgroundColor: '#243447'}}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Cloud className="w-5 h-5 text-blue-400" />
            Restaurar do Google Drive
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-blue-300/80">
            Selecione um backup automático do Google Drive para restaurar.
          </p>
          
          {backups.length === 0 ? (
            <div className="text-center py-8 text-blue-300/60">
              Nenhum backup disponível no Google Drive
            </div>
          ) : (
            <div className="border border-blue-800/40 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow style={{ backgroundColor: '#1e3a8a' }}>
                    <TableHead className="text-white">Data</TableHead>
                    <TableHead className="text-white">Registros</TableHead>
                    <TableHead className="text-white">Status</TableHead>
                    <TableHead className="text-white">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.filter(b => b.status === 'sucesso').map((backup) => (
                    <TableRow 
                      key={backup.id}
                      className={selectedBackupId === backup.id ? 'bg-blue-900/40' : 'hover:bg-blue-900/20'}
                    >
                      <TableCell className="text-blue-200">
                        {formatDateTime(backup.data_backup)}
                      </TableCell>
                      <TableCell className="text-blue-200">
                        {backup.total_registros || 0}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-700">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Sucesso
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => handleRestoreFromDrive(backup)}
                          disabled={restoringFromDrive}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {restoringFromDrive ? (
                            <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Restaurando...</>
                          ) : (
                            <><RefreshCw className="w-4 h-4 mr-1" />Restaurar</>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Progresso da restauração do Drive */}
          {restoringFromDrive && importProgress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-blue-200">
                <span>Restaurando: <strong>{importProgress.label}</strong></span>
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
        </CardContent>
      </Card>

      {/* Importar Arquivo Local */}
      <Card className="border border-blue-800/40" style={{backgroundColor: '#243447'}}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Upload className="w-5 h-5 text-green-400" />
            Importar Arquivo Local
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