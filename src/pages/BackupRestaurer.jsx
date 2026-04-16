import React, { useState, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Download, Upload, Database, Loader2, CheckCircle2, AlertCircle,
  FileJson, RefreshCw, Cloud, Trash2, ShieldCheck, BarChart3,
  ArrowUpFromLine, ArrowDownToLine, History, Play, AlertTriangle,
  X, ChevronRight, Info, HardDrive, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import NoPermission from '../components/NoPermission';
import { usePermissions } from '../components/auth/PermissionGuard';

// ─── Entidades exportáveis ───────────────────────────────────────────────────
const ENTIDADES = [
  { key: 'clientes',              entity: 'Cliente',                label: 'Clientes',                       icon: '👥', categoria: 'Clientes' },
  { key: 'servicos',              entity: 'Servico',                label: 'Serviços',                       icon: '🔧', categoria: 'Serviços' },
  { key: 'atendimentos',          entity: 'Atendimento',            label: 'Atendimentos',                   icon: '📋', categoria: 'Serviços' },
  { key: 'alteracaoStatus',       entity: 'AlteracaoStatus',        label: 'Histórico de Status',             icon: '📝', categoria: 'Serviços' },
  { key: 'agendamentos',          entity: 'Agendamento',            label: 'Agendamentos',                   icon: '📅', categoria: 'Serviços' },
  { key: 'equipes',               entity: 'Equipe',                 label: 'Equipes',                        icon: '👷', categoria: 'Configurações' },
  { key: 'tipoServicoValor',      entity: 'TipoServicoValor',       label: 'Tabela de Preços',                icon: '💲', categoria: 'Configurações' },
  { key: 'lancamentosFinanceiros',entity: 'LancamentoFinanceiro',   label: 'Lançamentos Financeiros',         icon: '💰', categoria: 'Financeiro' },
  { key: 'pagamentosClientes',    entity: 'PagamentoCliente',       label: 'Pagamentos dos Clientes',         icon: '💳', categoria: 'Financeiro' },
  { key: 'pagamentosTecnicos',    entity: 'PagamentoTecnico',       label: 'Pagamentos dos Técnicos',         icon: '💵', categoria: 'Financeiro' },
  { key: 'tecnicoFinanceiro',     entity: 'TecnicoFinanceiro',      label: 'Financeiro dos Técnicos',         icon: '📊', categoria: 'Financeiro' },
  { key: 'cheques',               entity: 'Cheque',                 label: 'Cheques',                        icon: '🏦', categoria: 'Financeiro' },
  { key: 'emprestimos',           entity: 'Emprestimo',             label: 'Empréstimos',                    icon: '🤝', categoria: 'Financeiro' },
  { key: 'manutencaoPreventiva',  entity: 'ManutencaoPreventiva',   label: 'Manutenções Preventivas',         icon: '🛡️', categoria: 'Preventivas' },
  { key: 'preventivasFuturas',    entity: 'PreventivaFutura',       label: 'Preventivas Futuras',             icon: '📆', categoria: 'Preventivas' },
  { key: 'notificacoes',          entity: 'Notificacao',            label: 'Notificações',                   icon: '🔔', categoria: 'Sistema' },
  { key: 'preferenciasNotif',     entity: 'PreferenciaNotificacao', label: 'Preferências de Notificação',     icon: '⚙️', categoria: 'Sistema' },
  { key: 'configuracaoRelat',     entity: 'ConfiguracaoRelatorio',  label: 'Config. de Relatórios',           icon: '📈', categoria: 'Sistema' },
  { key: 'relatoriosGerados',     entity: 'RelatorioGerado',        label: 'Relatórios Gerados',              icon: '📄', categoria: 'Sistema' },
  { key: 'usuarios',              entity: 'User',                   label: 'Usuários',                       icon: '🔑', categoria: 'Sistema' },
];

const CATEGORIAS = [...new Set(ENTIDADES.map(e => e.categoria))];

// Entidades que não podem ser restauradas automaticamente
const ENTIDADES_SOMENTE_LEITURA = ['User'];

const TABS = [
  { id: 'overview',  label: 'Visão Geral',    icon: BarChart3 },
  { id: 'export',    label: 'Exportar',        icon: ArrowUpFromLine },
  { id: 'import',    label: 'Importar',        icon: ArrowDownToLine },
  { id: 'cloud',     label: 'Backups na Nuvem',icon: Cloud },
];

function formatBytes(bytes) {
  if (!bytes) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(2) + ' MB';
}

function formatDateTime(dt) {
  if (!dt) return '-';
  try { return format(new Date(dt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); }
  catch { return dt; }
}

function ProgressBar({ value, label, current, total, color = 'blue' }) {
  const colors = {
    blue:  'from-blue-500 to-cyan-400',
    green: 'from-green-500 to-emerald-400',
    amber: 'from-amber-500 to-yellow-400',
  };
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-300 font-medium truncate pr-4">{label}</span>
        <span className="text-gray-400 shrink-0">{current} / {total}</span>
      </div>
      <div className="w-full bg-[#0d1826] rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-2.5 rounded-full bg-gradient-to-r ${colors[color]} transition-all duration-300`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 text-right">{Math.round(value)}%</p>
    </div>
  );
}

export default function BackupRestaurerPage() {
  const { isAdmin } = usePermissions();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  // ─── Tab state ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('overview');

  // ─── Export state ────────────────────────────────────────────────────────
  const [selectedEntidades, setSelectedEntidades] = useState(
    ENTIDADES.reduce((acc, e) => { acc[e.key] = true; return acc; }, {})
  );
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);
  const [exportResult, setExportResult] = useState(null);

  // ─── Import state ────────────────────────────────────────────────────────
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importMode, setImportMode] = useState('add'); // 'add' | 'replace'
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);

  // ─── Cloud state ─────────────────────────────────────────────────────────
  const [executandoBackup, setExecutandoBackup] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [limpando, setLimpando] = useState(false);
  const [diasRetencao, setDiasRetencao] = useState(7);

  // ─── Queries ─────────────────────────────────────────────────────────────
  const contagens = ENTIDADES.map(e =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useQuery({
      queryKey: [e.key + '-count'],
      queryFn: () => base44.entities[e.entity].list(),
      enabled: isAdmin,
      staleTime: 60_000,
    })
  );

  const { data: backupsNuvem = [], isLoading: loadingBackups, refetch: refetchBackups } = useQuery({
    queryKey: ['backups-incrementais'],
    queryFn: () => base44.entities.BackupIncremental.list('-data_backup', 50),
    enabled: isAdmin,
  });

  const counts = ENTIDADES.reduce((acc, e, i) => {
    acc[e.key] = contagens[i].data?.length ?? 0;
    return acc;
  }, {});

  const totalRegistros = Object.values(counts).reduce((a, b) => a + b, 0);
  const isLoadingCounts = contagens.some(q => q.isLoading);

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const entidadesSelecionadas = ENTIDADES.filter(e => selectedEntidades[e.key]);
  const entidadesParaImportar = ENTIDADES.filter(e => !ENTIDADES_SOMENTE_LEITURA.includes(e.entity));

  const toggleEntidade = (key) => setSelectedEntidades(prev => ({ ...prev, [key]: !prev[key] }));
  const selectAll = () => setSelectedEntidades(ENTIDADES.reduce((acc, e) => { acc[e.key] = true; return acc; }, {}));
  const deselectAll = () => setSelectedEntidades(ENTIDADES.reduce((acc, e) => { acc[e.key] = false; return acc; }, {}));

  // ─── Export ──────────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (entidadesSelecionadas.length === 0) {
      toast.error('Selecione ao menos uma entidade para exportar');
      return;
    }
    setExporting(true);
    setExportResult(null);
    setExportProgress(null);
    const dataObj = {};
    const metaObj = {};
    let totalExportado = 0;

    try {
      for (let i = 0; i < entidadesSelecionadas.length; i++) {
        const e = entidadesSelecionadas[i];
        setExportProgress({
          current: i + 1,
          total: entidadesSelecionadas.length,
          label: e.label,
          pct: ((i) / entidadesSelecionadas.length) * 100,
        });
        const records = await base44.entities[e.entity].list();
        dataObj[e.key] = records;
        metaObj[`total_${e.key}`] = records.length;
        totalExportado += records.length;
      }

      setExportProgress({ current: entidadesSelecionadas.length, total: entidadesSelecionadas.length, label: 'Finalizando...', pct: 100 });

      const backup = {
        version: '3.0',
        app: 'Casa do Ar Antigravity',
        exported_at: new Date().toISOString(),
        exported_by: 'admin',
        entidades_exportadas: entidadesSelecionadas.map(e => e.key),
        total_registros: totalExportado,
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

      setExportResult({ total: totalExportado, entidades: metaObj, arquivo: link.download });
      toast.success(`Backup exportado com sucesso! ${totalExportado} registros salvos.`);
    } catch (error) {
      toast.error('Erro ao exportar backup: ' + error.message);
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  };

  // ─── File handling ───────────────────────────────────────────────────────
  const processFile = useCallback(async (file) => {
    if (!file || !file.name.endsWith('.json')) {
      toast.error('Selecione um arquivo .json válido');
      return;
    }
    setImportFile(file);
    setImportResult(null);
    setImportPreview(null);
    setConfirmRestore(false);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      if (!backup.data || !backup.version) throw new Error('Formato de backup inválido');
      const preview = {};
      for (const e of entidadesParaImportar) {
        if (backup.data[e.key]) {
          preview[e.key] = { label: e.label, count: backup.data[e.key].length };
        }
      }
      setImportPreview({
        version: backup.version,
        app: backup.app,
        exported_at: backup.exported_at,
        total_registros: backup.total_registros || Object.values(backup.data).reduce((a, b) => a + (Array.isArray(b) ? b.length : 0), 0),
        entidades: preview,
        raw: backup,
      });
    } catch (err) {
      toast.error('Arquivo inválido: ' + err.message);
      setImportFile(null);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  // ─── Import ──────────────────────────────────────────────────────────────
  const executarImport = async () => {
    if (!importPreview) return;
    setImporting(true);
    setImportResult(null);
    setConfirmRestore(false);
    const backup = importPreview.raw;
    const result = {};
    let total = 0;

    try {
      const entidadesNoBackup = entidadesParaImportar.filter(
        e => backup.data[e.key] && backup.data[e.key].length > 0
      );

      for (let i = 0; i < entidadesNoBackup.length; i++) {
        const e = entidadesNoBackup[i];
        setImportProgress({
          current: i + 1,
          total: entidadesNoBackup.length,
          label: e.label,
          pct: (i / entidadesNoBackup.length) * 100,
        });

        const records = backup.data[e.key];

        // Remove campos internos
        const cleaned = records.map(({ id, created_date, updated_date, created_by, ...rest }) => rest);

        const BATCH = 50;
        let count = 0;
        for (let j = 0; j < cleaned.length; j += BATCH) {
          const batch = cleaned.slice(j, j + BATCH);
          await base44.entities[e.entity].bulkCreate(batch);
          count += batch.length;
        }
        result[e.label] = count;
        total += count;
      }

      setImportProgress({ current: entidadesNoBackup.length, total: entidadesNoBackup.length, label: 'Concluído!', pct: 100 });
      queryClient.invalidateQueries();
      setImportResult({ success: true, details: result, total });
      toast.success(`Backup restaurado! ${total} registros importados com sucesso.`);
    } catch (error) {
      setImportResult({ success: false, error: error.message });
      toast.error('Erro ao importar backup: ' + error.message);
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  };

  // ─── Cloud backup ─────────────────────────────────────────────────────────
  const executarBackupManual = async () => {
    setExecutandoBackup(true);
    try {
      const response = await base44.functions.invoke('backupIncrementalDiario');
      if (response.data.status === 'success') {
        toast.success(`Backup executado! ${response.data.total_registros || 0} registros salvos.`);
        refetchBackups();
      } else if (response.data.status === 'skipped') {
        toast.info('Nenhuma alteração detectada nas últimas 24h');
      } else {
        toast.error(response.data.message || 'Erro ao executar backup');
      }
    } catch (error) {
      toast.error('Erro ao executar backup: ' + error.message);
    } finally {
      setExecutandoBackup(false);
    }
  };

  const handleRestoreFromCloud = async (backupRecord) => {
    if (!backupRecord?.arquivo_drive_url) {
      toast.error('Backup inválido ou sem URL disponível');
      return;
    }
    setRestoringId(backupRecord.id);
    try {
      toast.info('Baixando backup da nuvem...');
      const response = await fetch(backupRecord.arquivo_drive_url);
      if (!response.ok) throw new Error('Falha ao baixar o arquivo da nuvem');
      const text = await response.text();
      const backup = JSON.parse(text);
      if (!backup.data) throw new Error('Formato de backup inválido');

      // Usa o mesmo fluxo de import
      setActiveTab('import');
      await processFile(new File([text], `nuvem_${backupRecord.id}.json`, { type: 'application/json' }));
      toast.success('Backup da nuvem carregado! Revise e confirme a restauração na aba Importar.');
    } catch (error) {
      toast.error('Erro ao carregar backup da nuvem: ' + error.message);
    } finally {
      setRestoringId(null);
    }
  };

  const handleLimparBackups = async () => {
    if (!window.confirm(`Remover todos os backups com mais de ${diasRetencao} dias do Google Drive?\n\nEsta ação não pode ser desfeita.`)) return;
    setLimpando(true);
    try {
      const response = await base44.functions.invoke('limparBackupsAntigos', { dias_retencao: diasRetencao });
      if (response.data.status === 'success') {
        toast.success(`${response.data.total_removidos} backup(s) removido(s) com sucesso!`);
        refetchBackups();
      } else {
        toast.error(response.data.message || 'Erro ao limpar backups');
      }
    } catch (error) {
      toast.error('Erro ao limpar backups: ' + error.message);
    } finally {
      setLimpando(false);
    }
  };

  if (!isAdmin) return <NoPermission />;

  // ─── Stats para overview ──────────────────────────────────────────────────
  const backupsSucesso = backupsNuvem.filter(b => b.status === 'sucesso').length;
  const ultimoBackup = backupsNuvem[0];
  const tamanhoTotal = backupsNuvem.reduce((s, b) => s + (b.tamanho_bytes || 0), 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-100 flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-blue-400" />
            Central de Backup
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Exporte, importe e gerencie backups completos do sistema com segurança
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isLoadingCounts && <Loader2 className="w-5 h-5 animate-spin text-blue-400" />}
          <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-sm px-3 py-1">
            {totalRegistros.toLocaleString('pt-BR')} registros
          </Badge>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-[#0d1826] p-1 rounded-xl border border-white/5">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all flex-1 justify-center
                ${activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB: VISÃO GERAL
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-5">

          {/* Status cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total de Registros', value: totalRegistros.toLocaleString('pt-BR'), icon: Database, color: 'blue' },
              { label: 'Backups na Nuvem', value: backupsSucesso, icon: Cloud, color: 'purple' },
              { label: 'Tamanho Armazenado', value: formatBytes(tamanhoTotal), icon: HardDrive, color: 'emerald' },
              { label: 'Último Backup', value: ultimoBackup ? format(new Date(ultimoBackup.data_backup), 'dd/MM HH:mm') : '—', icon: Clock, color: 'amber' },
            ].map(({ label, value, icon: Icon, color }) => {
              const colorMap = {
                blue:    { bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    text: 'text-blue-400',    icon: 'text-blue-500'    },
                purple:  { bg: 'bg-purple-500/10',  border: 'border-purple-500/20',  text: 'text-purple-400',  icon: 'text-purple-500'  },
                emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', icon: 'text-emerald-500' },
                amber:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   text: 'text-amber-400',   icon: 'text-amber-500'   },
              }[color];
              return (
                <div key={label} className={`rounded-2xl p-4 border ${colorMap.bg} ${colorMap.border}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{label}</p>
                    <Icon className={`w-4 h-4 ${colorMap.icon}`} />
                  </div>
                  <p className={`text-2xl font-bold ${colorMap.text}`}>{value}</p>
                </div>
              );
            })}
          </div>

          {/* Entidades por categoria */}
          {CATEGORIAS.map(cat => {
            const ents = ENTIDADES.filter(e => e.categoria === cat);
            return (
              <Card key={cat} className="bg-[#152236] border-white/5 rounded-2xl">
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm font-bold text-gray-300 uppercase tracking-wider">{cat}</CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {ents.map(e => (
                      <div key={e.key} className="flex items-center justify-between bg-[#0d1826] rounded-xl px-3 py-2.5 border border-white/5">
                        <span className="text-sm text-gray-300 truncate mr-2">
                          <span className="mr-1.5">{e.icon}</span>
                          {e.label}
                        </span>
                        {contagens[ENTIDADES.indexOf(e)].isLoading
                          ? <Loader2 className="w-3 h-3 animate-spin text-gray-500" />
                          : <span className="text-sm font-bold text-blue-400 shrink-0">{counts[e.key]}</span>
                        }
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Quick actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => setActiveTab('export')}
              className="flex items-center gap-3 p-4 rounded-2xl bg-blue-600/10 border border-blue-500/20 hover:bg-blue-600/20 transition-colors text-left group"
            >
              <ArrowUpFromLine className="w-8 h-8 text-blue-400 shrink-0" />
              <div>
                <p className="font-semibold text-blue-300">Exportar Backup</p>
                <p className="text-xs text-gray-400">Salvar arquivo JSON</p>
              </div>
              <ChevronRight className="w-4 h-4 text-blue-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-600/10 border border-emerald-500/20 hover:bg-emerald-600/20 transition-colors text-left group"
            >
              <ArrowDownToLine className="w-8 h-8 text-emerald-400 shrink-0" />
              <div>
                <p className="font-semibold text-emerald-300">Restaurar Backup</p>
                <p className="text-xs text-gray-400">Importar arquivo JSON</p>
              </div>
              <ChevronRight className="w-4 h-4 text-emerald-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <button
              onClick={() => setActiveTab('cloud')}
              className="flex items-center gap-3 p-4 rounded-2xl bg-purple-600/10 border border-purple-500/20 hover:bg-purple-600/20 transition-colors text-left group"
            >
              <Cloud className="w-8 h-8 text-purple-400 shrink-0" />
              <div>
                <p className="font-semibold text-purple-300">Backups na Nuvem</p>
                <p className="text-xs text-gray-400">Google Drive</p>
              </div>
              <ChevronRight className="w-4 h-4 text-purple-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: EXPORTAR
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'export' && (
        <div className="space-y-5">

          {/* Seleção de entidades */}
          <Card className="bg-[#152236] border-white/5 rounded-2xl">
            <CardHeader className="pb-2 pt-5 px-5 border-b border-white/5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-gray-200 flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-400" />
                  Selecionar Dados para Exportar
                </CardTitle>
                <div className="flex gap-2">
                  <button onClick={selectAll} className="text-xs text-blue-400 hover:text-blue-300 font-medium">Todos</button>
                  <span className="text-gray-600">|</span>
                  <button onClick={deselectAll} className="text-xs text-gray-400 hover:text-gray-300 font-medium">Nenhum</button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-5 py-4 space-y-4">
              {CATEGORIAS.map(cat => {
                const ents = ENTIDADES.filter(e => e.categoria === cat);
                return (
                  <div key={cat}>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{cat}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {ents.map(e => (
                        <label
                          key={e.key}
                          className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl cursor-pointer border transition-all
                            ${selectedEntidades[e.key]
                              ? 'bg-blue-500/10 border-blue-500/30'
                              : 'bg-[#0d1826] border-white/5 hover:border-white/10'}`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!selectedEntidades[e.key]}
                              onChange={() => toggleEntidade(e.key)}
                              className="rounded accent-blue-500"
                            />
                            <span className="text-sm text-gray-300">
                              <span className="mr-1.5">{e.icon}</span>
                              {e.label}
                            </span>
                          </div>
                          <span className={`text-xs font-bold shrink-0 ${selectedEntidades[e.key] ? 'text-blue-400' : 'text-gray-500'}`}>
                            {counts[e.key]}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Resumo + botão exportar */}
          <Card className="bg-[#152236] border-white/5 rounded-2xl">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">
                    <span className="font-bold text-white">{entidadesSelecionadas.length}</span> de {ENTIDADES.length} entidades selecionadas
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {entidadesSelecionadas.reduce((acc, e) => acc + counts[e.key], 0).toLocaleString('pt-BR')} registros serão exportados
                  </p>
                </div>
                <FileJson className="w-8 h-8 text-blue-400" />
              </div>

              {/* Progresso */}
              {exporting && exportProgress && (
                <ProgressBar
                  value={exportProgress.pct}
                  label={`Exportando: ${exportProgress.label}`}
                  current={exportProgress.current}
                  total={exportProgress.total}
                  color="blue"
                />
              )}

              {/* Resultado */}
              {exportResult && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Backup exportado com sucesso!
                  </div>
                  <p className="text-xs text-gray-400">{exportResult.total.toLocaleString('pt-BR')} registros salvos em <code className="text-blue-300">{exportResult.arquivo}</code></p>
                </div>
              )}

              <Button
                onClick={handleExport}
                disabled={exporting || entidadesSelecionadas.length === 0}
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 font-bold text-base shadow-lg"
              >
                {exporting
                  ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Exportando...</>
                  : <><Download className="w-5 h-5 mr-2" />Baixar Backup JSON</>}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: IMPORTAR
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'import' && (
        <div className="space-y-5">

          {/* Aviso */}
          <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-amber-300">Leia antes de restaurar</p>
              <p className="text-amber-200/70 mt-1">
                A importação <strong>adiciona</strong> os registros do backup ao banco atual. Registros existentes não são removidos — apenas novos são criados.
                Usuários não são importados automaticamente (requerem convite manual).
              </p>
            </div>
          </div>

          {/* Drop zone */}
          {!importFile && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all
                ${dragOver
                  ? 'border-blue-400 bg-blue-500/10'
                  : 'border-white/10 bg-[#0d1826] hover:border-white/20 hover:bg-[#111f30]'}`}
            >
              <Upload className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-300 font-semibold text-lg">Arraste o arquivo aqui</p>
              <p className="text-gray-500 text-sm mt-1">ou clique para selecionar</p>
              <p className="text-gray-600 text-xs mt-3">Apenas arquivos .json gerados por este sistema</p>
              <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleFileChange} className="hidden" />
            </div>
          )}

          {/* Preview do arquivo */}
          {importFile && importPreview && !importResult && (
            <Card className="bg-[#152236] border-white/5 rounded-2xl">
              <CardHeader className="pb-3 pt-5 px-5 border-b border-white/5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold text-gray-200 flex items-center gap-2">
                    <FileJson className="w-4 h-4 text-blue-400" />
                    {importFile.name}
                  </CardTitle>
                  <button onClick={() => { setImportFile(null); setImportPreview(null); setConfirmRestore(false); }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="px-5 py-4 space-y-4">

                {/* Metadados */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Versão',    value: importPreview.version },
                    { label: 'Total',     value: (importPreview.total_registros || 0).toLocaleString('pt-BR') + ' registros' },
                    { label: 'Gerado em', value: importPreview.exported_at ? format(new Date(importPreview.exported_at), 'dd/MM/yyyy HH:mm') : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-[#0d1826] rounded-xl px-3 py-2 border border-white/5">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="text-sm font-semibold text-gray-200">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Entidades encontradas */}
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Entidades no backup</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(importPreview.entidades).map(([key, { label, count }]) => (
                      <div key={key} className="flex items-center justify-between bg-emerald-500/5 border border-emerald-500/15 rounded-xl px-3 py-2">
                        <span className="text-sm text-gray-300 truncate mr-2">{label}</span>
                        <span className="text-sm font-bold text-emerald-400 shrink-0">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Progresso */}
                {importing && importProgress && (
                  <ProgressBar
                    value={importProgress.pct}
                    label={`Importando: ${importProgress.label}`}
                    current={importProgress.current}
                    total={importProgress.total}
                    color="green"
                  />
                )}

                {/* Confirmação */}
                {!confirmRestore && !importing && (
                  <Button
                    onClick={() => setConfirmRestore(true)}
                    className="w-full h-12 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 font-bold text-base shadow-lg"
                  >
                    <Upload className="w-5 h-5 mr-2" />
                    Restaurar Backup
                  </Button>
                )}

                {/* Tela de confirmação */}
                {confirmRestore && !importing && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-red-400 font-bold">
                      <AlertCircle className="w-5 h-5" />
                      Confirmar Restauração
                    </div>
                    <p className="text-sm text-gray-300">
                      Você está prestes a importar <strong className="text-white">{importPreview.total_registros?.toLocaleString('pt-BR')}</strong> registros.
                      Esta operação não pode ser desfeita automaticamente.
                    </p>
                    <p className="text-xs text-gray-500">Recomendamos exportar o backup atual antes de continuar.</p>
                    <div className="flex gap-3">
                      <Button
                        onClick={executarImport}
                        className="flex-1 bg-red-600 hover:bg-red-700 font-bold"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Confirmar Importação
                      </Button>
                      <Button
                        onClick={() => setConfirmRestore(false)}
                        variant="outline"
                        className="border-white/10 text-gray-300 hover:bg-white/5"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Resultado da importação */}
          {importResult && (
            <Card className="bg-[#152236] border-white/5 rounded-2xl">
              <CardContent className="p-5 space-y-4">
                {importResult.success ? (
                  <>
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-lg">
                      <CheckCircle2 className="w-6 h-6" />
                      Restauração concluída com sucesso!
                    </div>
                    <p className="text-sm text-gray-400">{importResult.total.toLocaleString('pt-BR')} registros importados</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(importResult.details).map(([label, count]) => (
                        <div key={label} className="flex items-center justify-between bg-emerald-500/5 border border-emerald-500/15 rounded-xl px-3 py-2">
                          <span className="text-sm text-gray-300 truncate mr-2">{label}</span>
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-0">{count}</Badge>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex items-start gap-3 text-red-400">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Erro na importação</p>
                      <p className="text-sm text-gray-400 mt-1">{importResult.error}</p>
                    </div>
                  </div>
                )}
                <Button
                  variant="outline"
                  onClick={() => { setImportFile(null); setImportPreview(null); setImportResult(null); setConfirmRestore(false); }}
                  className="border-white/10 text-gray-300 hover:bg-white/5"
                >
                  Novo Arquivo
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB: BACKUPS NA NUVEM
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'cloud' && (
        <div className="space-y-5">

          {/* Ações */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="bg-[#152236] border-white/5 rounded-2xl">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-blue-400" />
                  <p className="font-semibold text-gray-200">Backup Incremental Manual</p>
                </div>
                <p className="text-sm text-gray-400">Cria um backup das alterações das últimas 24h e salva no Google Drive.</p>
                <Button
                  onClick={executarBackupManual}
                  disabled={executandoBackup}
                  className="w-full bg-blue-600 hover:bg-blue-700 font-semibold"
                >
                  {executandoBackup
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Executando...</>
                    : <><Play className="w-4 h-4 mr-2" />Executar Backup Agora</>}
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-[#152236] border-red-900/30 rounded-2xl">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-red-400" />
                  <p className="font-semibold text-gray-200">Limpeza de Backups Antigos</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm text-gray-400">Remover backups com mais de</p>
                  <input
                    type="number" min="1" max="90" value={diasRetencao}
                    onChange={(e) => setDiasRetencao(parseInt(e.target.value) || 7)}
                    className="w-16 px-2 py-1 text-center rounded-lg bg-[#0d1826] border border-white/10 text-white text-sm"
                  />
                  <p className="text-sm text-gray-400">dias</p>
                </div>
                <Button
                  onClick={handleLimparBackups}
                  disabled={limpando}
                  variant="outline"
                  className="w-full border-red-700/50 text-red-400 hover:bg-red-500/10 font-semibold"
                >
                  {limpando
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Limpando...</>
                    : <><Trash2 className="w-4 h-4 mr-2" />Limpar Backups Antigos</>}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Lista de backups */}
          <Card className="bg-[#152236] border-white/5 rounded-2xl">
            <CardHeader className="pb-3 pt-5 px-5 border-b border-white/5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-gray-200 flex items-center gap-2">
                  <History className="w-4 h-4 text-purple-400" />
                  Histórico de Backups na Nuvem
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => refetchBackups()}
                  className="text-gray-400 hover:text-white hover:bg-white/5">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingBackups ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                </div>
              ) : backupsNuvem.length === 0 ? (
                <div className="text-center py-12">
                  <Cloud className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">Nenhum backup na nuvem</p>
                  <p className="text-gray-600 text-sm mt-1">Execute um backup manual para começar</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {backupsNuvem.map((backup) => (
                    <div key={backup.id} className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors gap-3">
                      <div className="flex items-center gap-4">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${backup.status === 'sucesso' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        <div>
                          <p className="text-sm font-semibold text-gray-200">{formatDateTime(backup.data_backup)}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-gray-500">{backup.total_registros || 0} registros</span>
                            <span className="text-xs text-gray-500">•</span>
                            <span className="text-xs text-gray-500">{formatBytes(backup.tamanho_bytes)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-6 sm:ml-0">
                        <Badge className={
                          backup.tipo === 'completo'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        }>
                          {backup.tipo === 'completo' ? 'Completo' : 'Incremental'}
                        </Badge>
                        <Badge className={
                          backup.status === 'sucesso'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }>
                          {backup.status === 'sucesso' ? 'Sucesso' : backup.status}
                        </Badge>
                        {backup.status === 'sucesso' && backup.arquivo_drive_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!!restoringId}
                            onClick={() => handleRestoreFromCloud(backup)}
                            className="border-emerald-700/50 text-emerald-400 hover:bg-emerald-500/10 text-xs font-semibold"
                          >
                            {restoringId === backup.id
                              ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Carregando...</>
                              : <><ArrowDownToLine className="w-3 h-3 mr-1" />Restaurar</>}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-start gap-2 text-xs text-gray-500">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <p>Ao clicar em "Restaurar", o backup é carregado na aba Importar onde você pode revisar os dados antes de confirmar a restauração.</p>
          </div>
        </div>
      )}

    </div>
  );
}
