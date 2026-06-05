import { useState, useRef, useCallback } from 'react';
import { hydrate, getDataDate } from './localClient.js';
import { Upload, FileJson, AlertCircle, CheckCircle2, Loader2, WifiOff } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatDate(iso) {
  if (!iso) return '—';
  try { return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); }
  catch { return iso; }
}

// Tela de importação do backup para o modo offline.
// Exibida quando o store ainda está vazio (nenhum backup carregado).
// Ao importar, chama hydrate() e em seguida onReady() para o App montar normalmente.
export default function OfflineImport({ onReady }) {
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  const processFile = useCallback(async (file) => {
    if (!file || !file.name.endsWith('.json')) {
      setError('Selecione um arquivo .json gerado pela Central de Backup ou pelo backup diário.');
      return;
    }
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      // Aceita v3.0 (data camelCase) e v2.0/semanal (dados snake_case)
      const src = json.data ?? json.dados;
      if (!src || typeof src !== 'object') throw new Error('Formato de backup inválido (sem campo "data" ou "dados").');
      const result = hydrate(json);
      setPreview({ date: json.exported_at ?? json.data_backup, ...result, file: file.name });
    } catch (e) {
      setError('Arquivo inválido: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: '#0a1422' }}>

      {/* Banner modo offline */}
      <div className="flex items-center gap-2 bg-amber-500/15 border border-amber-400/30 rounded-xl px-5 py-3 mb-8 text-amber-300 font-semibold text-sm">
        <WifiOff className="w-4 h-4 flex-shrink-0" />
        MODO OFFLINE — somente leitura — importe o backup para continuar
      </div>

      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-sky-500/20 to-cyan-400/10 border border-cyan-400/20 flex items-center justify-center">
            <FileJson className="w-8 h-8 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-display font-bold text-white tracking-tight">Casa do Ar — Offline</h1>
          <p className="text-gray-400 text-sm mt-2">
            Importe o backup do dia para visualizar os dados sem internet.
          </p>
        </div>

        {/* Drop zone */}
        {!preview && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200
              ${dragOver
                ? 'border-cyan-400 bg-cyan-500/10'
                : 'border-white/10 bg-white/[0.03] hover:border-cyan-400/40 hover:bg-white/5'
              }`}
          >
            {loading ? (
              <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mx-auto mb-3" />
            ) : (
              <Upload className="w-10 h-10 text-gray-500 mx-auto mb-3" />
            )}
            <p className="text-gray-200 font-semibold">
              {loading ? 'Processando...' : 'Arraste o backup aqui'}
            </p>
            <p className="text-gray-500 text-sm mt-1">ou clique para selecionar</p>
            <p className="text-gray-600 text-xs mt-3">
              Arquivos: backup_casa_do_ar_YYYY-MM-DD.json
            </p>
            <input ref={fileRef} type="file" accept=".json,application/json" onChange={handleFile} className="hidden" />
          </div>
        )}

        {/* Erro */}
        {error && (
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Preview / confirmação */}
        {preview && (
          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/15 border border-green-500/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-white text-sm">{preview.file}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {preview.entities.length} entidades · {preview.total.toLocaleString('pt-BR')} registros
                </p>
              </div>
            </div>

            {preview.date && (
              <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl px-4 py-2.5">
                <p className="text-xs text-sky-300 font-semibold">Dados referentes a</p>
                <p className="text-sky-200 font-bold mt-0.5">{formatDate(preview.date)}</p>
              </div>
            )}

            {preview.total === 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300">
                <p className="font-semibold flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Nenhum registro reconhecido neste arquivo</p>
                <p className="text-xs text-red-300/80 mt-1">
                  O arquivo foi lido, mas as seções de dados não foram identificadas. Use um backup
                  gerado em <strong>Central de Backup → Exportar</strong> (ou o backup completo do Drive).
                </p>
                {preview.ignoradas?.length > 0 && (
                  <p className="text-[11px] text-red-300/60 mt-2 break-all">Seções ignoradas: {preview.ignoradas.join(', ')}</p>
                )}
              </div>
            )}

            <button
              onClick={onReady}
              disabled={preview.total === 0}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 text-white font-bold text-base transition-all duration-200 active:scale-[0.98] shadow-lg shadow-sky-900/40 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Abrir o sistema →
            </button>

            <button
              onClick={() => { setPreview(null); setError(null); }}
              className="w-full text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Usar outro arquivo
            </button>
          </div>
        )}

        {/* Instrução */}
        <p className="text-center text-xs text-gray-600">
          Onde encontrar o backup: <span className="text-gray-400">Central de Backup → Exportar → Baixar Backup JSON</span>
          <br />ou aguarde o backup diário automático no Google Drive.
        </p>
      </div>
    </div>
  );
}
