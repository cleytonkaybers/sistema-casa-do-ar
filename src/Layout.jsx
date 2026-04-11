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
import { useAuth } from '@/lib/AuthContext';
import SubscriptionBlocker from '@/components/saas/SubscriptionBlocker';

const ICON_MAP = {
  Snowflake, Wind, Zap, Wrench, Thermometer, Cloud, Droplets,
  Settings, Database, Users, LayoutDashboard, ClipboardList, MessageCircle, BarChart3, Bell
};

function LayoutContent({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { currentUser, currentEmpresa, isSuperAdmin, isAdminEmpresa } = useEmpresa();
  const { user } = useAuth();

  const [companySettings, setCompanySettings] = useState({ company_name: 'Casa do Ar', company_icon: 'Snowflake' });

  React.useEffect(() => {
    base44.entities.CompanySettings.list().then((result) => {
      if (result.length > 0) setCompanySettings(result[0]);
    }).catch(() => {});
  }, []);

  // Definir navegação com base no tipo de usuário
  let navigation = [];
  
  if (isSuperAdmin()) {
    // Super Admin vê tudo
    navigation = [
      { name: 'Dashboard', href: createPageUrl('Dashboard'), icon: LayoutDashboard },
      { name: 'Serviços', href: createPageUrl('Servicos'), icon: ClipboardList },
      { name: 'Atendimentos', href: createPageUrl('Atendimentos'), icon: ClipboardList },
      { name: 'Preventivas Futuras', href: createPageUrl('PreventivasFuturas'), icon: ClipboardList },
      { name: 'Pagamentos dos Clientes', href: createPageUrl('PagamentosClientes'), icon: DollarSign },
      { name: 'Financeiro', href: createPageUrl('FinanceiroAdmin'), icon: DollarSign },
      { name: 'Cheques', href: createPageUrl('Cheques'), icon: DollarSign },
      { name: 'Tabela de Serviços', href: createPageUrl('TabelaServicos'), icon: Database },
      { name: 'Clientes', href: createPageUrl('Clientes'), icon: Users },
      { name: 'Agendamentos', href: createPageUrl('Agendamentos'), icon: ClipboardList },
      { name: 'Histórico de Clientes', href: createPageUrl('HistoricoClientes'), icon: BarChart3 },
      { name: 'Relatórios', href: createPageUrl('Relatorios'), icon: BarChart3 },
      { name: 'Relatório Comissões', href: createPageUrl('RelatorioComissoes'), icon: DollarSign },
      { name: 'Usuários', href: createPageUrl('Usuarios'), icon: Users },
      { name: 'Gerenciar Empresas', href: createPageUrl('GerenciarEmpresas'), icon: Database },
      { name: 'Logs de Auditoria', href: createPageUrl('LogsAuditoria'), icon: Database },
      { name: 'Gerenciar Backups', href: createPageUrl('GerenciarBackups'), icon: Database },
      { name: 'Backup e Restaurar', href: createPageUrl('BackupRestaurer'), icon: Database },
      { name: 'Configurações', href: createPageUrl('Configuracoes'), icon: Settings },
      { name: 'Suporte', href: createPageUrl('Suporte'), icon: MessageCircle },
      { name: 'Preferências de Notificação', href: createPageUrl('PreferencesNotificacao'), icon: Bell },
      { name: 'Sair', href: '#', icon: LogOut, action: () => base44.auth.logout() },
    ];
  } else if (currentUser?.tipo_usuario === 'tecnico' || user?.role === 'user') {
    // Técnicos veem Dashboard, Serviços, Atendimentos, Preventivas Futuras, Meu Financeiro e Sair
    navigation = [
      { name: 'Dashboard', href: createPageUrl('Dashboard'), icon: LayoutDashboard },
      { name: 'Serviços', href: createPageUrl('Servicos'), icon: ClipboardList },
      { name: 'Atendimentos', href: createPageUrl('Atendimentos'), icon: ClipboardList },
      { name: 'Preventivas Futuras', href: createPageUrl('PreventivasFuturas'), icon: ClipboardList },
      { name: 'Meu Financeiro', href: createPageUrl('MeuFinanceiro'), icon: DollarSign },
      { name: 'Sair', href: '#', icon: LogOut, action: () => base44.auth.logout() },
    ];
  } else {
    // Admins normais veem tudo exceto gerenciar empresas
    navigation = [
      { name: 'Dashboard', href: createPageUrl('Dashboard'), icon: LayoutDashboard },
      { name: 'Serviços', href: createPageUrl('Servicos'), icon: ClipboardList },
      { name: 'Atendimentos', href: createPageUrl('Atendimentos'), icon: ClipboardList },
      { name: 'Preventivas Futuras', href: createPageUrl('PreventivasFuturas'), icon: ClipboardList },
      ...(isAdminEmpresa() ? [{ name: 'Pagamentos dos Clientes', href: createPageUrl('PagamentosClientes'), icon: DollarSign }] : []),
      { name: 'Financeiro', href: createPageUrl('FinanceiroAdmin'), icon: DollarSign },
      { name: 'Cheques', href: createPageUrl('Cheques'), icon: DollarSign },
      { name: 'Tabela de Serviços', href: createPageUrl('TabelaServicos'), icon: Database },
      { name: 'Clientes', href: createPageUrl('Clientes'), icon: Users },
      { name: 'Agendamentos', href: createPageUrl('Agendamentos'), icon: ClipboardList },
      { name: 'Histórico de Clientes', href: createPageUrl('HistoricoClientes'), icon: BarChart3 },
      { name: 'Relatórios', href: createPageUrl('Relatorios'), icon: BarChart3 },
      { name: 'Relatório Comissões', href: createPageUrl('RelatorioComissoes'), icon: DollarSign },
      { name: 'Usuários', href: createPageUrl('Usuarios'), icon: Users },
      { name: 'Logs de Auditoria', href: createPageUrl('LogsAuditoria'), icon: Database },
      { name: 'Gerenciar Backups', href: createPageUrl('GerenciarBackups'), icon: Database },
      { name: 'Backup e Restaurar', href: createPageUrl('BackupRestaurer'), icon: Database },
      { name: 'Configurações', href: createPageUrl('Configuracoes'), icon: Settings },
      { name: 'Suporte', href: createPageUrl('Suporte'), icon: MessageCircle },
      { name: 'Preferências de Notificação', href: createPageUrl('PreferencesNotificacao'), icon: Bell },
      { name: 'Sair', href: '#', icon: LogOut, action: () => base44.auth.logout() },
    ];
  }

  const isActive = (href) => {
    return location.pathname === new URL(href, window.location.origin).pathname;
  };

  const LogoIcon = ICON_MAP[companySettings.company_icon] || Snowflake;

  return (
    <ErrorBoundary>
      <div className="min-h-screen" style={{ backgroundColor: '#f0f9ff' }}>
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
        `} style={{ background: 'linear-gradient(180deg, #0d1b3e 0%, #1a3270 50%, #1e40af 100%)' }}>
          <div className="flex flex-col h-full">

            {/* Logo / empresa */}
            <div className="flex items-center justify-between px-5 py-5 border-b border-white/10" style={{ background: 'rgba(0,0,0,0.15)' }}>
              <Link
                to={isAdminEmpresa() || isSuperAdmin() ? createPageUrl('Configuracoes') : '#'}
                className="flex items-center gap-3 hover:opacity-90 transition-opacity">

                {/* Logo box */}
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #F5C800 0%, #f97316 100%)', boxShadow: '0 4px 15px rgba(245,200,0,0.4)' }}>
                  {companySettings.company_logo_url ?
                  <img
                    src={companySettings.company_logo_url}
                    alt="Logo"
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
                  />
                  : null}
                  <LogoIcon className={`w-8 h-8 text-white ${companySettings.company_logo_url ? 'hidden' : ''}`} />

                </div>
                <div>
                  <p className="font-bold text-white text-lg leading-tight">
                    {currentEmpresa?.nome || companySettings.company_name}
                  </p>
                  <p className="text-xs font-medium" style={{ color: '#7dd3fc' }}>
                    {isSuperAdmin() ? 'Super Admin' : currentUser?.tipo_usuario === 'admin_empresa' ? 'Administrador' : 'Climatização'}
                  </p>
                  {user?.full_name &&
                  <p className="text-xs font-semibold" style={{ color: '#fde68a' }}>{user.full_name}</p>
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
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-blue-200/60 hover:text-white hover:bg-white/10 transition-all duration-200">

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
                    'text-white font-semibold shadow-lg' :
                    'text-blue-100/70 hover:text-white hover:bg-white/10'}`
                    }
                    style={active ? { background: 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)', boxShadow: '0 4px 12px rgba(14,165,233,0.35)' } : {}}>

                    <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-white' : 'text-blue-300/60'}`} />
                    <span className="font-medium flex-1">{item.name}</span>
                    {active && <ChevronRight className="w-4 h-4 text-white/70" />}
                  </Link>);

              })}
            </nav>
          </div>
        </aside>

        {/* Main */}
        <div className="lg:pl-72">

          {/* Top bar */}
          <header className="sticky top-0 z-30 shadow-md">
            <div className="px-4 py-3 flex items-center justify-between lg:px-6" style={{ background: 'linear-gradient(135deg, #0369a1 0%, #0284c7 60%, #0ea5e9 100%)' }}>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-lg hover:bg-white/15 transition-colors">

                  <Menu className="w-6 h-6 text-white" />
                </button>

                {/* Logo visível no mobile topbar */}
                <div className="flex items-center gap-2 lg:hidden">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, #F5C800 0%, #f97316 100%)', boxShadow: '0 2px 8px rgba(245,200,0,0.4)' }}>
                    {companySettings.company_logo_url ?
                    <img
                      src={companySettings.company_logo_url}
                      alt="Logo"
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
                    />
                    : null}
                    <LogoIcon className={`w-4 h-4 text-white ${companySettings.company_logo_url ? 'hidden' : ''}`} />

                  </div>
                  <span className="font-bold text-white">{currentEmpresa?.nome || companySettings.company_name}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.location.reload()} className="text-white/80 p-2 rounded-lg hover:bg-white/15 transition-colors hover:text-white"

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