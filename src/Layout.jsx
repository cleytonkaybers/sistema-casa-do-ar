import React, { useState } from 'react';
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
  RotateCw
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import ErrorBoundary from '@/components/ErrorBoundary';
import ChatWidget from '@/components/ChatWidget/ChatWidget';
import NotificationCenter from '@/components/NotificationCenter';
import UserMenu from '@/components/UserMenu';
import { EmpresaProvider, useEmpresa } from '@/components/auth/EmpresaGuard';
import SubscriptionBlocker from '@/components/saas/SubscriptionBlocker';

// Icon mapping for company icons
const ICON_MAP = {
  Snowflake,
  Wind,
  Zap,
  Wrench,
  Thermometer,
  Cloud,
  Droplets,
  Settings,
  Database,
  Users,
  LayoutDashboard,
  ClipboardList,
  MessageCircle,
  BarChart3,
  Bell
};

function LayoutContent({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { currentUser, currentEmpresa, isSuperAdmin, isAdminEmpresa } = useEmpresa();

  const [user, setUser] = useState(null);
  const [companySettings, setCompanySettings] = useState({ company_name: 'Casa do Ar', company_icon: 'Snowflake' });

  React.useEffect(() => {
    base44.auth.me().then(user => setUser(user)).catch(() => setUser(null));
    base44.entities.CompanySettings.list().then(result => {
      if (result.length > 0) {
        setCompanySettings(result[0]);
      }
    }).catch(() => {});
  }, []);

  const baseNavigation = [
    { name: 'Dashboard', href: createPageUrl('Dashboard'), icon: LayoutDashboard },
    { name: 'Clientes', href: createPageUrl('Clientes'), icon: Users },
    { name: 'Serviços', href: createPageUrl('Servicos'), icon: ClipboardList },
    { name: 'Atendimentos', href: createPageUrl('Atendimentos'), icon: ClipboardList },
  ];

  const preventivasNavigation = [
    { name: 'Preventivas Futuras', href: createPageUrl('PreventivasFuturas'), icon: ClipboardList },
    { name: 'Histórico de Clientes', href: createPageUrl('HistoricoClientes'), icon: BarChart3 },
  ];

  const superAdminNavigation = [
    { name: 'Gerenciar Empresas', href: createPageUrl('GerenciarEmpresas'), icon: Database },
  ];

  const adminNavigation = [
    { name: 'Relatórios', href: createPageUrl('Relatorios'), icon: BarChart3 },
    { name: 'Backup e Restaurar', href: createPageUrl('BackupRestaurer'), icon: Database },
    { name: 'Usuários', href: createPageUrl('Usuarios'), icon: Users },
    { name: 'Configurações', href: createPageUrl('Configuracoes'), icon: Settings },
    { name: 'Suporte', href: createPageUrl('Suporte'), icon: MessageCircle },
  ];

  const allUsersNavigation = [
    { name: 'Preferências de Notificação', href: createPageUrl('PreferencesNotificacao'), icon: Bell },
  ];

  const navigation = isSuperAdmin() 
    ? [...superAdminNavigation, ...baseNavigation, ...preventivasNavigation, ...adminNavigation, ...allUsersNavigation]
    : currentUser?.tipo_usuario === 'tecnico'
    ? [...baseNavigation, ...preventivasNavigation] 
    : [...baseNavigation, ...preventivasNavigation, ...adminNavigation, ...allUsersNavigation];

  const isActive = (href) => {
    return location.pathname === new URL(href, window.location.origin).pathname;
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen" style={{backgroundColor: '#1e2a3a'}}>
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-gray-900/50 z-40 lg:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`
        fixed top-0 left-0 z-50 h-full w-72 shadow-2xl transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `} style={{backgroundColor: '#0f1923'}}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-6 border-b border-blue-800/50">
            <Link to={isAdminEmpresa() || isSuperAdmin() ? createPageUrl('Configuracoes') : '#'} className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden">
                {companySettings.company_logo_url ? (
                  <img src={companySettings.company_logo_url} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full rounded-xl flex items-center justify-center shadow-2xl" style={{background: 'linear-gradient(135deg, #1e40af, #f59e0b)'}}>
                    {(() => {
                      const Icon = ICON_MAP[companySettings.company_icon];
                      return Icon ? <Icon className="w-7 h-7 text-white" /> : <Snowflake className="w-7 h-7 text-white" />;
                    })()}
                  </div>
                )}
              </div>
              <div>
                <h1 className="font-bold text-white text-lg leading-tight">
                  {currentEmpresa?.nome || companySettings.company_name}
                </h1>
                <p className="text-xs text-blue-300/80">
                  {isSuperAdmin() ? 'Super Admin' : currentUser?.tipo_usuario === 'admin_empresa' ? 'Administrador' : 'Climatização'}
                </p>
              </div>
            </Link>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-blue-800/40 transition-colors"
            >
              <X className="w-5 h-5 text-blue-300" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                    ${active 
                      ? 'text-white shadow-xl' 
                      : 'text-blue-200/80 hover:text-white'
                    }
                  `}
                  style={active ? {background: 'linear-gradient(90deg, #1e40af, #f59e0b)'} : {}}
                >
                  <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-blue-300/60'}`} />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-blue-800/50">
            <Button
              variant="ghost"
              onClick={() => base44.auth.logout()}
              className="w-full justify-start text-blue-200/80 hover:text-red-400 hover:bg-red-500/20"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-72">
        <ChatWidget />
        {/* Top bar */}
        <header className="sticky top-0 z-30 backdrop-blur-lg border-b border-blue-900/50" style={{backgroundColor: 'rgba(15,25,35,0.97)'}}>
          <div className="flex items-center justify-between px-4 lg:px-8 py-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-blue-800/40 transition-colors"
            >
              <Menu className="w-6 h-6 text-blue-300" />
            </button>

            <div className="flex-1 lg:hidden text-center">
              <h1 className="font-bold text-white">Casa do Ar</h1>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-blue-200">Sistema de Clientes</p>
                <p className="text-xs text-blue-300/60">Casa do Ar Climatização</p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="p-2 rounded-lg hover:bg-purple-700/30 transition-colors text-purple-300 hover:text-purple-100"
                title="Atualizar página"
              >
                <RotateCw className="w-5 h-5" />
              </button>
              <NotificationCenter />
              <UserMenu user={user} />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
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