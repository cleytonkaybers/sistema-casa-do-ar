import React, { Suspense, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { IS_OFFLINE } from '@/api/base44Client';
import { isHydrated, getDataDate, OfflineImport } from '@/api/offline/gate.js';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import FinanceiroAdmin from '@/pages/FinanceiroAdmin';
import MeuFinanceiro from '@/pages/MeuFinanceiro';
import TabelaServicos from '@/pages/TabelaServicos';
import RelatorioComissoes from '@/pages/RelatorioComissoes';
import LogsAuditoria from '@/pages/LogsAuditoria';
import GerenciarBackups from '@/pages/GerenciarBackups';
import Cheques from '@/pages/Cheques';
import PagamentosClientes from '@/pages/PagamentosClientes';
import Agendamentos from '@/pages/Agendamentos';
import RankingTecnicos from '@/pages/RankingTecnicos';
import DinheiroEmprestado from '@/pages/DinheiroEmprestado';

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

// Banner fixo mostrado em todas as telas quando no modo offline
function OfflineBanner() {
  const date = getDataDate();
  let label = 'dados sem data';
  if (date) {
    try {
      label = 'dados de ' + new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { label = date; }
  }
  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 bg-amber-500 text-amber-950 text-xs font-bold py-1.5 px-4 shadow-lg">
      <span>🔌</span>
      <span>MODO OFFLINE — somente leitura — {label}</span>
    </div>
  );
}

const AuthenticatedApp = () => {
  const { isLoading, authError } = useAuth();

  // Gate offline: se ainda não importou o backup, mostra a tela de importação
  const [offlineReady, setOfflineReady] = React.useState(IS_OFFLINE ? isHydrated() : true);
  if (IS_OFFLINE && !offlineReady) {
    return <OfflineImport onReady={() => setOfflineReady(true)} />;
  }

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle user not registered error
  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  // Render the main app
  return (
    <>
    {IS_OFFLINE && <OfflineBanner />}
    <div style={IS_OFFLINE ? { paddingTop: '2rem' } : {}}>
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={
          <LayoutWrapper currentPageName={mainPageKey}>
            <MainPage />
          </LayoutWrapper>
        } />
        {Object.entries(Pages).map(([path, Page]) => (
          <Route
            key={path}
            path={`/${path}`}
            element={
              <LayoutWrapper currentPageName={path}>
                <Page />
              </LayoutWrapper>
            }
          />
        ))}
        <Route path="/FinanceiroAdmin" element={
          <LayoutWrapper currentPageName="FinanceiroAdmin">
            <FinanceiroAdmin />
          </LayoutWrapper>
        } />
        <Route path="/MeuFinanceiro" element={
          <LayoutWrapper currentPageName="MeuFinanceiro">
            <MeuFinanceiro />
          </LayoutWrapper>
        } />
        <Route path="/TabelaServicos" element={
          <LayoutWrapper currentPageName="TabelaServicos">
            <TabelaServicos />
          </LayoutWrapper>
        } />
        <Route path="/RelatorioComissoes" element={
          <LayoutWrapper currentPageName="RelatorioComissoes">
            <RelatorioComissoes />
          </LayoutWrapper>
        } />
        <Route path="/LogsAuditoria" element={
          <LayoutWrapper currentPageName="LogsAuditoria">
            <LogsAuditoria />
          </LayoutWrapper>
        } />
        <Route path="/PagamentosClientes" element={
          <LayoutWrapper currentPageName="PagamentosClientes">
            <PagamentosClientes />
          </LayoutWrapper>
        } />
        <Route path="/GerenciarBackups" element={
          <LayoutWrapper currentPageName="GerenciarBackups">
            <GerenciarBackups />
          </LayoutWrapper>
        } />
        <Route path="/Cheques" element={
          <LayoutWrapper currentPageName="Cheques">
            <Cheques />
          </LayoutWrapper>
        } />
        <Route path="/Agendamentos" element={
          <LayoutWrapper currentPageName="Agendamentos">
            <Agendamentos />
          </LayoutWrapper>
        } />
        <Route path="/RankingTecnicos" element={
          <LayoutWrapper currentPageName="RankingTecnicos">
            <RankingTecnicos />
          </LayoutWrapper>
        } />
        <Route path="/DinheiroEmprestado" element={
          <LayoutWrapper currentPageName="DinheiroEmprestado">
            <DinheiroEmprestado />
          </LayoutWrapper>
        } />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
    </div>
    </>
  );
};


const Router = IS_OFFLINE ? HashRouter : BrowserRouter;

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          {!IS_OFFLINE && <NavigationTracker />}
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App