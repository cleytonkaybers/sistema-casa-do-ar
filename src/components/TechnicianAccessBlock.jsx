import { useAuth } from '@/lib/AuthContext';

export default function TechnicianAccessBlock({ children }) {
  const { user } = useAuth();

  const isTechnician = user?.role === 'user' || user?.tipo_usuario === 'tecnico';

  if (isTechnician) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Acesso Negado</h1>
          <p className="text-gray-500">Esta página não está disponível para técnicos.</p>
        </div>
      </div>
    );
  }

  return children;
}