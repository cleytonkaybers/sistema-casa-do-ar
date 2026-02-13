import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ServiceTrendsChart({ data }) {
  return (
    <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border border-purple-700/30">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          📈 Tendência de Serviços
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#404060" />
            <XAxis dataKey="date" stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #7C3AED',
                borderRadius: '8px'
              }}
              labelStyle={{ color: '#FFF' }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#06B6D4"
              name="Total"
              strokeWidth={2}
              dot={{ fill: '#06B6D4' }}
            />
            <Line
              type="monotone"
              dataKey="concluidos"
              stroke="#10B981"
              name="Concluídos"
              strokeWidth={2}
              dot={{ fill: '#10B981' }}
            />
            <Line
              type="monotone"
              dataKey="pendentes"
              stroke="#F97316"
              name="Pendentes"
              strokeWidth={2}
              dot={{ fill: '#F97316' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}