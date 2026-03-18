import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Database, Download, Calendar, CheckCircle2, AlertTriangle, Play, ExternalLink, RotateCcw } from 'lucide-react';
import { formatDateTime } from '@/lib/utils/formatters';
import { TableSkeleton, CardSkeleton } from '@/components/LoadingSkeleton';
import { showToast, toastMessages } from '@/lib/utils/toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { usePermissions } from '@/components/auth/PermissionGuard';
import NoPermission from '@/components/NoPermission';
import { useNavigate } from 'react-router-dom';

export default function GerenciarBackups() {
  const { isAdmin } = usePermissions();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [executandoBackup, setExecutandoBackup] = useState(false);
  const [confirmManual, setConfirmManual] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [restaurando, setRestaurando] = useState(false);

  const { data: backups = [], isLoading } = useQuery({
    queryKey: ['backups-incrementais'],
    queryFn: () => base44.entities.BackupIncremental.list('-data_backup', 50),
  });

  const executarBackupManual = async () => {
    setExecutandoBackup(true);
    try {
      const response = await base44.functions.invoke('backupIncrementalDiario');
      
      if (response.data.status === 'success') {
        showToast.success('Backup incremental realizado com sucesso!');
        queryClient.invalidateQueries({ queryKey: ['backups-incrementais'] });
      } else if (response.data.status === 'skipped') {
        showToast.info('Nenhuma alteração detectada nas últimas 24h');
      }
    } catch (error) {
      showToast.error('Erro ao executar backup');
    } finally {
      setExecutandoBackup(false);
      setConfirmManual(false);
    }
  };

  const handleRestaurar = (backup) => {
    setSelectedBackup(backup);
    setConfirmRestore(true);
  };

  const executarRestauracao = async () => {
    if (!selectedBackup?.arquivo_drive_id) {
      showToast.error('Backup inválido para restauração');
      return;
    }

    setRestaurando(true);
    try {
      showToast.info('Baixando backup do Google Drive...');
      
      // Navegar para página de restauração com o ID do backup
      navigate(`/BackupRestaurer?backup_id=${selectedBackup.id}`);
    } catch (error) {
      showToast.error('Erro ao iniciar restauração');
    } finally {
      setRestaurando(false);
      setConfirmRestore(false);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  };

  if (!isAdmin) return <NoPermission />;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <CardSkeleton count={1} />
        <TableSkeleton rows={10} />
      </div>
    );
  }

  // Estatísticas
  const totalBackups = backups.length;
  const backupsSucesso = backups.filter(b => b.status === 'sucesso').length;
  const ultimoBackup = backups[0];
  const tamanhoTotal = backups.reduce((sum, b) => sum + (b.tamanho_bytes || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <Database className="w-8 h-8 text-blue-600" />
            Gerenciar Backups
          </h1>
          <p className="text-gray-500 mt-1">Backups incrementais automáticos e manuais</p>
        </div>
        <Button
          onClick={() => setConfirmManual(true)}
          disabled={executandoBackup}
          className="bg-blue-600 hover:bg-blue-700 gap-2"
        >
          <Play className="w-4 h-4" />
          {executandoBackup ? 'Executando...' : 'Executar Backup Manual'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total de Backups</p>
                <p className="text-2xl font-bold text-blue-600">{totalBackups}</p>
              </div>
              <Database className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Bem-sucedidos</p>
                <p className="text-2xl font-bold text-green-600">{backupsSucesso}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Tamanho Total</p>
                <p className="text-2xl font-bold text-purple-600">{formatBytes(tamanhoTotal)}</p>
              </div>
              <Download className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Último Backup</p>
                <p className="text-sm font-bold text-amber-600">
                  {ultimoBackup ? formatDateTime(ultimoBackup.data_backup).split(' ')[0] : '-'}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-amber-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Backups */}
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle>Histórico de Backups</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow style={{ backgroundColor: '#1e3a8a' }}>
                <TableHead className="text-white">Data/Hora</TableHead>
                <TableHead className="text-white">Tipo</TableHead>
                <TableHead className="text-white">Registros</TableHead>
                <TableHead className="text-white">Tamanho</TableHead>
                <TableHead className="text-white">Status</TableHead>
                <TableHead className="text-white">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-gray-500">
                    Nenhum backup registrado
                  </TableCell>
                </TableRow>
              ) : (
                backups.map((backup) => (
                  <TableRow key={backup.id} className="hover:bg-gray-50">
                    <TableCell className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      {formatDateTime(backup.data_backup)}
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        backup.tipo === 'completo' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }>
                        {backup.tipo === 'completo' ? 'Completo' : 'Incremental'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{backup.total_registros || 0}</TableCell>
                    <TableCell className="text-sm text-gray-600">{formatBytes(backup.tamanho_bytes)}</TableCell>
                    <TableCell>
                      {backup.status === 'sucesso' ? (
                        <Badge className="bg-green-100 text-green-700 flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3" />
                          Sucesso
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700 flex items-center gap-1 w-fit">
                          <AlertTriangle className="w-3 h-3" />
                          {backup.status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {backup.arquivo_drive_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(backup.arquivo_drive_url, '_blank')}
                            className="gap-2"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Ver no Drive
                          </Button>
                        )}
                        {backup.status === 'sucesso' && backup.arquivo_drive_id && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestaurar(backup)}
                            className="gap-2 border-green-300 text-green-700 hover:bg-green-50"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Restaurar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmManual}
        onClose={() => setConfirmManual(false)}
        onConfirm={executarBackupManual}
        title="Executar Backup Manual"
        description="Isso criará um backup incremental das alterações nas últimas 24 horas e salvará no Google Drive. Deseja continuar?"
        confirmText="Executar Backup"
        isLoading={executandoBackup}
      />

      <ConfirmDialog
        open={confirmRestore}
        onClose={() => {
          setConfirmRestore(false);
          setSelectedBackup(null);
        }}
        onConfirm={executarRestauracao}
        title="Restaurar Backup"
        description={`Você será redirecionado para a página de restauração. ATENÇÃO: Esta operação substituirá os dados atuais pelos dados do backup de ${selectedBackup ? formatDateTime(selectedBackup.data_backup) : ''}. Deseja continuar?`}
        confirmText="Ir para Restauração"
        isLoading={restaurando}
      />
    </div>
  );
}