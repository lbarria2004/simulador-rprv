'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Shield, ExternalLink, Award } from 'lucide-react';
import { CompaniasRankingItem } from './types';

interface InsuranceRankingTableProps {
  items: CompaniasRankingItem[];
  valorUF: number;
  tipoPension?: 'vejez' | 'invalidez' | 'sobrevivencia';
}

export function InsuranceRankingTable({ items, valorUF, tipoPension = 'vejez' }: InsuranceRankingTableProps) {
  // Ordenar por mayor pensión
  const sortedItems = React.useMemo(() => {
    return [...items].sort((a, b) => b.pensionUF - a.pensionUF);
  }, [items]);

  const getRatingBadgeColor = (rating: string) => {
    if (rating.startsWith('AAA')) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (rating.startsWith('AA+')) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (rating.startsWith('AA')) return 'bg-indigo-100 text-indigo-800 border-indigo-300';
    return 'bg-amber-100 text-amber-800 border-amber-300';
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-indigo-600 text-white">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Ranking de Ofertas por Compañía de Seguros (CMF / SCOMP)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Basado en las tasas oficiales de colocación reportadas por la CMF
              </CardDescription>
            </div>
          </div>
          <a
            href="https://www.cmfchile.cl/institucional/estadisticas/svtas_param.php?p=tas_int_med_rvp"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
          >
            <span>Ver fuente CMF</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4">
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="text-xs">
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>Compañía Aseguradora</TableHead>
                <TableHead className="text-center">Clasificación Riesgo CMF</TableHead>
                <TableHead className="text-right">Tasa CMF {tipoPension === 'invalidez' ? 'Invalidez' : 'Vejez'}</TableHead>
                <TableHead className="text-right font-bold text-slate-900">Pensión Mensual (UF)</TableHead>
                <TableHead className="text-right font-bold text-slate-900">Pensión Mensual (Pesos)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.map((item, idx) => (
                <TableRow key={item.nombre} className={`text-xs ${idx === 0 ? 'bg-emerald-50/40 font-medium' : ''}`}>
                  <TableCell className="text-center font-mono text-slate-500">
                    {idx === 0 ? (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                        1
                      </span>
                    ) : (
                      idx + 1
                    )}
                  </TableCell>
                  <TableCell className="font-semibold text-slate-900 flex items-center gap-1.5">
                    <span>{item.nombre}</span>
                    {idx === 0 && (
                      <Badge className="bg-emerald-600 text-white text-[9px] py-0 px-1.5 h-4">
                        Mejor Oferta
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={`text-[10px] font-mono font-bold ${getRatingBadgeColor(item.rating)}`}>
                      {item.rating}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-slate-600">
                    {(item.tasaVejez * 100).toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-blue-950">
                    {item.pensionUF.toFixed(2)} UF
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-slate-900">
                    ${item.pensionCLP.toLocaleString('es-CL')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
