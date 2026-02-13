import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from './utils';
import { 
  Users, 
  LayoutDashboard, 
  ClipboardList, 
  Menu, 
  X,
  Snowflake,
  LogOut,
  Database,
  MessageCircle
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import ErrorBoundary from '@/components/ErrorBoundary';
import ChatWidget from '@/components/ChatWidget/ChatWidget';

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const [currentUser, setCurrentUser] = useState(null);

  useState(() => {
    base44.auth.me().then(user => setCurrentUser(user)).catch(() => setCurrentUser(null));
  }, []);

  const isAdmin = currentUser?.role === 'admin';

  const navigation = [
    { name: 'Dashboard', href: createPageUrl('Dashboard'), icon: LayoutDashboard },
    { name: 'Clientes', href: createPageUrl('Clientes'), icon: Users },
    { name: 'Serviços', href: createPageUrl('Servicos'), icon: ClipboardList },
    { name: 'Preventivas Futuras', href: createPageUrl('PreventivasFuturas'), icon: ClipboardList },
    { name: 'Atendimentos', href: createPageUrl('Atendimentos'), icon: ClipboardList },
    { name: 'Suporte', href: createPageUrl('Suporte'), icon: MessageCircle },
    { name: 'Backup e Restaurar', href: createPageUrl('BackupRestaurer'), icon: Database },
    ...(isAdmin ? [{ name: 'Usuários', href: createPageUrl('Usuarios'), icon: Users }] : []),
  ];

  const isActive = (href) => {
    return location.pathname === new URL(href, window.location.origin).pathname;
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-gray-900/50 z-40 lg:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`
        fixed top-0 left-0 z-50 h-full w-72 bg-gradient-to-b from-slate-950 via-purple-950 to-slate-950 shadow-2xl transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-6 border-b border-purple-700/50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-2xl shadow-purple-500/50">
                <Snowflake className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-white text-lg leading-tight">Casa do Ar</h1>
                <p className="text-xs text-purple-300/80">Climatização</p>
              </div>
            </div>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-purple-700/30 transition-colors"
            >
              <X className="w-5 h-5 text-purple-300" />
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
                      ? 'bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 text-white shadow-xl shadow-purple-500/50' 
                      : 'text-purple-200/70 hover:bg-purple-700/40 hover:text-purple-100'
                    }
                  `}
                >
                  <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-purple-300/60'}`} />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-purple-700/50">
           <Button
             variant="ghost"
             onClick={() => base44.auth.logout()}
             className="w-full justify-start text-purple-200/80 hover:text-red-400 hover:bg-red-500/20"
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
        <header className="sticky top-0 z-30 bg-gradient-to-r from-slate-900/95 via-purple-900/95 to-slate-900/95 backdrop-blur-lg border-b border-purple-700/30">
          <div className="flex items-center justify-between px-4 lg:px-8 py-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-purple-700/30 transition-colors"
            >
              <Menu className="w-6 h-6 text-purple-300" />
            </button>

            <div className="flex-1 lg:hidden text-center">
              <h1 className="font-bold text-white">Casa do Ar</h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-purple-200">Sistema de Clientes</p>
                <p className="text-xs text-purple-300/60">Casa do Ar Climatização</p>
              </div>
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