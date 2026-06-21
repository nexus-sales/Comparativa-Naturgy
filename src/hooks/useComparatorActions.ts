import { useState } from "react";
import { supabase } from "../lib/supabase";
import { calc, fmtEur, CHART_COLS } from "../utils/calculations";
import { exportPDF, type ComercialData } from "../utils/pdfExport";
import { exportExcel } from "../utils/excelExport";
import type { SegCliente, TarifaLocal } from "../utils/calculations";
import type { User } from "@supabase/supabase-js";

export interface ComparatorActionsParams {
  user: User;
  segLabel: string;
  taxModel: string;
  potP: number;
  c: SegCliente;
  segTariffs: TarifaLocal[];
  comercialData: ComercialData;
  selectedTariffId?: string;
}

export interface ComparatorResults {
  results: { t: TarifaLocal; r: ReturnType<typeof calc>; color: string }[];
  best: { t: TarifaLocal; r: ReturnType<typeof calc>; color: string };
  bestAh: number;
}

export function buildResults(taxModel: string, potP: number, c: SegCliente, segTariffs: TarifaLocal[]): ComparatorResults {
  const results = segTariffs.map((t, i) => ({ t, r: calc(taxModel, potP, c, t), color: CHART_COLS[i % CHART_COLS.length] }));
  const best = results.reduce((a, b) => b.r.total < a.r.total ? b : a, results[0]);
  const bestAh = +(c.factura - best.r.total).toFixed(2);
  return { results, best, bestAh };
}

export function useComparatorActions({ user, segLabel, taxModel, potP, c, segTariffs, comercialData, selectedTariffId }: ComparatorActionsParams) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [saveMsg, setSaveMsg] = useState('');
  const isSaving = saveStatus === 'saving';

  const showResult = (status: 'success' | 'error', msg: string) => {
    setSaveStatus(status);
    setSaveMsg(msg);
    setTimeout(() => setSaveStatus('idle'), status === 'success' ? 3000 : 5000);
  };

  const { results, best, bestAh } = buildResults(taxModel, potP, c, segTariffs);
  
  // Usar tarifa seleccionada o la mejor por defecto
  const selectedResult = selectedTariffId 
    ? results.find(r => r.t.id === selectedTariffId) || best
    : best;
  const selectedAh = selectedResult ? +(c.factura - selectedResult.r.total).toFixed(2) : bestAh;

  const saveComp = async (act: "SAVE" | "PDF") => {
    if (isSaving || !user) return;
    
    if (!selectedTariffId) {
      showResult('error', 'Selecciona una tarifa válida antes de continuar');
      return;
    }
    if (!selectedResult) return;
    
    setSaveStatus('saving');
    
    const sEsc = (s: unknown): string => typeof s === "string" ? s.replace(/[<>"{}$%]/g, "").trim() : "";
    try {
      const payload = {
        user_id: user.id,
        client_name: sEsc(c.nombre) || "S/N",
        client_address: sEsc(c.dir),
        target_tariff: selectedResult.t.nombre,
        target_segment: segLabel,
        calculation_data: {
          segment: segLabel,
          tax_model: taxModel,
          pot_prices: potP,
          best_tariff: selectedResult.t.nombre,
          total_cost: selectedResult.r.total,
          saving: selectedAh,
          current_invoice: c.factura,
          client_data: { ...c, nombre: sEsc(c.nombre), cups: sEsc(c.cups), dir: sEsc(c.dir) },
          available_tariffs: segTariffs.map(t => ({ ...t, selected: t.id === selectedResult.t.id }))
        }
      };

      const { error } = await supabase.from("client_comparisons").insert(payload);

      if (error) { 
        showResult('error', error.message || 'Error al guardar en base de datos'); 
        return; 
      }
      
      if (act === "SAVE") {
        showResult('success', 'Guardado correctamente');
      } else {
        setSaveStatus('idle');
      }
    } catch (err: unknown) {
      showResult('error', err instanceof Error ? err.message : 'Error desconocido al guardar');
    }
  };

  const handlePDF = () => {
    if (!selectedTariffId) {
      showResult('error', 'Selecciona una tarifa válida antes de continuar');
      return;
    }
    try {
      exportPDF(segLabel, taxModel, potP, c, segTariffs, comercialData, selectedTariffId);
    } catch (e) {
      showResult('error', 'Error al generar PDF: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleExcel = async () => {
    if (!selectedTariffId) {
      showResult('error', 'Selecciona una tarifa válida antes de continuar');
      return;
    }
    try {
      await exportExcel(segLabel, taxModel, potP, c, segTariffs, selectedTariffId);
    } catch (e) {
      showResult('error', 'Error al generar Excel: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  return { saveStatus, saveMsg, isSaving, saveComp, handlePDF, handleExcel };
}

export { fmtEur };
