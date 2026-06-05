# App Offline — Casa do Ar

Este diretório guarda a **versão offline pronta** do sistema, para baixar direto do GitHub.

## Baixar e usar

1. Abra o arquivo **[CasaDoAr-Offline.html](CasaDoAr-Offline.html)** no GitHub.
2. Clique em **"Download raw file"** (ícone de download, canto superior direito).
3. Salve no computador / pen drive.
4. **Dois cliques** no arquivo → abre no navegador, sem internet.
5. Arraste o backup `.json` do dia → clique **"Abrir o sistema →"**.

> Modo **somente leitura**. Banner amarelo confirma que está rodando do backup.

## Onde pegar o backup `.json`

- **Automático:** backup completo diário no Google Drive (pasta "Backup sistema casa do ar").
- **Manual:** no app online → Admin → **Backup e Restaurar → Exportar → Baixar Backup JSON**.

## Como atualizar este arquivo

Depois de mudanças no código, rode:

```bash
npm run build:offline
```

Isso regenera `dist-offline/index.html` **e** copia para `offline-app/CasaDoAr-Offline.html`.
Faça commit do arquivo atualizado.

Detalhes completos em [../OFFLINE.md](../OFFLINE.md).
