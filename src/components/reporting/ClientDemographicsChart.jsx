import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ClientDemographicsChart({ data }) {
  return (
    <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border border-purple-700/30">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          👥 Clientes por Tipo de Serviço
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#404060" />
            <XAxis dataKey="name" stroke="#9CA3AF" angle={-45} textAnchor="end" height={100} />
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
            <Bar dataKey="quantidade" fill="#8B5CF6" name="Quantidade" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}