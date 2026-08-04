import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Plus, X, Save, CheckCircle, Clock, AlertTriangle, Eye, ClipboardCheck, Loader2,
} from 'lucide-react';
import {
  closeProductionOrder,
  createFormula,
  getProductionPlanningWorkspace,
  numeric,
  type InventoryWorkspace,
  type ProductionOrderRecord,
} from '../../services/inventory-production.service';
import { getItemStocks, type ItemStockRecord } from '../../services/manufacturing.service';
import { useToast } from '../../contexts/ToastContext';
import {
  Badge, Field, Table, Th, Td, Drawer, EmptyState, PageHeader, inputCls, selectCls,
} from './AdminUI';

/* ═══════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════ */
type TabProduccion = 'ordenes' | 'formulas';

/* ═══════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════ */
function useProductionPlanningWorkspace() {
  const toast = useToast();
  const [data, setData] = useState<InventoryWorkspace | null>(null);
  const [itemStocks, setItemStocks] = useState<ItemStockRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [workspace, stocks] = await Promise.all([
        getProductionPlanningWorkspace(),
        getItemStocks().catch(() => []),
      ]);
      setData(workspace);
      setItemStocks(stocks);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No fue posible cargar planificación de producción');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  return { data, itemStocks, loading, reload: load };
}

function availableStockByItem(itemStocks: ItemStockRecord[]) {
  const totals = new Map<string, number>();
  for (const stock of itemStocks) {
    totals.set(stock.item, (totals.get(stock.item) ?? 0) + Number(stock.available_quantity));
  }
  return totals;
}

function buildInventoryMaps(data: InventoryWorkspace | null) {
  const units = new Map((data?.units ?? []).map(item => [item.id, item]));
  const items = new Map((data?.items ?? []).map(item => [item.id, item]));
  const formulas = new Map((data?.formulas ?? []).map(item => [item.id, item]));

  return { units, items, formulas };
}

function itemName(data: InventoryWorkspace | null, itemId: string | null | undefined) {
  if (!data || !itemId) return 'Sin artículo';
  return buildInventoryMaps(data).items.get(itemId)?.name ?? 'Sin artículo';
}

function unitLabel(data: InventoryWorkspace | null, unitId: string | null | undefined) {
  if (!data || !unitId) return '';
  return buildInventoryMaps(data).units.get(unitId)?.abbreviation ?? '';
}

function currentDateInput() {
  return new Date().toISOString().slice(0, 10);
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return <tr><td colSpan={colSpan} className="px-4 py-8 text-center text-sm text-gray-400">{label}</td></tr>;
}

