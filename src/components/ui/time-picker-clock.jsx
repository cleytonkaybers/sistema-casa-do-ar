import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';

export default function TimePickerClock({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('hour'); // 'hour' or 'minute'
  const [selectedHour, setSelectedHour] = useState(value ? parseInt(value.split(':')[0]) : 8);
  const [selectedMinute, setSelectedMinute] = useState(value ? parseInt(value.split(':')[1] || '0') : 0);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  const handleHourClick = (hour) => {
    setSelectedHour(hour);
    setMode('minute');
  };

  const handleMinuteClick = (minute) => {
    setSelectedMinute(minute);
    const timeString = `${String(selectedHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    onChange(timeString);
    setOpen(false);
    setMode('hour');
  };

  const getClockPosition = (value, total) => {
    const angle = (value / total) * 360 - 90;
    const radius = 90;
    const x = 120 + radius * Math.cos((angle * Math.PI) / 180);
    const y = 120 + radius * Math.sin((angle * Math.PI) / 180);
    return { x, y };
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <Clock className="w-4 h-4 mr-2 text-gray-500" />
        <span className="flex-1 text-left">
          {value || 'Selecionar horário'}
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <div className="text-center mb-4">
            <h3 className="text-lg font-semibold mb-2">
              {mode === 'hour' ? 'Selecione a Hora' : 'Selecione os Minutos'}
            </h3>
            <div className="text-3xl font-bold text-purple-600">
              {String(selectedHour).padStart(2, '0')}:{String(selectedMinute).padStart(2, '0')}
            </div>
          </div>

          {mode === 'hour' ? (
            <div className="relative w-60 h-60 mx-auto">
              <svg width="240" height="240" className="absolute inset-0">
                <circle cx="120" cy="120" r="110" fill="none" stroke="#e5e7eb" strokeWidth="2" />
                <circle cx="120" cy="120" r="4" fill="#9333ea" />
                <line
                  x1="120"
                  y1="120"
                  x2={getClockPosition(selectedHour, 24).x}
                  y2={getClockPosition(selectedHour, 24).y}
                  stroke="#9333ea"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              
              {hours.map((hour) => {
                const pos = getClockPosition(hour, 24);
                const isSelected = hour === selectedHour;
                return (
                  <button
                    key={hour}
                    type="button"
                    onClick={() => handleHourClick(hour)}
                    className={`absolute w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all transform -translate-x-1/2 -translate-y-1/2 ${
                      isSelected
                        ? 'bg-purple-600 text-white scale-110 shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-purple-100 hover:text-purple-600'
                    }`}
                    style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
                  >
                    {hour}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="relative w-60 h-60 mx-auto">
              <svg width="240" height="240" className="absolute inset-0">
                <circle cx="120" cy="120" r="110" fill="none" stroke="#e5e7eb" strokeWidth="2" />
                <circle cx="120" cy="120" r="4" fill="#9333ea" />
                <line
                  x1="120"
                  y1="120"
                  x2={getClockPosition(selectedMinute, 60).x}
                  y2={getClockPosition(selectedMinute, 60).y}
                  stroke="#9333ea"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              
              {minutes.map((minute) => {
                const pos = getClockPosition(minute, 60);
                const isSelected = minute === selectedMinute;
                return (
                  <button
                    key={minute}
                    type="button"
                    onClick={() => handleMinuteClick(minute)}
                    className={`absolute w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all transform -translate-x-1/2 -translate-y-1/2 ${
                      isSelected
                        ? 'bg-purple-600 text-white scale-110 shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-purple-100 hover:text-purple-600'
                    }`}
                    style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
                  >
                    {String(minute).padStart(2, '0')}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            {mode === 'minute' && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setMode('hour')}
                className="flex-1"
              >
                Voltar
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}