import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Shield, Search, User, Clock, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/utils/formatters';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { usePermissions } from '@/components/auth/PermissionGuard';
import NoPermission from '@/components/NoPermission';
import { useNavigate } from 'react-router-dom';

export default function LogsAuditoria() {
  const { isAdmin } = usePermissions();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  React.useEffect(() => {
    const checkAdmin = async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
        if (u?.role !== 'admin') {
          navigate('/Dashboard');
        }
      } catch {
        navigate('/Dashboard');
      }
    };
    checkAdmin();
  }, [navigate]);
  const [acaoFiltro, setAcaoFiltro] = useState('');
  const [limpandoTeste, setLimpandoTeste] = useState(false);
  const [resultadoLimpeza, setResultadoLimpeza] = useState(null);

  const limparRegistrosTeste = async () => {
    if (!window.confirm('Tem certeza que deseja excluir TODOS os registros com nome "Teste" de todas as entidades? Esta ação não pode ser desfeita.')) return;
    setLimpandoTeste(true);
    setResultadoLimpeza(null);
    const entidades = [
      { entity: base44.entities.Notificacao, campo: 'cliente_nome' },
      { entity: base44.entities.Atendimento, campo: 'cliente_nome' },
      { entity: base44.entities.PagamentoCliente, campo: 'cliente_nome' },
      { entity: base44.entities.LancamentoFinanceiro, campo: 'cliente_nome' },
      { entity: base44.entities.Servico, campo: 'cliente_nome' },
      { entity: base44.entities.Cliente, campo: 'nome' },
    ];
    let totalExcluidos = 0;
    for (const { entity, campo } of entidades) {
      const registros = await entity.list();
      const testes = registros.filter(r => r[campo]?.toLowerCase().includes('teste'));
      for (const r of testes) {
        await entity.delete(r.id);
        totalExcluidos++;
      }
    }
    setResultadoLimpeza(totalExcluidos);
    setLimpandoTeste(false);
  };

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['logs-auditoria'],
    queryFn: () => base44.entities.LogAuditoria.list('-created_date', 200),
  });

  const logsFiltrados = logs.filter(log => {
    const matchSearch = 
      log.usuario_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.acao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.observacao?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchAcao = !acaoFiltro || log.acao === acaoFiltro;
    return matchSearch && matchAcao;
  });

  const acoes = [...new Set(logs.map(l => l.acao))].sort();

  const getAcaoLabel = (acao) => {
    const labels = {
      criar_cliente: 'Criar Cliente',
      editar_cliente: 'Editar Cliente',
      excluir_cliente: 'Excluir Cliente',
      criar_servico: 'Criar Serviço',
      editar_servico: 'Editar Serviço',
      excluir_servico: 'Excluir Serviço',
      concluir_servico: 'Concluir Serviço',
      gerar_comissao: 'Gerar Comissão',
      registrar_pagamento: 'Registrar Pagamento',
      estornar_pagamento: 'Estornar Pagamento',
      exportar_dados: 'Exportar Dados',
      backup_manual: 'Backup Manual',
    };
    return labels[acao] || acao;
  };

  const getAcaoCor = (acao) => {
    if (acao?.includes('excluir') || acao?.includes('estornar')) {
      return 'bg-red-100 text-red-700';
    }
    if (acao?.includes('criar') || acao?.includes('registrar')) {
      return 'bg-green-100 text-green-700';
    }
    if (acao?.includes('editar') || acao?.includes('alterar')) {
      return 'bg-blue-100 text-blue-700';
    }
    return 'bg-gray-100 text-gray-700';
  };
  
  if (!user) {
    return <div className="flex items-center justify-center h-screen"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div></div>;
  }
  
  if (user.role !== 'admin') return <NoPermission />;

  if (isLoading) return <TableSkeleton rows={15} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-600" />
            Logs de Auditoria
          </h1>
          <p className="text-gray-500 mt-1">
            Registro completo de todas as ações críticas do sistema
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button
            variant="destructive"
            onClick={limparRegistrosTeste}
            disabled={limpandoTeste}
            className="flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            {limpandoTeste ? 'Limpando...' : 'Limpar Registros "Teste"'}
          </Button>
          {resultadoLimpeza !== null && (
            <p className="text-sm text-green-600 font-medium">{resultadoLimpeza} registro(s) excluído(s) com sucesso.</p>
          )}
        </div>
      </div>

      {/* Filtros */}
      <Card className="border border-gray-200">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Buscar por usuário, ação ou observação..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-gray-200"
              />
            </div>
            <select
              value={acaoFiltro}
              onChange={(e) => setAcaoFiltro(e.target.value)}
              className="h-10 px-3 border border-gray-200 rounded-md"
            >
              <option value="">Todas as ações</option>
              {acoes.map(acao => (
                <option key={acao} value={acao}>{getAcaoLabel(acao)}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle>Histórico de Ações ({logsFiltrados.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow style={{ backgroundColor: '#1e3a8a' }}>
                <TableHead className="text-white">Data/Hora</TableHead>
                <TableHead className="text-white">Usuário</TableHead>
                <TableHead className="text-white">Ação</TableHead>
                <TableHead className="text-white">Entidade</TableHead>
                <TableHead className="text-white">Observação</TableHead>
                <TableHead className="text-white">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logsFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-gray-500">
                    Nenhum log encontrado
                  </TableCell>
                </TableRow>
              ) : (
                logsFiltrados.map((log) => (
                  <TableRow key={log.id} className="hover:bg-gray-50">
                    <TableCell className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-gray-400" />
                      {formatDateTime(log.created_date)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="font-medium text-sm">{log.usuario_nome}</p>
                          <p className="text-xs text-gray-500">{log.usuario_email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getAcaoCor(log.acao)}>
                        {getAcaoLabel(log.acao)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {log.entidade || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 max-w-md truncate">
                      {log.observacao || '-'}
                    </TableCell>
                    <TableCell>
                      {log.sucesso ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}