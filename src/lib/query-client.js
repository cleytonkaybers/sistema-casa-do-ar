import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			// Evita re-baixar as mesmas tabelas a cada navegação entre telas.
			// Dados considerados "frescos" por 5 min; mantidos em cache por 30 min.
			staleTime: 5 * 60 * 1000,
			gcTime: 30 * 60 * 1000,
		},
	},
});