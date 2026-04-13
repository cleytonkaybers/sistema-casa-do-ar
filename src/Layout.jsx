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
  ChevronDown,
  DollarSign,
  Trophy } from
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
  const [collapsedSections, setCollapsedSections] = useState({});
  const location = useLocation();
  const { currentUser, currentEmpresa, isSuperAdmin, isAdminEmpresa } = useEmpresa();
  const { user } = useAuth();

  const [companySettings, setCompanySettings] = useState({ company_name: 'Casa do Ar', company_icon: 'Snowflake' });

  React.useEffect(() => {
    base44.entities.CompanySettings.list().then((result) => {
      if (result.length > 0) setCompanySettings(result[0]);
    }).catch(() => {});
  }, []);

  const toggleSection = (key) => setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const isActive = (href) => location.pathname === new URL(href, window.location.origin).pathname;

  // Flat navigation for tecnico (few items, no need to group)
  const tecnicoNav = [
    { name: 'Dashboard', href: createPageUrl('Dashboard'), icon: LayoutDashboard },
    { name: 'Serviços', href: createPageUrl('Servicos'), icon: ClipboardList },
    { name: 'Atendimentos', href: createPageUrl('Atendimentos'), icon: ClipboardList },
    { name: 'Preventivas Futuras', href: createPageUrl('PreventivasFuturas'), icon: ClipboardList },
    { name: 'Meu Financeiro', href: createPageUrl('MeuFinanceiro'), icon: DollarSign },
  ];

  // Grouped navigation for admin users
  const adminNavGroups = [
    {
      key: 'operacional',
      label: 'Operacional',
      items: [
        { name: 'Dashboard', href: createPageUrl('Dashboard'), icon: LayoutDashboard },
        { name: 'Serviços', href: createPageUrl('Servicos'), icon: ClipboardList },
        { name: 'Atendimentos', href: createPageUrl('Atendimentos'), icon: ClipboardList },
        { name: 'Preventivas Futuras', href: createPageUrl('PreventivasFuturas'), icon: ClipboardList },
        { name: 'Clientes', href: createPageUrl('Clientes'), icon: Users },
        { name: 'Agendamentos', href: createPageUrl('Agendamentos'), icon: ClipboardList },
        { name: 'Histórico de Clientes', href: createPageUrl('HistoricoClientes'), icon: BarChart3 },
      ],
    },
    {
      key: 'financeiro',
      label: 'Financeiro',
      items: [
        ...(isAdminEmpresa() || isSuperAdmin() ? [{ name: 'Pagamentos dos Clientes', href: createPageUrl('PagamentosClientes'), icon: DollarSign }] : []),
        { name: 'Financeiro', href: createPageUrl('FinanceiroAdmin'), icon: DollarSign },
        { name: 'Cheques', href: createPageUrl('Cheques'), icon: DollarSign },
        { name: 'Relatório Comissões', href: createPageUrl('RelatorioComissoes'), icon: DollarSign },
        { name: 'Tabela de Serviços', href: createPageUrl('TabelaServicos'), icon: Database },
      ],
    },
    {
      key: 'relatorios',
      label: 'Relatórios',
      items: [
        { name: 'Relatórios', href: createPageUrl('Relatorios'), icon: BarChart3 },
      ],
    },
    {
      key: 'admin',
      label: 'Admin',
      items: [
        { name: 'Ranking de Técnicos', href: '/RankingTecnicos', icon: Trophy },
        { name: 'Usuários', href: createPageUrl('Usuarios'), icon: Users },
        ...(isSuperAdmin() ? [{ name: 'Gerenciar Empresas', href: createPageUrl('GerenciarEmpresas'), icon: Database }] : []),
        { name: 'Logs de Auditoria', href: createPageUrl('LogsAuditoria'), icon: Database },
        { name: 'Backup e Restaurar', href: createPageUrl('BackupRestaurer'), icon: Database },
        { name: 'Configurações', href: createPageUrl('Configuracoes'), icon: Settings },
        { name: 'Suporte', href: createPageUrl('Suporte'), icon: MessageCircle },
        { name: 'Preferências de Notificação', href: createPageUrl('PreferencesNotificacao'), icon: Bell },
      ],
    },
  ];

  const isTecnico = currentUser?.tipo_usuario === 'tecnico' || user?.role === 'user';
  const isAdmin = isAdminEmpresa() || isSuperAdmin();

  const LogoIcon = ICON_MAP[companySettings.company_icon] || Snowflake;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#0d1826]">
        {/* Backdrop mobile com transição suave */}
        <div
          className={`fixed inset-0 bg-[#0d1826]/70 z-40 lg:hidden backdrop-blur-sm transition-opacity duration-300 ${sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Sidebar Moderna */}
        <aside className={`
          fixed top-0 left-0 z-50 h-full w-72 transform transition-transform duration-300 ease-in-out
          lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          bg-[#0A1421] border-r border-white/5
        `}>
          <div className="flex flex-col h-full overflow-hidden">

            {/* Logo / empresa */}
            <div className="flex items-center justify-between px-6 py-6 border-b border-white/5">
              <Link
                to={isAdminEmpresa() || isSuperAdmin() ? createPageUrl('Configuracoes') : '#'}
                className="flex items-center gap-4 hover:opacity-90 transition-opacity w-full">

                {/* Logo box premium */}
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden flex-shrink-0 bg-[#12233a] border border-white/10 shadow-lg shadow-black/20">
                  {companySettings.company_logo_url ?
                  <img
                    src={companySettings.company_logo_url}
                    alt="Logo"
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
                  />
                  : null}
                  <LogoIcon className={`w-7 h-7 text-blue-400 ${companySettings.company_logo_url ? 'hidden' : ''}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-100 text-[15px] leading-tight truncate">
                    {currentEmpresa?.nome || companySettings.company_name}
                  </p>
                  <p className="text-[11px] font-medium text-blue-400 uppercase tracking-wider mt-1 truncate">
                    {isSuperAdmin() ? 'Super Admin' : currentUser?.tipo_usuario === 'admin_empresa' ? 'Administrador' : 'Climatização'}
                  </p>
                  {user?.full_name &&
                  <p className="text-xs text-gray-400 truncate mt-0.5">{user.full_name}</p>
                  }
                </div>
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-2 -mr-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav elegante */}
            <nav className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin scrollbar-thumb-white/10">
              {isTecnico ? (
                /* Flat nav for tecnico */
                <div className="space-y-1">
                  {tecnicoNav.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative overflow-hidden ${
                          active ? 'text-white bg-blue-500/10' : 'text-gray-400 hover:text-gray-100 hover:bg-white/5'
                        }`}
                      >
                        {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r-full" />}
                        <Icon className={`w-5 h-5 flex-shrink-0 transition-colors ${active ? 'text-blue-400' : 'text-gray-500 group-hover:text-blue-300'}`} />
                        <span className={`font-medium text-sm flex-1 ${active ? 'font-semibold' : ''}`}>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                /* Grouped nav for admin */
                <div className="space-y-2">
                  {adminNavGroups.map((group) => {
                    const collapsed = !!collapsedSections[group.key];
                    const hasActive = group.items.some(i => isActive(i.href));
                    return (
                      <div key={group.key}>
                        <button
                          onClick={() => toggleSection(group.key)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors ${
                            hasActive ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
                          } hover:bg-white/5`}
                        >
                          <span className="text-[10px] font-bold uppercase tracking-widest">{group.label}</span>
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`} />
                        </button>
                        {!collapsed && (
                          <div className="mt-1 space-y-0.5">
                            {group.items.map((item) => {
                              const Icon = item.icon;
                              const active = isActive(item.href);
                              return (
                                <Link
                                  key={item.name}
                                  to={item.href}
                                  onClick={() => setSidebarOpen(false)}
                                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative overflow-hidden ${
                                    active ? 'text-white bg-blue-500/10' : 'text-gray-400 hover:text-gray-100 hover:bg-white/5'
                                  }`}
                                >
                                  {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r-full" />}
                                  <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${active ? 'text-blue-400' : 'text-gray-500 group-hover:text-blue-300'}`} />
                                  <span className={`font-medium text-sm flex-1 ${active ? 'font-semibold' : ''}`}>{item.name}</span>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Sair — always at bottom */}
              <button
                onClick={() => base44.auth.logout()}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200 mt-4 group">
                <LogOut className="w-5 h-5 flex-shrink-0 text-red-400 group-hover:text-red-500 transition-colors" />
                <span className="font-medium text-sm">Sair</span>
              </button>
            </nav>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="lg:pl-72 flex flex-col min-h-screen transition-all duration-300">

          {/* Top bar translúcido (Glassmorphism) */}
          <header className="sticky top-0 z-30 bg-[#0d1826]/80 backdrop-blur-lg border-b border-white/5 shadow-sm">
            <div className="px-4 py-3 sm:px-6 flex items-center justify-between min-h-[64px]">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 -ml-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                  <Menu className="w-6 h-6" />
                </button>

                {/* Mobile view Logo simplificado */}
                <div className="flex items-center gap-2 lg:hidden">
                  <span className="font-semibold text-gray-100 truncate max-w-[150px] sm:max-w-[200px]">
                    {currentEmpresa?.nome || companySettings.company_name}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={() => window.location.reload()} 
                  className="text-gray-400 p-2 rounded-xl hover:bg-white/5 hover:text-white transition-colors"
                  title="Atualizar">
                  <RotateCw className="w-5 h-5" />
                </button>
                <div className="relative flex items-center justify-center p-1">
                  <NotificationCenter />
                </div>
                <div className="pl-2 border-l border-white/10 ml-1">
                  <UserMenu user={user} />
                </div>
              </div>
            </div>
          </header>

          {/* Page content padding otimizado para mobile */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default function Layout({ children }) {
  return (
    <SubscriptionBlocker>
      <EmpresaProvider>
        <LayoutContent>{children}</LayoutContent>
      </EmpresaProvider>
    </SubscriptionBlocker>
  );
}