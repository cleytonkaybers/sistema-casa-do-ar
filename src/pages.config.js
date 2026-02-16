/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Atendimentos from './pages/Atendimentos';
import BackupRestaurer from './pages/BackupRestaurer';
import ClienteDetalhes from './pages/ClienteDetalhes';
import Clientes from './pages/Clientes';
import Configuracoes from './pages/Configuracoes';
import Dashboard from './pages/Dashboard';
import GerenciarEmpresas from './pages/GerenciarEmpresas';
import HistoricoClientes from './pages/HistoricoClientes';
import MigrarDados from './pages/MigrarDados';
import PreferencesNotificacao from './pages/PreferencesNotificacao';
import PreventivasFuturas from './pages/PreventivasFuturas';
import Relatorios from './pages/Relatorios';
import RelatoriosAutomaticos from './pages/RelatoriosAutomaticos';
import Servicos from './pages/Servicos';
import Suporte from './pages/Suporte';
import Usuarios from './pages/Usuarios';
import SaaSLanding from './pages/SaaSLanding';
import CadastroSaaS from './pages/CadastroSaaS';
import DashboardSaaS from './pages/DashboardSaaS';
import ClientesSaaS from './pages/ClientesSaaS';
import OrdensServicoSaaS from './pages/OrdensServicoSaaS';
import RenovacaoPlano from './pages/RenovacaoPlano';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Atendimentos": Atendimentos,
    "BackupRestaurer": BackupRestaurer,
    "ClienteDetalhes": ClienteDetalhes,
    "Clientes": Clientes,
    "Configuracoes": Configuracoes,
    "Dashboard": Dashboard,
    "GerenciarEmpresas": GerenciarEmpresas,
    "HistoricoClientes": HistoricoClientes,
    "MigrarDados": MigrarDados,
    "PreferencesNotificacao": PreferencesNotificacao,
    "PreventivasFuturas": PreventivasFuturas,
    "Relatorios": Relatorios,
    "RelatoriosAutomaticos": RelatoriosAutomaticos,
    "Servicos": Servicos,
    "Suporte": Suporte,
    "Usuarios": Usuarios,
    "SaaSLanding": SaaSLanding,
    "CadastroSaaS": CadastroSaaS,
    "DashboardSaaS": DashboardSaaS,
    "ClientesSaaS": ClientesSaaS,
    "OrdensServicoSaaS": OrdensServicoSaaS,
    "RenovacaoPlano": RenovacaoPlano,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};