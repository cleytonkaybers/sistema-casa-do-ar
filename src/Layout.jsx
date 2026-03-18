import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from './utils';
import {
  Users,
  LayoutDashboard,
  ClipboardList,
  Menu,
  X,
  LogOut,
  Database,
  MessageCircle,
  BarChart3,
  Settings,
  Bell,
  Snowflake,
  Wind,
  Zap,
  Wrench,
  Thermometer,
  Cloud,
  Droplets,
  RotateCw,
  ChevronRight,
  DollarSign } from
'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import ErrorBoundary from '@/components/ErrorBoundary';

import NotificationCenter from '@/components/NotificationCenter';
import UserMenu from '@/components/UserMenu';
import { EmpresaProvider, useEmpresa } from '@/components/auth/EmpresaGuard';
import SubscriptionBlocker from '@/components/saas/SubscriptionBlocker';

const ICON_MAP = {
  Snowflake, Wind, Zap, Wrench, Thermometer, Cloud, Droplets,
  Settings, Database, Users, LayoutDashboard, ClipboardList, MessageCircle, BarChart3, Bell
};

function LayoutContent({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { currentUser, currentEmpresa, isSuperAdmin, isAdminEmpresa } = useEmpresa();

  const [user, setUser] = useState(null);
  const [companySettings, setCompanySettings] = useState({ company_name: 'Casa do Ar', company_icon: 'Snowflake' });

  React.useEffect(() => {
    base44.auth.me().then((u) => setUser(u)).catch(() => setUser(null));
    base44.entities.CompanySettings.list().then((result) => {
      if (result.length > 0) setCompanySettings(result[0]);
    }).catch(() => {});
  }, []);

  const baseNavigation = [
  { name: 'Dashboard', href: createPageUrl('Dashboard'), icon: LayoutDashboard },
  { name: 'Clientes', href: createPageUrl('Clientes'), icon: Users },
  { name: 'Serviços', href: createPageUrl('Servicos'), icon: ClipboardList },
  { name: 'Atendimentos', href: createPageUrl('Atendimentos'), icon: ClipboardList },
  { name: 'Meu Financeiro', href: createPageUrl('MeuFinanceiro'), icon: DollarSign }];


  const preventivasNavigation = [
  { name: 'Preventivas Futuras', href: createPageUrl('PreventivasFuturas'), icon: ClipboardList },
  { name: 'Histórico de Clientes', href: createPageUrl('HistoricoClientes'), icon: BarChart3 }];


  const superAdminNavigation = [
  { name: 'Gerenciar Empresas', href: createPageUrl('GerenciarEmpresas'), icon: Database }];


  const adminNavigation = [
  { name: 'Relatórios', href: createPageUrl('Relatorios'), icon: BarChart3 },
  { name: 'Relatório Comissões', href: createPageUrl('RelatorioComissoes'), icon: DollarSign },
  { name: 'Financeiro', href: createPageUrl('FinanceiroAdmin'), icon: DollarSign },
  { name: 'Tabela de Serviços', href: createPageUrl('TabelaServicos'), icon: Database },
  { name: 'Backup e Restaurar', href: createPageUrl('BackupRestaurer'), icon: Database },
  { name: 'Usuários', href: createPageUrl('Usuarios'), icon: Users },
  { name: 'Configurações', href: createPageUrl('Configuracoes'), icon: Settings },
  { name: 'Suporte', href: createPageUrl('Suporte'), icon: MessageCircle }];


  const allUsersNavigation = [
  { name: 'Preferências de Notificação', href: createPageUrl('PreferencesNotificacao'), icon: Bell },
  { name: 'Sair', href: '#', icon: LogOut, action: () => base44.auth.logout() }];


  const navigation = isSuperAdmin() ?
  [...superAdminNavigation, ...baseNavigation, ...preventivasNavigation, ...adminNavigation, ...allUsersNavigation] :
  currentUser?.tipo_usuario === 'tecnico' ?
  [...baseNavigation, ...preventivasNavigation] :
  [...baseNavigation, ...preventivasNavigation, ...adminNavigation, ...allUsersNavigation];

  const isActive = (href) => {
    return location.pathname === new URL(href, window.location.origin).pathname;
  };

  const LogoIcon = ICON_MAP[companySettings.company_icon] || Snowflake;

  return (
    <ErrorBoundary>
      <div className="min-h-screen" style={{ backgroundColor: '#f0f4f8' }}>
        {/* Backdrop mobile */}
        {sidebarOpen &&
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)} />

        }

        {/* Sidebar */}
        <aside className={`
          fixed top-0 left-0 z-50 h-full w-72 shadow-2xl transform transition-transform duration-300 ease-in-out
          lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `} style={{ backgroundColor: '#1e3a8a' }}>
          <div className="flex flex-col h-full">

            {/* Logo / empresa */}
            <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
              <Link
                to={isAdminEmpresa() || isSuperAdmin() ? createPageUrl('Configuracoes') : '#'}
                className="flex items-center gap-3 hover:opacity-90 transition-opacity">

                {/* Logo box */}
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden shadow-lg flex-shrink-0"
                style={{ backgroundColor: '#F5C800' }}>
                  {companySettings.company_logo_url ?
                  <img src={companySettings.company_logo_url} alt="Logo" className="w-full h-full object-cover" /> :

                  <LogoIcon className="w-6 h-6 text-white" />
                  }
                </div>
                <div>
                  <p className="font-bold text-white text-lg leading-tight">
                    {currentEmpresa?.nome || companySettings.company_name}
                  </p>
                  <p className="text-xs font-medium" style={{ color: '#93c5fd' }}>
                    {isSuperAdmin() ? 'Super Admin' : currentUser?.tipo_usuario === 'admin_empresa' ? 'Administrador' : 'Climatização'}
                  </p>
                  {user?.full_name &&
                  <p className="text-xs font-semibold" style={{ color: '#FFF347' }}>{user.full_name}</p>
                  }
                </div>
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors text-white">

                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                if (item.action) {
                  return (
                    <button
                      key={item.name}
                      onClick={item.action}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-blue-200/70 hover:text-white hover:bg-white/10 transition-all">

                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className="font-medium">{item.name}</span>
                    </button>);

                }

                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    active ?
                    'text-gray-900 font-bold shadow-lg' :
                    'text-blue-100/80 hover:text-white hover:bg-white/10'}`
                    }
                    style={active ? { backgroundColor: '#f59e0b' } : {}}>

                    <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-gray-900' : 'text-blue-200/60'}`} />
                    <span className="font-medium flex-1">{item.name}</span>
                    {active && <ChevronRight className="w-4 h-4 text-gray-900/70" />}
                  </Link>);

              })}
            </nav>
          </div>
        </aside>

        {/* Main */}
        <div className="lg:pl-72">

          {/* Top bar */}
          <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
            <div className="bg-[#1293e2] px-4 py-3 flex items-center justify-between lg:px-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors">

                  <Menu className="w-6 h-6 text-gray-700" />
                </button>

                {/* Logo visível no mobile topbar */}
                <div className="flex items-center gap-2 lg:hidden">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center overflow-hidden shadow"
                  style={{ backgroundColor: '#F5C800' }}>
                    {companySettings.company_logo_url ?
                    <img src={companySettings.company_logo_url} alt="Logo" className="w-full h-full object-cover" /> :

                    <LogoIcon className="w-4 h-4 text-white" />
                    }
                  </div>
                  <span className="font-bold text-gray-800">{currentEmpresa?.nome || companySettings.company_name}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.location.reload()} className="text-slate-50 p-2 rounded-lg hover:bg-gray-100 transition-colors hover:text-gray-700"

                  title="Atualizar">

                  <RotateCw className="bg-[none] lucide lucide-rotate-cw w-5 h-5" />
                </button>
                <NotificationCenter />
                <UserMenu user={user} />
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </ErrorBoundary>);

}

export default function Layout({ children }) {
  return (
    <SubscriptionBlocker>
      <EmpresaProvider>
        <LayoutContent>{children}</LayoutContent>
      </EmpresaProvider>
    </SubscriptionBlocker>);

}