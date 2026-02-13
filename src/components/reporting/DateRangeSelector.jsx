import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default function DateRangeSelector({ startDate, endDate, onStartChange, onEndChange, onApply }) {
  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-purple-700/30 rounded-xl p-4 space-y-4">
      <h3 className="font-semibold text-white flex items-center gap-2">
        <Calendar className="w-5 h-5 text-cyan-400" />
        Período
      </h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-gray-300">Data Inicial</Label>
          <Input
            type="date"
            value={format(startDate, 'yyyy-MM-dd')}
            onChange={(e) => onStartChange(new Date(e.target.value))}
            className="bg-slate-700 border-purple-700/50 text-white"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-gray-300">Data Final</Label>
          <Input
            type="date"
            value={format(endDate, 'yyyy-MM-dd')}
            onChange={(e) => onEndChange(new Date(e.target.value))}
            className="bg-slate-700 border-purple-700/50 text-white"
          />
        </div>
      </div>
      
      <Button
        onClick={onApply}
        className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
      >
        Aplicar Filtro
      </Button>
    </div>
  );
}