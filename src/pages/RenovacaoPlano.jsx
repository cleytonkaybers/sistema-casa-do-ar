import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, X, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function RenovacaoPlano() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  const [planos, setPlanos] = useState([]);
  const [selectedPlano, setSelectedPlano] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);

        if (currentUser?.company_id) {
          const empresas = await base44.entities.EmpresaSaaS.filter({
            company_id: currentUser.company_id
          });
          if (empresas.length > 0) {
            setEmpresa(empresas[0]);
            setSelectedPlano(empresas[0].plano);
          }
        }

        const planosData = await base44.entities.PlanoSaaS.filter({ ativo: true });
        setPlanos(planosData);
      } catch (error) {
        toast.error('Erro ao carregar dados: ' + error.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const handleRenovacao = async (plano) => {
    if (!empresa) {
      toast.error('Empresa não identificada');
      return;
    }

    setProcessing(true);
    try {
      // Aqui você integraria com Stripe
      // Por enquanto, apenas atualizar status para ativa
      const proximaCobranca = new Date();
      proximaCobranca.setMonth(proximaCobranca.getMonth() + 1);

      await base44.entities.EmpresaSaaS.update(empresa.id, {
        plano: plano,
        status_assinatura: 'ativa',
        data_proxima_cobranca: proximaCobranca.toISOString()
      });

      // Log de auditoria
      await base44.asServiceRole.entities.LogAuditoriaSaaS.create({
        company_id: empresa.company_id,
        usuario_email: user.email,
        tipo_acao: 'renovar_assinatura',
        entidade: 'EmpresaSaaS',
        entidade_id: empresa.id,
        descricao: `Assinatura renovada: ${plano}`
      });

      toast.success('Assinatura renovada com sucesso!');
      setTimeout(() => {
        navigate(createPageUrl('DashboardSaaS'));
      }, 1500);
    } catch (error) {
      toast.error('Erro na renovação: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const planoAtual = planos.find(p => p.nome.toLowerCase() === empresa?.plano);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Botão Voltar */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-purple-300 hover:text-purple-100 mb-8 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar
        </button>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Renove sua Assinatura</h1>
          <p className="text-purple-200 text-lg">
            Escolha um plano para restaurar o acesso completo
          </p>
        </div>

        {/* Alert */}
        {empresa?.bloqueada && (
          <Card className="mb-8 bg-red-50 border-red-200">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900">Empresa Bloqueada</p>
                  <p className="text-sm text-red-700">{empresa.motivo_bloqueio}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Planos */}
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          {planos.map((plano) => {
            const isSelected = selectedPlano === plano.nome.toLowerCase();
            const isCurrent = planoAtual?.id === plano.id;

            return (
              <Card
                key={plano.id}
                className={`transition-all cursor-pointer ${
                  isSelected
                    ? 'border-cyan-400 shadow-xl shadow-cyan-500/20 scale-105'
                    : 'border-purple-700/30'
                } ${isCurrent ? 'ring-2 ring-green-400' : ''}`}
                onClick={() => setSelectedPlano(plano.nome.toLowerCase())}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-2xl text-white">
                        {plano.nome}
                      </CardTitle>
                      {isCurrent && (
                        <p className="text-xs text-green-400 mt-1">✓ Plano atual</p>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="w-6 h-6 text-cyan-400" />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Preço */}
                  <div>
                    <p className="text-4xl font-bold text-white">
                      R$ {plano.preco_mensal}
                      <span className="text-lg text-purple-300">/mês</span>
                    </p>
                  </div>

                  {/* Limites */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-purple-200">
                      <span>👥</span>
                      <span>{plano.limite_usuarios} usuários</span>
                    </div>
                    <div className="flex items-center gap-2 text-purple-200">
                      <span>👤</span>
                      <span>{plano.limite_clientes} clientes</span>
                    </div>
                    <div className="flex items-center gap-2 text-purple-200">
                      <span>📋</span>
                      <span>{plano.limite_ordens_mes} ordens/mês</span>
                    </div>
                  </div>

                  {/* Recursos */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-purple-300 uppercase">
                      Recursos
                    </p>
                    {plano.recursos?.map((recurso, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-purple-200">
                        <Check className="w-4 h-4 text-green-400" />
                        {recurso}
                      </div>
                    ))}
                  </div>

                  {/* Botão */}
                  <Button
                    onClick={() => handleRenovacao(plano.nome.toLowerCase())}
                    disabled={processing || isCurrent}
                    className={`w-full h-10 font-bold transition-all ${
                      isSelected
                        ? 'bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700'
                        : 'bg-purple-700/50 hover:bg-purple-600'
                    } ${isCurrent ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : isCurrent ? (
                      'Plano Atual'
                    ) : (
                      'Selecionar'
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Info */}
        <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Check className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-blue-900">Dados Protegidos</p>
                <p className="text-sm text-blue-700 mt-1">
                  Todos os seus dados de clientes, ordens de serviço e financeiro estão seguros e serão restaurados imediatamente após a renovação.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}