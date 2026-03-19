import { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const EmpresaContext = createContext(null);

export function EmpresaProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentEmpresa, setCurrentEmpresa] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserAndEmpresa();
  }, []);

  const loadUserAndEmpresa = async () => {
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);

      if (user.empresa_id) {
        const empresas = await base44.entities.Empresa.filter({ id: user.empresa_id });
        if (empresas.length > 0) {
          setCurrentEmpresa(empresas[0]);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar usuário:', error);
    } finally {
      setLoading(false);
    }
  };

  const isSuperAdmin = () => currentUser?.tipo_usuario === 'super_admin';
  const isAdminEmpresa = () => currentUser?.tipo_usuario === 'admin_empresa';
  const isTecnico = () => currentUser?.tipo_usuario === 'tecnico';
  
  const hasEmpresaAccess = (empresaId) => {
    if (isSuperAdmin()) return true;
    return currentUser?.empresa_id === empresaId;
  };

  const filterByEmpresa = (items) => {
    if (isSuperAdmin()) return items;
    return items.filter(item => !item.empresa_id || item.empresa_id === currentUser?.empresa_id);
  };

  const value = {
    currentUser,
    currentEmpresa,
    loading,
    isSuperAdmin,
    isAdminEmpresa,
    isTecnico,
    hasEmpresaAccess,
    filterByEmpresa,
    reload: loadUserAndEmpresa
  };

  return (
    <EmpresaContext.Provider value={value}>
      {children}
    </EmpresaContext.Provider>
  );
}

export function useEmpresa() {
  const context = useContext(EmpresaContext);
  if (!context) {
    throw new Error('useEmpresa deve ser usado dentro de EmpresaProvider');
  }
  return context;
}