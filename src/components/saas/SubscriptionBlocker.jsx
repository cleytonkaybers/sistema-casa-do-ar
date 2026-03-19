import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertCircle, Clock, CreditCard, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';

export function SubscriptionBlocker({ children }) {
  const { user: authUser, isLoadingAuth } = useAuth();
  const [empresa, setEmpresa] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bloqueado, setBloqueado] = useState(false);

  useEffect(() => {
    if (!isLoadingAuth) {
      verificarAssinatura(authUser);
    }
  }, [authUser, isLoadingAuth]);

  async function verificarAssinatura(currentUser) {
    try {
      setLoading(false);
      
      // Se não há usuário autenticado, não fazer verificação
      if (!currentUser) {
        return;
      }

      // Se o usuário não tem company_id, permitir acesso (sistema legado ou admin)
      if (!currentUser.company_id) {
        return;
      }

      try {
        const empresas = await base44.entities.EmpresaSaaS.filter({
          company_id: currentUser.company_id
        });

        if (empresas.length > 0) {
          const emp = empresas[0];
          setEmpresa(emp);

          // Verificar se está vencida
          if (emp.status_assinatura === 'vencida' || emp.bloqueada) {
            setBloqueado(true);
          } else if (emp.status_assinatura === 'trial') {
            // Validar trial
            const agora = new Date();
            const fimTrial = new Date(emp.data_fim_trial);
            if (agora > fimTrial) {
              // Atualizar para vencida
              await base44.entities.EmpresaSaaS.update(emp.id, {
                status_assinatura: 'vencida'
              });
              setBloqueado(true);
              setEmpresa({...emp, status_assinatura: 'vencida'});
            }
          }
        }
      } catch (empresaError) {
        // Se a entidade EmpresaSaaS não existir ou houver erro, permitir acesso
        console.log('EmpresaSaaS não encontrada - permitindo acesso');
      }
    } catch (error) {
      console.error('Erro ao verificar assinatura:', error);
      // Em caso de erro, permitir acesso para não bloquear o usuário
    }
  }

  if (loading || isLoadingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-purple-900">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (bloqueado && empresa) {
    return <SubscriptionBlockedScreen empresa={empresa} />;
  }

  return children;
}

function SubscriptionBlockedScreen({ empresa }) {
  const diasVencido = Math.ceil(
    (new Date() - new Date(empresa.data_fim_trial)) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900/20 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Card Principal */}
        <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl shadow-2xl p-8 border-2 border-red-200">
          {/* Ícone */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-red-600" />
            </div>
          </div>

          {/* Título */}
          <h1 className="text-3xl font-bold text-center text-red-900 mb-2">
            Acesso Bloqueado
          </h1>

          {/* Status */}
          <div className="bg-red-100 border border-red-300 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900">
                  {empresa.status_assinatura === 'bloqueada' 
                    ? 'Empresa Bloqueada' 
                    : 'Assinatura Expirada'}
                </p>
                <p className="text-sm text-red-700 mt-1">
                  {empresa.bloqueada && empresa.motivo_bloqueio
                    ? empresa.motivo_bloqueio
                    : `Sua assinatura expirou há ${diasVencido} dia${diasVencido !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
          </div>

          {/* Informações */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3 text-gray-700">
              <Clock className="w-5 h-5 text-orange-600" />
              <span className="text-sm">
                <strong>Data de Vencimento:</strong>{' '}
                {new Date(empresa.data_fim_trial).toLocaleDateString('pt-BR')}
              </span>
            </div>
            <div className="flex items-center gap-3 text-gray-700">
              <CreditCard className="w-5 h-5 text-blue-600" />
              <span className="text-sm">
                <strong>Empresa:</strong> {empresa.nome}
              </span>
            </div>
          </div>

          {/* Mensagem */}
          <p className="text-center text-gray-600 text-sm mb-8">
            Renove sua assinatura para restaurar o acesso completo. Seus dados estão seguros e protegidos.
          </p>

          {/* Botões */}
          <div className="space-y-3">
            <a href={createPageUrl('RenovacaoPlano')}>
              <Button className="w-full h-12 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold text-lg rounded-lg">
                Renovar Assinatura
              </Button>
            </a>
            <button
              onClick={() => {
                localStorage.removeItem('base44_token');
                sessionStorage.removeItem('base44_token');
                base44.auth.logout();
              }}
              className="w-full h-12 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-colors"
            >
              Sair da Conta
            </button>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-gray-500 mt-6">
            Precisa de ajuda? Contate nosso suporte em{' '}
            <a href="mailto:suporte@climasaas.com" className="text-blue-600 hover:underline">
              suporte@climasaas.com
            </a>
          </p>
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p className="text-sm text-blue-900">
            💾 <strong>Seus dados estão salvos</strong> e serão restaurados assim que sua assinatura for renovada.
          </p>
        </div>
      </div>
    </div>
  );
}

export default SubscriptionBlocker;