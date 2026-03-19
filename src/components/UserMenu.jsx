import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { LogOut, User, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function UserMenu({ user }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
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