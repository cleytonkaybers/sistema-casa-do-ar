/**
 * pdfBanner.js
 * Utilitário compartilhado para adicionar o banner da empresa
 * em todos os documentos PDF (jsPDF e window.print).
 *
 * Storage: localStorage (primário) + PDFSettings entity (backup)
 */

const LS_KEY = 'casadoar_pdf_banner_url';

let _imgCache = { url: null, b64: null };

/** Salva a URL do banner no localStorage e limpa o cache de imagem */
export function saveBannerUrl(url) {
  if (url) {
    localStorage.setItem(LS_KEY, url);
  } else {
    localStorage.removeItem(LS_KEY);
  }
  _imgCache = { url: null, b64: null };
}

/** Limpa o cache de imagem em memória (força recarregar na próxima geração) */
export function clearBannerCache() {
  _imgCache = { url: null, b64: null };
}

/**
 * Retorna a URL do banner.
 * Lê do localStorage primeiro; se vazio, tenta a entidade PDFSettings.
 */
export async function getBannerUrl() {
  // 1. localStorage (mais rápido e confiável)
  const local = localStorage.getItem(LS_KEY);
  if (local) return local;

  // 2. Fallback: entidade PDFSettings (caso tenha sido salvo de outro dispositivo)
  try {
    const { base44 } = await import('@/api/base44Client');
    const result = await base44.entities.PDFSettings.list();
    const url = result?.[0]?.banner_url || null;
    if (url) {
      localStorage.setItem(LS_KEY, url); // sincroniza local
      return url;
    }
  } catch {
    // PDFSettings pode não existir — ignora silenciosamente
  }

  return null;
}

/**
 * Converte URL de imagem para base64 via canvas (sem CORS com fetch).
 */
async function urlToBase64(url) {
  if (_imgCache.url === url && _imgCache.b64) return _imgCache.b64;

  const b64 = await new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch (e) {
        // Se canvas falhar por CORS, tenta sem crossOrigin
        const img2 = new Image();
        img2.onload = () => {
          const c2 = document.createElement('canvas');
          c2.width = img2.naturalWidth;
          c2.height = img2.naturalHeight;
          try {
            c2.getContext('2d').drawImage(img2, 0, 0);
            resolve(c2.toDataURL('image/jpeg', 0.92));
          } catch {
            reject(new Error('Canvas tainted'));
          }
        };
        img2.onerror = reject;
        img2.src = url;
      }
    };
    img.onerror = reject;
    img.src = url;
  });

  _imgCache = { url, b64 };
  return b64;
}

/**
 * Adiciona o banner ao topo de um documento jsPDF.
 * @returns {number} Y de onde o conteúdo deve começar
 */
export async function addBannerToDoc(doc, bannerUrl, heightMm = 28) {
  if (!bannerUrl) return 20;
  try {
    const b64 = await urlToBase64(bannerUrl);
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.addImage(b64, 'JPEG', 0, 0, pageWidth, heightMm);
    return heightMm + 6;
  } catch (err) {
    console.warn('[pdfBanner] Banner ignorado:', err?.message || err);
    return 20;
  }
}

/**
 * Retorna a tag <img> do banner para PDFs HTML (window.print).
 */
export function bannerHtmlImg(bannerUrl) {
  if (!bannerUrl) return '';
  return `<img
    src="${bannerUrl}"
    alt="Banner Casa do Ar"
    style="width:100%;max-height:90px;object-fit:cover;display:block;border-radius:6px;margin-bottom:18px"
  />`;
}
