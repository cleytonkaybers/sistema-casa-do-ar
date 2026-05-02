import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import { format, addDays, startOfDay, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Plantao do sabado (periodo da tarde) — uma equipe por vez.
// Sequencia configurada manualmente para os primeiros sabados; depois alterna 1-1.
// Datas em 'YYYY-MM-DD' apontam para qual equipe (1 ou 2) ficou/ficara de plantao.
const OVERRIDES = {
  '2026-04-25': 2, // sabado passado
  '2026-05-02': 2, // este sabado
  '2026-05-09': 1, // proximo
  '2026-05-16': 1, // segundo proximo
};
// A partir desta data, alterna automaticamente comecando pela equipe abaixo.
const INICIO_AUTOMATICO = '2026-05-23';
const EQUIPE_INICIO_AUTOMATICO = 2; // 2026-05-23 sera Equipe 2; 30/05 = E1; 06/06 = E2 ...

function getEquipePlantao(sabado) {
  const key = format(sabado, 'yyyy-MM-dd');
  if (OVERRIDES[key]) return OVERRIDES[key];
  const inicio = new Date(INICIO_AUTOMATICO + 'T00:00:00');
  const diffDias = Math.round((startOfDay(sabado) - startOfDay(inicio)) / (1000 * 60 * 60 * 24));
  const semanas = Math.floor(diffDias / 7);
  if (semanas < 0) return null; // antes da referencia: indeterminado
  // semana 0 = EQUIPE_INICIO_AUTOMATICO; alterna a cada semana
  return semanas % 2 === 0 ? EQUIPE_INICIO_AUTOMATICO : (EQUIPE_INICIO_AUTOMATICO === 1 ? 2 : 1);
}

// Retorna o proximo sabado (ou hoje, se hoje for sabado)
function proximoSabado(d = new Date()) {
  const data = startOfDay(d);
  const diaSemana = data.getDay(); // 0 = dom, 6 = sab
  const diasAteSabado = (6 - diaSemana + 7) % 7; // 0 se hoje for sabado
  return addDays(data, diasAteSabado);
}

// Acha a equipe pelo numero (1 ou 2). Tenta casar por nome "Equipe 1"/"Equipe 2",
// senao usa o indice na lista (0 = Equipe 1, 1 = Equipe 2).
function acharEquipe(equipes, numero) {
  const porNome = equipes.find(e =>
    new RegExp(`equipe\\s*0*${numero}\\b`, 'i').test(e.nome || '')
  );
  if (porNome) return porNome;
  return equipes[numero - 1] || null;
}

const CORES_FALLBACK = { 1: '#3b82f6', 2: '#f59e0b' };

export default function CalendarioPlantao({ equipes = [], qtdSabados = 8 }) {
  const sabados = useMemo(() => {
    const hoje = new Date();
    // Mostra o sabado passado + os proximos N
    const passado = addDays(proximoSabado(hoje), -7);
    return Array.from({ length: qtdSabados + 1 }, (_, i) => addDays(passado, i * 7));
  }, [qtdSabados]);

  const hoje = new Date();
  const proxSab = proximoSabado(hoje);

  return (
    <Card className="bg-[#152236] border-white/5 shadow-sm rounded-2xl">
      <CardHeader className="pb-3 px-4 sm:px-5 pt-4 sm:pt-5 border-b border-white/5">
        <CardTitle className="text-sm font-bold text-gray-200 tracking-wide flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-400" />
          Plantão de Sábado (à tarde)
        </CardTitle>
        <p className="text-[11px] text-gray-500 mt-1">Escala alternada entre Equipe 1 e Equipe 2.</p>
      </CardHeader>
      <CardContent className="p-3 sm:p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {sabados.map((sab) => {
            const numero = getEquipePlantao(sab);
            const equipe = numero ? acharEquipe(equipes, numero) : null;
            const cor = equipe?.cor || (numero ? CORES_FALLBACK[numero] : '#475569');
            const nome = equipe?.nome || (numero ? `Equipe ${numero}` : 'A definir');
            const isPasado = sab < startOfDay(hoje) && !isSameDay(sab, hoje);
            const isProximo = isSameDay(sab, proxSab);

            return (
              <div
                key={sab.toISOString()}
                className={`relative rounded-xl p-3 border transition-all ${
                  isPasado ? 'opacity-50' : ''
                } ${isProximo ? 'ring-2 ring-white/30' : ''}`}
                style={{
                  backgroundColor: cor + '22',
                  borderColor: cor + '55',
                }}
              >
                {isProximo && (
                  <span className="absolute -top-2 left-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white text-gray-800">
                    Próximo
                  </span>
                )}
                <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-0.5">
                  {format(sab, 'EEE', { locale: ptBR })}
                </p>
                <p className="text-base font-bold text-white leading-tight">
                  {format(sab, "dd 'de' MMM", { locale: ptBR })}
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: cor }}
                  />
                  <span className="text-xs font-semibold text-gray-100 truncate">{nome}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