/* ═══════════════════════════════════════════════════════
   PLANIFICACIÓN DE PRODUCCIÓN — Órdenes y Fórmulas
═══════════════════════════════════════════════════════ */
export function AdminProductionPlanning({ onCreateBatch, refreshKey }: { onCreateBatch: () => void; refreshKey?: number }) {
  const toast = useToast();
  const { data, itemStocks, loading, reload } = useProductionPlanningWorkspace();

  useEffect(() => {
    if (refreshKey) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);
  const [tab, setTab] = useState<TabProduccion>('ordenes');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cierreOP, setCierreOP] = useState<ProductionOrderRecord | null>(null);
  const [cierreForm, setCierreForm] = useState({ actualQuantity: '', notes: '' });
  const [closing, setClosing] = useState(false);
  const [saving, setSaving] = useState(false);
  const emptyFormulaLine = () => ({ key: Math.random().toString(36).slice(2), item: '', quantity: '' });
  const [formulaForm, setFormulaForm] = useState({ code: '', name: '', outputItem: '', yieldQuantity: '', yieldUnit: '' });
  const [formulaLines, setFormulaLines] = useState([emptyFormulaLine()]);
  const maps = useMemo(() => buildInventoryMaps(data), [data]);
  const stockByItem = useMemo(() => availableStockByItem(itemStocks), [itemStocks]);

  const tabs = [
    { id: 'ordenes' as TabProduccion, label: 'Órdenes de Producción' },
    { id: 'formulas' as TabProduccion, label: 'Fórmulas / Recetas' },
  ];

  const estadoApiColor: Record<string, 'yellow' | 'blue' | 'green' | 'red'> = { PENDING: 'yellow', IN_PROGRESS: 'blue', CLOSED: 'green', VOIDED: 'red' };
  const estadoApiLabel: Record<string, string> = { PENDING: 'Pendiente', IN_PROGRESS: 'En Proceso', CLOSED: 'Cerrada', VOIDED: 'Anulada' };

  const handleCloseOrder = async () => {
    if (!cierreOP || !Number(cierreForm.actualQuantity)) {
      toast.warning('Indica la cantidad real producida.');
      return;
    }
    setClosing(true);
    try {
      await closeProductionOrder({
        id: cierreOP.id,
        actual_quantity: Number(cierreForm.actualQuantity),
        closed_at: currentDateInput(),
        notes: cierreForm.notes,
      });
      toast.success('Orden de producción cerrada');
      setCierreOP(null);
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No fue posible cerrar la OP');
    } finally {
      setClosing(false);
    }
  };

  const validFormulaLines = formulaLines.filter(l => l.item && Number(l.quantity) > 0);

  const handleAddFormulaLine = () => setFormulaLines(lines => [...lines, emptyFormulaLine()]);
  const handleRemoveFormulaLine = (key: string) => setFormulaLines(lines => (lines.length > 1 ? lines.filter(l => l.key !== key) : lines));
  const handleFormulaLineChange = (key: string, field: 'item' | 'quantity', value: string) => {
    setFormulaLines(lines => lines.map(l => (l.key === key ? { ...l, [field]: value } : l)));
  };

  const handleCreateFormula = async () => {
    if (!formulaForm.code || !formulaForm.name || !formulaForm.outputItem || !formulaForm.yieldUnit || !Number(formulaForm.yieldQuantity) || validFormulaLines.length === 0) {
      toast.warning('Completa la fórmula y al menos un ingrediente.');
      return;
    }
    setSaving(true);
    try {
      await createFormula({
        code: formulaForm.code,
        name: formulaForm.name,
        output_item: formulaForm.outputItem,
        yield_quantity: Number(formulaForm.yieldQuantity),
        yield_unit: formulaForm.yieldUnit,
        lines: validFormulaLines.map(l => ({ item: l.item, quantity: Number(l.quantity) })),
      });
      toast.success('Fórmula creada');
      setFormulaForm({ code: '', name: '', outputItem: '', yieldQuantity: '', yieldUnit: '' });
      setFormulaLines([emptyFormulaLine()]);
      setDrawerOpen(false);
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No fue posible crear la fórmula');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 flex-wrap">
        {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${tab === t.id ? 'bg-white text-[#2a4038] shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'}`}>{t.label}</button>)}
      </div>

      {/* ÓRDENES */}
      {tab === 'ordenes' && (
        <>
          <PageHeader title="Órdenes de Producción" subtitle="Planificación y control del proceso productivo" onNew={onCreateBatch} newLabel="Nuevo lote" />
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-5">
            <p className="text-xs text-blue-700 font-medium">
              "Nuevo lote" crea la orden de producción y su expediente GMP en un solo paso, para que toda orden quede desde el inicio bajo trazabilidad de calidad. Para dispensar, fabricar, liberar y ver el detalle del proceso, ve a la pestaña "Expedientes de lote".
            </p>
          </div>
          {loading && !data ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 text-center text-sm text-gray-400">
              <Loader2 size={16} className="inline animate-spin mr-2" /> Cargando órdenes de producción...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                {[
                  { label: 'Pendientes', value: (data?.productionOrders ?? []).filter(o => o.status === 'PENDING').length, color: 'bg-amber-50 text-amber-600 border-amber-100' },
                  { label: 'En Proceso', value: (data?.productionOrders ?? []).filter(o => o.status === 'IN_PROGRESS').length, color: 'bg-blue-50 text-blue-600 border-blue-100' },
                  { label: 'Cerradas (mes)', value: (data?.productionOrders ?? []).filter(o => o.status === 'CLOSED').length, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
                  { label: 'Sin Recepción PT', value: (data?.productionOrders ?? []).filter(o => o.is_dispensed && !o.is_output_received && o.status !== 'PENDING').length, color: 'bg-red-50 text-red-600 border-red-100' },
                ].map(s => <div key={s.label} className={`border rounded-2xl p-4 ${s.color}`}><p className="text-3xl font-bold">{s.value}</p><p className="text-xs font-medium mt-0.5">{s.label}</p></div>)}
              </div>
              <Table>
                <thead><tr><Th>Número</Th><Th>Producto</Th><Th>Plan</Th><Th>Real</Th><Th>Estado</Th><Th>Dispensada</Th><Th>PT Recibido</Th><Th>Responsable</Th><Th>Acciones</Th></tr></thead>
                <tbody>
                  {(data?.productionOrders ?? []).map(op => (
                    <tr key={op.id} className="hover:bg-gray-50/50">
                      <Td><span className="font-mono text-xs font-semibold text-[#2a4038]">{op.number}</span></Td>
                      <Td className="font-medium text-gray-900">{itemName(data, op.output_item)}</Td>
                      <Td className="font-bold">{numeric(op.planned_quantity).toLocaleString()}</Td>
                      <Td className={numeric(op.actual_quantity) > 0 ? 'font-bold text-emerald-600' : 'text-gray-400'}>{numeric(op.actual_quantity) > 0 ? numeric(op.actual_quantity).toLocaleString() : '—'}</Td>
                      <Td><Badge label={estadoApiLabel[op.status]} color={estadoApiColor[op.status]} /></Td>
                      <Td>{op.is_dispensed ? <CheckCircle size={14} className="text-emerald-500" /> : <Clock size={14} className="text-gray-300" />}</Td>
                      <Td>{op.is_output_received ? <CheckCircle size={14} className="text-emerald-500" /> : <Clock size={14} className="text-gray-300" />}</Td>
                      <Td className="text-xs text-gray-500">{op.responsible || '—'}</Td>
                      <Td>
                        <div className="flex gap-1">
                          <button className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600"><Eye size={13} /></button>
                          {op.status === 'IN_PROGRESS' && op.is_dispensed && op.is_output_received && (
                            <button onClick={() => { setCierreOP(op); setCierreForm({ actualQuantity: op.planned_quantity, notes: '' }); }} className="p-1.5 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-600" title="Cerrar orden"><ClipboardCheck size={13} /></button>
                          )}
                        </div>
                      </Td>
                    </tr>
                  ))}
                  {(data?.productionOrders ?? []).length === 0 && <EmptyRow colSpan={9} label="Sin órdenes de producción registradas" />}
                </tbody>
              </Table>
            </>
          )}

          {/* Modal de Cierre de OP */}
          {cierreOP && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCierreOP(null)} />
              <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
                <h3 className="font-bold text-gray-900 text-lg mb-1">Cerrar Orden de Producción</h3>
                <p className="text-xs text-gray-500 mb-5">{cierreOP.number} · {itemName(data, cierreOP.output_item)}</p>
                <div className="space-y-3 mb-6">
                  {[
                    { label: 'Dispensación verificada', ok: cierreOP.is_dispensed },
                    { label: 'Recepción PT registrada', ok: cierreOP.is_output_received },
                    { label: 'Mermas y sobrantes documentados', ok: true },
                  ].map(item => (
                    <div key={item.label} className={`flex items-center gap-3 p-3 rounded-xl ${item.ok ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
                      {item.ok ? <CheckCircle size={16} className="text-emerald-600 flex-shrink-0" /> : <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />}
                      <p className={`text-sm font-medium ${item.ok ? 'text-emerald-700' : 'text-red-700'}`}>{item.label}</p>
                    </div>
                  ))}
                </div>
                <div className="mb-4"><Field label="Cantidad real producida" required><input className={inputCls} type="number" value={cierreForm.actualQuantity} onChange={e => setCierreForm(f => ({ ...f, actualQuantity: e.target.value }))} /></Field></div>
                <div className="mb-5"><Field label="Observaciones de cierre"><textarea className={inputCls + ' resize-none h-14'} placeholder="Notas finales de la orden..." value={cierreForm.notes} onChange={e => setCierreForm(f => ({ ...f, notes: e.target.value }))} /></Field></div>
                <div className="flex gap-3">
                  <button onClick={() => setCierreOP(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Cancelar</button>
                  <button onClick={handleCloseOrder} disabled={closing} className="flex-1 py-2.5 bg-[#2a4038] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">{closing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Confirmar Cierre</button>
                </div>
              </div>
            </div>
          )}

        </>
      )}

      {/* FÓRMULAS */}
      {tab === 'formulas' && (
        <>
          <PageHeader title="Fórmulas y Recetas" subtitle="Composición de ingredientes por producto" onNew={() => setDrawerOpen(true)} newLabel="Nueva Fórmula" />
          {loading && <div className="bg-white border border-gray-100 rounded-2xl p-6 text-center text-sm text-gray-400"><Loader2 size={16} className="inline animate-spin mr-2" /> Cargando fórmulas...</div>}
          {!loading && (data?.formulas ?? []).length === 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
              <EmptyState
                title="Sin fórmulas registradas"
                description="Crea la primera fórmula para poder generar lotes: define el producto resultante, el rendimiento base y los ingredientes."
              />
            </div>
          )}
          {!loading && (data?.formulas ?? []).map(f => (
            <div key={f.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm mb-4">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div><div className="flex items-center gap-2 mb-1"><span className="font-mono text-xs text-gray-400">{f.code}</span><Badge label={itemName(data, f.output_item)} color="green" /></div><h3 className="font-semibold text-gray-900">{f.name}</h3></div>
                <div className="text-right"><p className="text-xs text-gray-500">Rendimiento base</p><p className="text-xl font-bold text-[#2a4038]">{numeric(f.yield_quantity)} {unitLabel(data, f.yield_unit)}</p></div>
              </div>
              <div className="px-5 py-3 overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead><tr className="text-[10px] font-bold uppercase tracking-wider text-gray-400"><th className="py-2 text-left">Ingrediente</th><th className="py-2 text-right">Cantidad</th><th className="py-2 text-right">Und</th><th className="py-2 text-right">%</th><th className="py-2 text-right">Stock disp.</th></tr></thead>
                  <tbody>
                    {f.lines.map((l, index) => {
                      const stockDisp = stockByItem.get(l.item) ?? 0;
                      return (
                        <tr key={l.id ?? index} className="border-t border-gray-50">
                          <td className="py-2.5 font-medium text-gray-800">{itemName(data, l.item)}</td>
                          <td className="py-2.5 text-right font-bold">{numeric(l.quantity)}</td>
                          <td className="py-2.5 text-right text-gray-500">{unitLabel(data, maps.items.get(l.item)?.unit)}</td>
                          <td className="py-2.5 text-right text-gray-500">{numeric(f.yield_quantity) > 0 ? ((numeric(l.quantity) / numeric(f.yield_quantity)) * 100).toFixed(1) : '0.0'}%</td>
                          <td className="py-2.5 text-right"><span className={stockDisp > numeric(l.quantity) ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>{stockDisp > 0 ? stockDisp.toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'Sin stock'}</span></td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-gray-200"><td className="py-2.5 font-bold">Total</td><td className="py-2.5 text-right font-bold">{f.lines.reduce((a, l) => a + numeric(l.quantity), 0).toFixed(1)}</td><td className="py-2.5 text-right text-gray-500">{unitLabel(data, f.yield_unit)}</td><td className="py-2.5 text-right text-[#2a4038] font-bold">{numeric(f.yield_quantity) > 0 ? ((f.lines.reduce((a, l) => a + numeric(l.quantity), 0) / numeric(f.yield_quantity)) * 100).toFixed(1) : '0.0'}%</td><td /></tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <Drawer title="Nueva Fórmula / Receta" open={drawerOpen} onClose={() => setDrawerOpen(false)} wide>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Código" required><input className={inputCls} placeholder="FM-XXX-000" value={formulaForm.code} onChange={e => setFormulaForm(f => ({ ...f, code: e.target.value }))} /></Field>
              <div className="sm:col-span-2"><Field label="Nombre de la fórmula" required><input className={inputCls} placeholder="Nombre descriptivo" value={formulaForm.name} onChange={e => setFormulaForm(f => ({ ...f, name: e.target.value }))} /></Field></div>
              <div className="sm:col-span-2"><Field label="Producto resultante" required><select className={selectCls} value={formulaForm.outputItem} onChange={e => setFormulaForm(f => ({ ...f, outputItem: e.target.value }))}><option value="">Seleccionar producto terminado...</option>{(data?.items ?? []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field></div>
              <Field label="Rendimiento base" required><input className={inputCls} type="number" placeholder="100" value={formulaForm.yieldQuantity} onChange={e => setFormulaForm(f => ({ ...f, yieldQuantity: e.target.value }))} /></Field>
              <Field label="Unidad del rendimiento"><select className={selectCls} value={formulaForm.yieldUnit} onChange={e => setFormulaForm(f => ({ ...f, yieldUnit: e.target.value }))}><option value="">Seleccionar...</option>{(data?.units ?? []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
            </div>
            <div className="mt-5">
              <div className="flex items-center justify-between mb-3"><p className="text-xs font-bold uppercase tracking-wider text-gray-500">Ingredientes</p><button onClick={handleAddFormulaLine} className="text-xs text-[#2a4038] font-semibold flex items-center gap-1"><Plus size={12} /> Agregar línea</button></div>
              <div className="space-y-2">
                {formulaLines.map(line => (
                  <div key={line.key} className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg p-2">
                    <div className="col-span-2 sm:col-span-5"><select className={selectCls + ' text-xs py-2'} value={line.item} onChange={e => handleFormulaLineChange(line.key, 'item', e.target.value)}><option value="">Seleccionar materia prima...</option>{(data?.items ?? []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                    <div className="sm:col-span-3"><input className={inputCls + ' text-xs py-2'} type="number" placeholder="Cantidad" value={line.quantity} onChange={e => handleFormulaLineChange(line.key, 'quantity', e.target.value)} /></div>
                    <div className="sm:col-span-2"><select className={selectCls + ' text-xs py-2'} value={maps.items.get(line.item)?.unit ?? ''} disabled>{(data?.units ?? []).map(u => <option key={u.id} value={u.id}>{u.abbreviation}</option>)}</select></div>
                    <div className="sm:col-span-2 flex justify-center"><button onClick={() => handleRemoveFormulaLine(line.key)} disabled={formulaLines.length === 1} className="p-1 text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"><X size={14} /></button></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3 mt-8 pt-5 border-t border-gray-100">
              <button onClick={() => setDrawerOpen(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={handleCreateFormula} disabled={saving} className="flex-1 py-2.5 bg-[#2a4038] text-white rounded-xl text-sm font-semibold hover:bg-[#3d5c4e] flex items-center justify-center gap-2 disabled:opacity-50">{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar</button>
            </div>
          </Drawer>
        </>
      )}
    </div>
  );
}
