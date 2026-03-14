import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, TrendingUp, Calendar, CheckCircle, Clock, Award, Edit, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfWeek, endOfWeek, parseISO, getWeek, getYear, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, isToday as isTodayFn } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function MeusGanhos() {
  const [user, setUser] = useState(null);
  const [filtroPeriodo, setFiltroPeriodo] = useState('hoje');
  const [filtroEquipe, setFiltroEquipe] = useState('todas');
  const [editandoGanho, setEditandoGanho] = useState(null);
  const [valorEditado, setValorEditado] = useState('');
  const [valoresPagos, setValoresPagos] = useState({});
  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const { data: ganhos = [], isLoading } = useQuery({
    queryKey: ['ganhos-tecnicos'],
    queryFn: () => base44.entities.GanhoTecnico.list(),
    enabled: !!user,
  });

  const { data: equipes = [] } = useQuery({
    queryKey: ['equipes'],
    queryFn: () => base44.entities.Equipe.list(),
  });

  const { data: atendimentos = [] } = useQuery({
    queryKey: ['atendimentos'],
    queryFn: () => base44.entities.Atendimento.list(),
    enabled: isAdmin && filtroEquipe !== 'todas',
  });

  const meuEmail = user?.email;
  const isAdmin = user?.role === 'admin';

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.GanhoTecnico.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ganhos-tecnicos'] });
      toast.success('Ganho excluído com sucesso');
    },
    onError: () => {
      toast.error('Erro ao excluir ganho');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.GanhoTecnico.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ganhos-tecnicos'] });
      setEditandoGanho(null);
      setValorEditado('');
      toast.success('Ganho atualizado com sucesso');
    },
    onError: () => {
      toast.error('Erro ao atualizar ganho');
    }
  });

  const handleEditarGanho = (ganho) => {
    setEditandoGanho(ganho);
    setValorEditado(ganho.valor_servico?.toString() || '');
  };

  const handleSalvarEdicao = () => {
    if (!editandoGanho || !valorEditado) return;
    
    const novoValor = parseFloat(valorEditado);
    if (isNaN(novoValor) || novoValor < 0) {
      toast.error('Digite um valor válido');
      return;
    }

    const novaComissao = (novoValor * (editandoGanho.comissao_percentual || 30)) / 100;
    
    updateMutation.mutate({
      id: editandoGanho.id,
      data: {
        ...editandoGanho,
        valor_servico: novoValor,
        valor_comissao: novaComissao
      }
    });
  };

  const handleExcluirGanho = (ganhoId) => {
    if (confirm('Tem certeza que deseja excluir este ganho?')) {
      deleteMutation.mutate(ganhoId);
    }
  };

  const handleValorPagoChange = (tecnicoEmail, valor) => {
    setValoresPagos(prev => ({
      ...prev,
      [tecnicoEmail]: valor
    }));
  };

  const handleConfirmarPagamento = (tecnicoEmail) => {
    const valor = parseFloat(valoresPagos[tecnicoEmail] || 0);
    if (valor <= 0) {
      toast.error('Digite um valor válido');
      return;
    }
    toast.success(`Pagamento de R$ ${valor.toFixed(2)} confirmado`);
  };

  // Filtrar ganhos baseado em permissão
  const ganhosPermitidos = useMemo(() => {
    if (!user) return [];
    
    // Admin vê todos os ganhos, técnicos veem apenas os próprios
    if (isAdmin) return ganhos;
    
    return ganhos.filter(g => g.tecnico_email === meuEmail);
  }, [ganhos, user, isAdmin, meuEmail]);

  // Calcular períodos (semana começa na segunda-feira)
  const hoje = new Date();
  const inicioSemanaAtual = startOfWeek(hoje, { weekStartsOn: 1 }); // 1 = Segunda
  const fimSemanaAtual = endOfWeek(hoje, { weekStartsOn: 1 });
  const inicioMesAtual = startOfMonth(hoje);
  const fimMesAtual = endOfMonth(hoje);
  const inicioAnoAtual = startOfYear(hoje);
  const fimAnoAtual = endOfYear(hoje);

  // Mapeamento de equipes para identificar membros
  const membrosPorEquipe = {
    '699e53267d5629312b8742dd': ['vinihenrique781@gmail.com', 'vgabrielkaybersdossantos@gmail.com'], // Equipe 1
    '699e54e99bb56cb59de69c61': ['witalok73@gmail.com', 'waglessonribero@gmail.com'] // Equipe 2
  };

  // Filtrar por período e equipe
  const ganhosFiltrados = useMemo(() => {
    let resultado = ganhosPermitidos;
    
    // Filtro de período
    if (filtroPeriodo === 'hoje') {
      resultado = resultado.filter(g => {
        const dataGanho = parseISO(g.data_conclusao);
        return isTodayFn(dataGanho);
      });
    } else if (filtroPeriodo === 'semana-atual') {
      resultado = resultado.filter(g => {
        const dataGanho = parseISO(g.data_conclusao);
        return isWithinInterval(dataGanho, { start: inicioSemanaAtual, end: fimSemanaAtual });
      });
    } else if (filtroPeriodo === 'mes-atual') {
      resultado = resultado.filter(g => {
        const dataGanho = parseISO(g.data_conclusao);
        return isWithinInterval(dataGanho, { start: inicioMesAtual, end: fimMesAtual });
      });
    } else if (filtroPeriodo === 'ano-atual') {
      resultado = resultado.filter(g => {
        const dataGanho = parseISO(g.data_conclusao);
        return isWithinInterval(dataGanho, { start: inicioAnoAtual, end: fimAnoAtual });
      });
    }
    
    // Filtro de equipe (apenas para admin)
    if (isAdmin && filtroEquipe !== 'todas') {
      const membros = membrosPorEquipe[filtroEquipe] || [];
      resultado = resultado.filter(g => membros.includes(g.tecnico_email));
    }
    
    return resultado;
  }, [ganhosPermitidos, filtroPeriodo, filtroEquipe, isAdmin, inicioSemanaAtual, fimSemanaAtual, inicioMesAtual, fimMesAtual, inicioAnoAtual, fimAnoAtual, atendimentos]);



  // Agrupar ganhos por técnico
    const ganhosPorTecnico = useMemo(() => {
      const grupos = {};

      ganhosFiltrados.forEach(ganho => {
        const tecnicoEmail = ganho.tecnico_email || 'sistema@app.com';
        const tecnicoNome = ganho.tecnico_nome || 'Sistema';

        if (!grupos[tecnicoEmail]) {
          grupos[tecnicoEmail] = {
            tecnicoEmail,
            tecnicoNome,
            ganhos: [],
            total: 0,
            totalPago: 0,
            totalPendente: 0
          };
        }

        // Verificar duplicatas por ID do ganho
        const jaExiste = grupos[tecnicoEmail].ganhos.some(g => g.id === ganho.id);
        if (!jaExiste) {
          grupos[tecnicoEmail].ganhos.push(ganho);
          grupos[tecnicoEmail].total += ganho.valor_comissao || 0;
          if (ganho.pago) {
            grupos[tecnicoEmail].totalPago += ganho.valor_comissao || 0;
          } else {
            grupos[tecnicoEmail].totalPendente += ganho.valor_comissao || 0;
          }
        }
      });

      return Object.values(grupos).sort((a, b) => (a.tecnicoNome || '').localeCompare(b.tecnicoNome || ''));
    }, [ganhosFiltrados]);

  // Calcular totais
  const totalGanhos = ganhosFiltrados.reduce((sum, g) => sum + (g.valor_comissao || 0), 0);
  
  // "Já Recebido" mostra apenas ganhos mensais pagos
  const ganhosMensaisPagos = ganhosPermitidos.filter(g => {
    if (!g.pago) return false;
    const dataGanho = parseISO(g.data_conclusao);
    return isWithinInterval(dataGanho, { start: inicioMesAtual, end: fimMesAtual });
  });
  const totalPagoMensal = ganhosMensaisPagos.reduce((sum, g) => sum + (g.valor_comissao || 0), 0);
  
  // "A Receber" mostra apenas da semana atual (segunda a domingo)
  const ganhosSemanaAtual = ganhosFiltrados.filter(g => {
    if (g.pago) return false;
    const dataGanho = parseISO(g.data_conclusao);
    return isWithinInterval(dataGanho, { start: inicioSemanaAtual, end: fimSemanaAtual });
  });
  const totalPendenteSemanal = ganhosSemanaAtual.reduce((sum, g) => sum + (g.valor_comissao || 0), 0);
  
  // Subtrair valores já pagos do total a receber
  const totalValoresPagos = Object.values(valoresPagos).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
  const totalPendenteFinal = totalPendenteSemanal - totalValoresPagos;

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isAdmin ? 'Ganhos dos Técnicos' : 'Meus Ganhos'}
            </h1>
            <p className="text-gray-600 mt-1">
              {isAdmin ? 'Acompanhe as comissões de todos os técnicos (15% por serviço)' : 'Acompanhe suas comissões (15% por serviço)'}
            </p>
          </div>
         <div className="flex items-center gap-2 flex-wrap">
           <Calendar className="w-5 h-5 text-blue-600" />
           <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
             <SelectTrigger className="w-48">
               <SelectValue />
             </SelectTrigger>
             <SelectContent>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="semana-atual">Semana Atual (Seg-Dom)</SelectItem>
              <SelectItem value="mes-atual">Mês Atual</SelectItem>
              <SelectItem value="ano-atual">Ano Atual</SelectItem>
              <SelectItem value="todos">Histórico Completo</SelectItem>
             </SelectContent>
           </Select>
           
           {isAdmin && (
             <Select value={filtroEquipe} onValueChange={setFiltroEquipe}>
               <SelectTrigger className="w-40">
                 <SelectValue placeholder="Equipe" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="todas">Todas Equipes</SelectItem>
                 {equipes.map(equipe => (
                   <SelectItem key={equipe.id} value={equipe.id}>
                     {equipe.nome}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
           )}
         </div>
       </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-700 flex items-center gap-2">
              <Award className="w-4 h-4" />
              Total de Ganhos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-700">
              R$ {totalGanhos.toFixed(2)}
            </p>
            <p className="text-xs text-green-600 mt-1">{ganhosFiltrados.length} serviços</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-blue-700 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Já Recebido (Mês)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-700">
              R$ {totalPagoMensal.toFixed(2)}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              {ganhosMensaisPagos.length} pagamentos
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-orange-700 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              A Receber (Semana)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-700">
              R$ {totalPendenteFinal.toFixed(2)}
            </p>
            <p className="text-xs text-orange-600 mt-1">
              Seg-Dom • {ganhosSemanaAtual.length} pendentes
            </p>
            {totalValoresPagos > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                (R$ {totalPendenteSemanal.toFixed(2)} - R$ {totalValoresPagos.toFixed(2)} pago)
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lista de serviços por técnico */}
      {ganhosPorTecnico.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">
                {isAdmin ? 'Nenhum ganho registrado neste período' : 'Você ainda não tem ganhos registrados neste período'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {ganhosPorTecnico.map((grupo) => (
            <Card key={grupo.tecnicoEmail} className="overflow-hidden">
              <CardHeader className="text-white bg-gradient-to-r from-blue-600 to-blue-700">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    {grupo.tecnicoNome}
                  </CardTitle>
                  <div className="flex gap-4 text-sm items-center">
                    <div className="text-right">
                      <p className="text-blue-100 text-xs">Total</p>
                      <p className="font-bold">R$ {grupo.total.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-blue-100 text-xs">Pago</p>
                      <p className="font-bold">R$ {grupo.totalPago.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-blue-100 text-xs">Pendente</p>
                      <p className="font-bold">R$ {grupo.totalPendente.toFixed(2)}</p>
                    </div>
                    {isAdmin && (
                      <div className="ml-4 flex items-end gap-2">
                        <div>
                          <Label className="text-blue-100 text-xs block mb-1">Valor Pago</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={valoresPagos[grupo.tecnicoEmail] || ''}
                            onChange={(e) => handleValorPagoChange(grupo.tecnicoEmail, e.target.value)}
                            className="w-28 h-8 text-sm bg-white text-gray-900"
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleConfirmarPagamento(grupo.tecnicoEmail)}
                          className="h-8 bg-green-600 hover:bg-green-700 text-white"
                        >
                          Confirmar
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold">Cliente</TableHead>
                        <TableHead className="font-semibold">Serviço</TableHead>
                        <TableHead className="font-semibold">Data</TableHead>
                        <TableHead className="text-right font-semibold">Valor</TableHead>
                        <TableHead className="text-right font-semibold">Comissão</TableHead>
                        <TableHead className="text-right font-semibold">Ganho</TableHead>
                        <TableHead className="text-center font-semibold">Status</TableHead>
                        {isAdmin && <TableHead className="text-center font-semibold">Ações</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grupo.ganhos
                        .sort((a, b) => new Date(b.data_conclusao) - new Date(a.data_conclusao))
                        .map((ganho) => (
                            <TableRow 
                               key={ganho.id}
                               className={ganho.pago ? 'bg-green-50' : 'hover:bg-gray-50'}
                             >
                               <TableCell className="font-medium">{ganho.cliente_nome}</TableCell>
                               <TableCell className="text-sm">{ganho.tipo_servico}</TableCell>
                            <TableCell className="text-sm text-gray-600">
                              {format(parseISO(ganho.data_conclusao), "dd/MM/yy HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              R$ {(ganho.valor_servico || 0).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right text-sm text-gray-600">
                              {ganho.comissao_percentual || 0}%
                            </TableCell>
                            <TableCell className="text-right font-bold text-green-600">
                              R$ {(ganho.valor_comissao || 0).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-center">
                              {ganho.pago ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full">
                                  <CheckCircle className="w-3 h-3" />
                                  Pago
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-100 px-2 py-1 rounded-full">
                                  <Clock className="w-3 h-3" />
                                  Pendente
                                </span>
                              )}
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    onClick={() => handleEditarGanho(ganho)}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => handleExcluirGanho(ganho.id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de edição */}
      <Dialog open={!!editandoGanho} onOpenChange={() => setEditandoGanho(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Valor do Serviço</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Input value={editandoGanho?.cliente_nome || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Serviço</Label>
              <Input value={editandoGanho?.tipo_servico || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>Valor do Serviço (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={valorEditado}
                onChange={(e) => setValorEditado(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-xs text-gray-500">
                Comissão ({editandoGanho?.comissao_percentual || 30}%): R$ {
                  valorEditado ? ((parseFloat(valorEditado) * (editandoGanho?.comissao_percentual || 30)) / 100).toFixed(2) : '0.00'
                }
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditandoGanho(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvarEdicao} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}