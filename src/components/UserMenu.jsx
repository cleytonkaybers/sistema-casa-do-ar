import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { LogOut, User, ChevronDown, Smartphone, X } from 'lucide-react';

export default function UserMenu({ user }) {
  const [open, setOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isAndroid = /android/i.test(navigator.userAgent);
  const [showGuide, setShowGuide] = useState(false);
  const [guideType, setGuideType] = useState('android');

  const handleInstall = async () => {
    setOpen(false);
    if (isIOS) {
      setGuideType('ios');
      setShowGuide(true);
      return;
    }
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstallPrompt(null);
        setIsInstalled(true);
      }
      return;
    }
    // Android sem prompt (Edge, Firefox, etc)
    setGuideType('android');
    setShowGuide(true);
  };

  return (
    <div className="relative">
      {showGuide && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60" onClick={() => setShowGuide(false)}>
          <div className="bg-white rounded-t-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-lg">
                {guideType === 'ios' ? 'Instalar no iPhone/iPad' : 'Instalar no Android'}
              </h3>
              <button onClick={() => setShowGuide(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            {guideType === 'android' ? (
              <ol className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start gap-3">
                  <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                  <span>Toque no botão de <strong>menu (...)</strong> no canto inferior ou superior do navegador (Edge/Chrome)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                  <span>Procure a opção <strong>"Adicionar à tela inicial"</strong> ou <strong>"Instalar aplicativo"</strong></span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                  <span>Toque em <strong>"Adicionar"</strong> ou <strong>"Instalar"</strong> para confirmar</span>
                </li>
              </ol>
            ) : (
              <ol className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start gap-3">
                  <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                  <span>Toque no botão <strong>Compartilhar ⬆</strong> na barra do Safari</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                  <span>Role e toque em <strong>"Adicionar à Tela de Início"</strong></span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                  <span>Toque em <strong>"Adicionar"</strong> no canto superior direito</span>
                </li>
              </ol>
            )}
            <p className="text-xs text-gray-400 mt-4 text-center">O app aparecerá na sua tela inicial como um ícone</p>
            <button onClick={() => setShowGuide(false)} className="w-full mt-4 bg-blue-600 text-white py-2.5 rounded-xl font-semibold text-sm">Entendido!</button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-purple-700/30 transition-colors text-purple-200">

        <div className="bg-[#030303] rounded-full w-8 h-8 from-cyan-400 to-purple-600 flex items-center justify-center">
          <span className="bg-[#151414] text-white text-xs font-bold">
            {user?.full_name?.charAt(0).toUpperCase() || '?'}
          </span>
        </div>
        <ChevronDown className="w-4 h-4" />
      </button>

      {open &&
      <>
          <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)} />

          <div className="absolute right-0 mt-2 w-48 bg-slate-950 rounded-lg shadow-xl border border-purple-700/50 z-50">
            <div className="p-3 border-b border-purple-700/30">
              <p className="text-sm font-medium text-purple-200">{user?.full_name}</p>
              <p className="text-xs text-purple-400">{user?.email}</p>
            </div>
            
            <div className="p-2 space-y-2">
              {!isInstalled && (
                <button
                onClick={handleInstall}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-green-300 hover:bg-green-500/20 transition-colors text-sm">
                  <Smartphone className="w-4 h-4" />
                  Instalar App
                </button>
              )}
              <button
              onClick={() => {
                setOpen(false);
                // Futura navegação para perfil
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-purple-200 hover:bg-purple-700/30 transition-colors text-sm">

                <User className="w-4 h-4" />
                Meu Perfil
              </button>
              
              <button
              onClick={() => base44.auth.logout()}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-300 hover:bg-red-500/20 transition-colors text-sm">

                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </div>
          </div>
        </>
      }
    </div>);

}