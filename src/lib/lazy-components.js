import { lazy } from 'react';

/**
 * Lazy loading de componentes pesados
 */

// Páginas
export const LazyClientes = lazy(() => import('@/pages/Clientes'));
export const LazyServicos = lazy(() => import('@/pages/Servicos'));
export const LazyAtendimentos = lazy(() => import('@/pages/Atendimentos'));
export const LazyFinanceiroAdmin = lazy(() => import('@/pages/FinanceiroAdmin'));
export const LazyRelatorios = lazy(() => import('@/pages/Relatorios'));
export const LazyHistoricoClientes = lazy(() => import('@/pages/HistoricoClientes'));

// Componentes pesados
export const LazyServicoForm = lazy(() => import('@/components/servicos/ServicoForm'));
export const LazyClienteForm = lazy(() => import('@/components/clientes/ClienteForm'));
export const LazyDetalhesModal = lazy(() => import('@/components/atendimentos/DetalhesModal'));