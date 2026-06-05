# Casa do Ar — Modo Offline

Versão de emergência do sistema para usar quando o Base44 estiver fora do ar ou com bug.

## Arquivo

`dist-offline/CasaDoAr-Offline.html` — arquivo único, abre com 2 cliques no navegador.

> Guarde uma cópia deste arquivo em **pen drive** e no **desktop** do computador do ADM.

---

## Como usar

1. Abra `CasaDoAr-Offline.html` no Chrome/Edge (2 cliques).
2. Arraste o **backup do dia** para a tela ou clique para selecionar.
3. Clique **"Abrir o sistema →"** e navegue normalmente.

O banner amarelo **🔌 MODO OFFLINE — somente leitura** fica visível em todas as telas.

---

## Onde pegar o backup

### Opção A — Backup diário automático (recomendado)
A função `backupIncrementalDiario` (agora gera snapshot **completo**) roda 1×/dia via automação
do Base44 e salva no Google Drive na pasta **"Backup sistema casa do ar"**. Baixe o arquivo
`backup_completo_YYYY-MM-DD_Xh.json` do dia mais recente.

### Opção B — Export manual (imediato, qualquer hora)
No app online: **Admin → Backup e Restaurar → Exportar → Baixar Backup JSON**.

Ambos os formatos são aceitos pelo modo offline.

---

## O que funciona (somente leitura)

| Tela                    | Funciona? |
|-------------------------|-----------|
| Dashboard               | ✅        |
| Clientes                | ✅        |
| Serviços                | ✅        |
| Atendimentos            | ✅        |
| Histórico de Clientes   | ✅        |
| Preventivas Futuras     | ✅        |
| Pagamentos dos Clientes | ✅        |
| Financeiro              | ✅        |
| Tabela de Serviços      | ✅        |
| Ranking de Técnicos     | ✅        |
| Agendamentos            | ✅        |
| Backup e Restaurar      | ❌ (servidor) |
| Suporte / Chat LLM      | ❌ (servidor) |
| Notificações / Drive    | ❌ (servidor) |

Ações de escrita (concluir serviço, registrar pagamento, etc.) são bloqueadas — nenhuma alteração é feita.

---

## Gerar um novo `CasaDoAr-Offline.html`

```bash
npm run build:offline
# gera dist-offline/index.html e dist-offline/CasaDoAr-Offline.html
```

Execute depois de atualizações relevantes no app para manter o HTML offline sincronizado com o código.

---

## Arquitetura (resumo técnico)

- `VITE_OFFLINE=1` no build → substitui o cliente Base44 por um adaptador local de leitura
- `src/api/offline/localClient.js` — lê do backup em memória, mesma API do cliente real
- `src/api/offline/entityMap.js` — tabela `key ↔ entidade` compartilhada
- `src/api/offline/OfflineImport.jsx` — tela de importação do backup
- `vite.config.offline.js` + `vite-plugin-singlefile` — embute tudo em um único `.html`
- `HashRouter` no lugar do `BrowserRouter` (necessário para `file://`)
- Produção não é afetada: tree-shaking remove todo o código offline do bundle real
