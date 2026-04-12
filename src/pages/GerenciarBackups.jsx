import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { createPageUrl } from '@/utils';

/**
 * GerenciarBackups — redirecionamento para a Central de Backup unificada.
 * Toda a lógica de backup incremental, exportação, importação e histórico
 * está consolidada em BackupRestaurer.jsx (aba "Backups na Nuvem").
 */
export default function GerenciarBackups() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(createPageUrl('BackupRestaurer'), { replace: true });
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto" />
        <p className="text-gray-400 text-sm">Redirecionando para a Central de Backup...</p>
      </div>
    </div>
  );
}
