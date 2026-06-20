import { useState, useMemo, type ComponentType } from 'react';
import {
  Plus, Search, Edit2, Trash2, X, Save, ChevronRight,
  Warehouse, Package, ArrowRightLeft, Factory,
  BarChart3, Layers, AlertTriangle, CheckCircle, Clock,
  Truck, RefreshCw, FileText, Scale, Box,
  Filter, Download, Eye, ShoppingCart,
  LayoutDashboard, TrendingDown, TrendingUp, Bell,
  MoveRight, Beaker, ClipboardCheck,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════ */
type Modulo = 'panel' | 'maestros' | 'compras' | 'existencias' | 'movimientos' | 'produccion' | 'conversion' | 'reportes' | 'auditoria';
type TabMaestros = 'articulos' | 'bodegas' | 'grupos' | 'tipos' | 'proveedores' | 'unidades';
type TabExistencias = 'por-bodega' | 'por-lote' | 'valorizado' | 'ajustes';
type TabMovimientos = 'todos' | 'traslados';
type TabProduccion = 'ordenes' | 'formulas' | 'dispensacion' | 'recepcion-pt' | 'mermas';

interface Bodega { id: string; codigo: string; nombre: string; tipo: string; responsable: string; activa: boolean; }
interface GrupoArticulo { id: string; codigo: string; nombre: string; tipo: string; articulos: number; }
interface TipoArticulo { id: string; nombre: string; inventariable: boolean; descripcion: string; }
interface Articulo { id: string; codigo: string; nombre: string; tipo: string; grupo: string; unidad: string; costo: number; iva: number; stockMin: number; stockMax: number; activo: boolean; }
interface Proveedor { id: string; nit: string; nombre: string; contacto: string; telefono: string; ciudad: string; activo: boolean; }
interface Unidad { id: string; codigo: string; nombre: string; abreviatura: string; }
interface Stock { id: string; articuloId: string; articulo: string; tipo: string; bodega: string; lote: string; cantidad: number; reservado: number; enProceso: number; costo: number; vencimiento: string; }
interface Movimiento { id: string; fecha: string; tipo: string; articulo: string; bodega: string; cantidad: number; lote: string; usuario: string; motivo: string; }
interface Traslado { id: string; numero: string; fecha: string; bOrigen: string; bDestino: string; articulo: string; cantidad: number; lote: string; estado: 'pendiente' | 'confirmado' | 'anulado'; solicitadoPor: string; }
interface OrdenCompra { id: string; numero: string; proveedor: string; fechaEmision: string; fechaEntrega: string; estado: 'borrador' | 'enviada' | 'parcial' | 'cerrada' | 'anulada'; total: number; lineas: LineaOC[]; }
interface LineaOC { id: string; articulo: string; cantidad: number; precio: number; recibido: number; }
interface OrdenProduccion { id: string; numero: string; producto: string; formula: string; cantidadPlan: number; cantidadReal: number; estado: 'pendiente' | 'en-proceso' | 'cerrada' | 'anulada'; fechaInicio: string; fechaCierre: string; responsable: string; dispensada: boolean; ptRecibido: boolean; }
interface Formula { id: string; codigo: string; nombre: string; producto: string; rendimiento: number; unidad: string; lineas: FormulaLinea[]; }
interface FormulaLinea { id: string; materia: string; cantidad: number; unidad: string; }
interface OrdenDispensacion { id: string; numero: string; ordenProduccion: string; producto: string; lote: string; fecha: string; pesador: string; verificador: string; estado: 'pendiente' | 'pesado' | 'verificado'; lineas: DispensacionLinea[]; }
interface DispensacionLinea { id: string; materia: string; cantidadTeorica: number; cantidadPesada: number; unidad: string; }
interface RecepcionPT { id: string; numero: string; ordenProduccion: string; producto: string; lote: string; cantidadProducida: number; cantidadRecibida: number; cantidadRechazada: number; cantidadDeterioro: number; cajas: number; entregadoPor: string; recibidoPor: string; bodegaDestino: string; estado: 'pendiente' | 'recibido' | 'parcial'; fecha: string; }
interface MermaSobrante { id: string; fecha: string; ordenProduccion: string; tipo: 'merma' | 'sobrante'; articulo: string; cantidad: number; unidad: string; motivo: string; responsable: string; }
interface Conversion { id: string; numero: string; fecha: string; articuloSalida: string; cantidadSalida: number; articuloEntrada: string; cantidadEntrada: number; motivo: string; usuario: string; }
interface AuditoriaLog { id: string; fecha: string; hora: string; usuario: string; modulo: string; accion: string; detalle: string; ip: string; }

/* ═══════════════════════════════════════════════════════
   MOCK DATA
═══════════════════════════════════════════════════════ */
const BODEGAS: Bodega[] = [
  { id: '1', codigo: 'B01', nombre: 'Principal Cosméticos', tipo: 'Materia Prima', responsable: 'Carlos Roldán', activa: true },
  { id: '2', codigo: 'B02', nombre: 'Bodega Producto Terminado', tipo: 'Producto Terminado', responsable: 'Laura Mejía', activa: true },
  { id: '3', codigo: 'B03', nombre: 'Bodega Plástico', tipo: 'Empaque', responsable: 'Luis Herrera', activa: true },
  { id: '4', codigo: 'B04', nombre: 'Producto en Proceso', tipo: 'En Proceso', responsable: 'Ana González', activa: true },
  { id: '5', codigo: 'B05', nombre: 'Inventario Deteriorado', tipo: 'Deteriorados', responsable: 'Carlos Roldán', activa: true },
  { id: '6', codigo: 'B06', nombre: 'Bodega Surtiendas', tipo: 'Distribución', responsable: 'Pedro Vásquez', activa: true },
  { id: '7', codigo: 'B07', nombre: 'PV al Detal Juhnios', tipo: 'Punto de Venta', responsable: 'María Torres', activa: true },
];

const GRUPOS: GrupoArticulo[] = [
  { id: '1', codigo: 'GR01', nombre: 'Materia Prima Granel', tipo: 'Inventariable', articulos: 24 },
  { id: '2', codigo: 'GR02', nombre: 'Materia Prima Líquida', tipo: 'Inventariable', articulos: 18 },
  { id: '3', codigo: 'GR03', nombre: 'Fragancias', tipo: 'Inventariable', articulos: 12 },
  { id: '4', codigo: 'GR04', nombre: 'Colorantes', tipo: 'Inventariable', articulos: 9 },
  { id: '5', codigo: 'GR05', nombre: 'Extractos Naturales', tipo: 'Inventariable', articulos: 15 },
  { id: '6', codigo: 'GR06', nombre: 'Materiales Acondicionamiento', tipo: 'Inventariable', articulos: 31 },
  { id: '7', codigo: 'GR07', nombre: 'Empaque Industrial', tipo: 'Inventariable', articulos: 22 },
  { id: '8', codigo: 'GR08', nombre: 'Producto Terminado', tipo: 'Inventariable', articulos: 47 },
  { id: '9', codigo: 'GR09', nombre: 'Bonificados', tipo: 'Especial', articulos: 6 },
  { id: '10', codigo: 'GR10', nombre: 'Semi Sólidas y Sólidas', tipo: 'Inventariable', articulos: 14 },
];

const TIPOS_ARTICULO: TipoArticulo[] = [
  { id: '1', nombre: 'Materia Prima', inventariable: true, descripcion: 'Insumos base para fabricación' },
  { id: '2', nombre: 'Fragancia', inventariable: true, descripcion: 'Esencias y fragancias cosméticas' },
  { id: '3', nombre: 'Colorante', inventariable: true, descripcion: 'Pigmentos y colorantes' },
  { id: '4', nombre: 'Extracto Natural', inventariable: true, descripcion: 'Extractos botánicos' },
  { id: '5', nombre: 'Material de Empaque', inventariable: true, descripcion: 'Envases, tapas, etiquetas' },
  { id: '6', nombre: 'Material de Acondicionamiento', inventariable: true, descripcion: 'Cajas, embalajes' },
  { id: '7', nombre: 'Producto en Proceso', inventariable: true, descripcion: 'Semielaborados' },
  { id: '8', nombre: 'Producto Terminado', inventariable: true, descripcion: 'Listo para venta' },
  { id: '9', nombre: 'Producto Bonificado', inventariable: true, descripcion: 'Para bonificaciones' },
  { id: '10', nombre: 'Producto Deteriorado', inventariable: true, descripcion: 'Fuera de especificación' },
  { id: '11', nombre: 'Servicio / Concepto', inventariable: false, descripcion: 'No genera movimiento físico' },
];

const ARTICULOS: Articulo[] = [
  { id: '1', codigo: 'MP001', nombre: 'Agua Purificada', tipo: 'Materia Prima', grupo: 'Materia Prima Granel', unidad: 'Kg', costo: 800, iva: 0, stockMin: 100, stockMax: 800, activo: true },
  { id: '2', codigo: 'MP002', nombre: 'Glicerina Vegetal USP', tipo: 'Materia Prima', grupo: 'Materia Prima Granel', unidad: 'Kg', costo: 12500, iva: 19, stockMin: 50, stockMax: 300, activo: true },
  { id: '3', codigo: 'MP003', nombre: 'Betaína de Coco 30%', tipo: 'Materia Prima', grupo: 'Materia Prima Líquida', unidad: 'Kg', costo: 18000, iva: 19, stockMin: 30, stockMax: 150, activo: true },
  { id: '4', codigo: 'MP004', nombre: 'Aceite de Argán Prensado en Frío', tipo: 'Materia Prima', grupo: 'Extractos Naturales', unidad: 'Kg', costo: 145000, iva: 19, stockMin: 10, stockMax: 50, activo: true },
  { id: '5', codigo: 'FR001', nombre: 'Fragancia Coco Tahití', tipo: 'Fragancia', grupo: 'Fragancias', unidad: 'Kg', costo: 85000, iva: 19, stockMin: 5, stockMax: 30, activo: true },
  { id: '6', codigo: 'EM001', nombre: 'Envase PET 400ml Blanco', tipo: 'Material de Empaque', grupo: 'Empaque Industrial', unidad: 'Und', costo: 1200, iva: 19, stockMin: 2000, stockMax: 10000, activo: true },
  { id: '7', codigo: 'EM002', nombre: 'Tapa Flip-Top Negra 38mm', tipo: 'Material de Empaque', grupo: 'Empaque Industrial', unidad: 'Und', costo: 380, iva: 19, stockMin: 2000, stockMax: 10000, activo: true },
  { id: '8', codigo: 'PT001', nombre: 'Shampoo Botánico 400ml', tipo: 'Producto Terminado', grupo: 'Producto Terminado', unidad: 'Und', costo: 8500, iva: 0, stockMin: 200, stockMax: 3000, activo: true },
  { id: '9', codigo: 'PT002', nombre: 'Mascarilla Regeneradora 250g', tipo: 'Producto Terminado', grupo: 'Producto Terminado', unidad: 'Und', costo: 11200, iva: 0, stockMin: 100, stockMax: 1500, activo: true },
  { id: '10', codigo: 'PT003', nombre: 'Sérum Botánico Intensivo 60ml', tipo: 'Producto Terminado', grupo: 'Producto Terminado', unidad: 'Und', costo: 14800, iva: 0, stockMin: 100, stockMax: 1000, activo: true },
];

const PROVEEDORES: Proveedor[] = [
  { id: '1', nit: '900.234.567-1', nombre: 'Químicos Andinos SAS', contacto: 'Hernando Mora', telefono: '601-3456789', ciudad: 'Bogotá', activo: true },
  { id: '2', nit: '860.123.456-8', nombre: 'Aromática del Valle Ltda', contacto: 'Gloria Patiño', telefono: '602-4567890', ciudad: 'Cali', activo: true },
  { id: '3', nit: '811.234.890-3', nombre: 'Envases y Más Colombia', contacto: 'Ricardo Ospina', telefono: '604-5678901', ciudad: 'Medellín', activo: true },
  { id: '4', nit: '830.456.123-9', nombre: 'Ingredientes Naturales SAS', contacto: 'Claudia Ríos', telefono: '601-6789012', ciudad: 'Bogotá', activo: true },
];

const UNIDADES: Unidad[] = [
  { id: '1', codigo: 'KG', nombre: 'Kilogramo', abreviatura: 'Kg' },
  { id: '2', codigo: 'GR', nombre: 'Gramo', abreviatura: 'g' },
  { id: '3', codigo: 'LT', nombre: 'Litro', abreviatura: 'L' },
  { id: '4', codigo: 'ML', nombre: 'Mililitro', abreviatura: 'mL' },
  { id: '5', codigo: 'UN', nombre: 'Unidad', abreviatura: 'Und' },
  { id: '6', codigo: 'CJ', nombre: 'Caja', abreviatura: 'Cja' },
];

const STOCKS: Stock[] = [
  { id: '1', articuloId: '1', articulo: 'Agua Purificada', tipo: 'Materia Prima', bodega: 'Principal Cosméticos', lote: 'L2024-001', cantidad: 450, reservado: 0, enProceso: 80, costo: 800, vencimiento: '2025-12-31' },
  { id: '2', articuloId: '2', articulo: 'Glicerina Vegetal USP', tipo: 'Materia Prima', bodega: 'Principal Cosméticos', lote: 'L2024-002', cantidad: 38, reservado: 0, enProceso: 20, costo: 12500, vencimiento: '2026-06-30' },
  { id: '3', articuloId: '3', articulo: 'Betaína de Coco 30%', tipo: 'Materia Prima', bodega: 'Principal Cosméticos', lote: 'L2024-003', cantidad: 22, reservado: 0, enProceso: 15, costo: 18000, vencimiento: '2025-08-15' },
  { id: '4', articuloId: '4', articulo: 'Aceite de Argán', tipo: 'Materia Prima', bodega: 'Principal Cosméticos', lote: 'L2024-004', cantidad: 8, reservado: 0, enProceso: 5, costo: 145000, vencimiento: '2025-08-20' },
  { id: '5', articuloId: '8', articulo: 'Shampoo Botánico 400ml', tipo: 'Producto Terminado', bodega: 'Bodega Producto Terminado', lote: 'PT2024-018', cantidad: 1240, reservado: 360, enProceso: 0, costo: 8500, vencimiento: '2026-11-30' },
  { id: '6', articuloId: '9', articulo: 'Mascarilla Regeneradora 250g', tipo: 'Producto Terminado', bodega: 'Bodega Producto Terminado', lote: 'PT2024-019', cantidad: 680, reservado: 120, enProceso: 0, costo: 11200, vencimiento: '2026-09-15' },
  { id: '7', articuloId: '10', articulo: 'Sérum Botánico 60ml', tipo: 'Producto Terminado', bodega: 'Bodega Producto Terminado', lote: 'PT2024-020', cantidad: 90, reservado: 80, enProceso: 0, costo: 14800, vencimiento: '2025-07-30' },
  { id: '8', articuloId: '6', articulo: 'Envase PET 400ml', tipo: 'Material de Empaque', bodega: 'Bodega Plástico', lote: 'EM2024-010', cantidad: 4200, reservado: 1200, enProceso: 0, costo: 1200, vencimiento: '' },
];

const MOVIMIENTOS: Movimiento[] = [
  { id: '1', fecha: '2025-06-18', tipo: 'Entrada por Compra', articulo: 'Glicerina Vegetal USP', bodega: 'Principal Cosméticos', cantidad: 50, lote: 'L2024-002', usuario: 'Carlos Roldán', motivo: 'OC-2025-089' },
  { id: '2', fecha: '2025-06-18', tipo: 'Salida a Producción', articulo: 'Agua Purificada', bodega: 'Principal Cosméticos', cantidad: -80, lote: 'L2024-001', usuario: 'Ana González', motivo: 'OP-2025-042' },
  { id: '3', fecha: '2025-06-17', tipo: 'Salida a Producción', articulo: 'Betaína de Coco 30%', bodega: 'Principal Cosméticos', cantidad: -15, lote: 'L2024-003', usuario: 'Ana González', motivo: 'OP-2025-042' },
  { id: '4', fecha: '2025-06-17', tipo: 'Entrada PT', articulo: 'Shampoo Botánico 400ml', bodega: 'Bodega Producto Terminado', cantidad: 480, lote: 'PT2024-018', usuario: 'Laura Mejía', motivo: 'OP-2025-041' },
  { id: '5', fecha: '2025-06-16', tipo: 'Salida por Venta', articulo: 'Sérum Botánico 60ml', bodega: 'Bodega Producto Terminado', cantidad: -24, lote: 'PT2024-020', usuario: 'Sistema', motivo: 'Ecommerce #1089' },
  { id: '6', fecha: '2025-06-15', tipo: 'Ajuste Positivo', articulo: 'Envase PET 400ml', bodega: 'Bodega Plástico', cantidad: 200, lote: 'EM2024-010', usuario: 'Carlos Roldán', motivo: 'Conteo físico junio' },
  { id: '7', fecha: '2025-06-14', tipo: 'Traslado entre Bodegas', articulo: 'Shampoo Botánico 400ml', bodega: 'Bodega Producto Terminado', cantidad: -120, lote: 'PT2024-017', usuario: 'Pedro Vásquez', motivo: 'TRF-2025-008' },
  { id: '8', fecha: '2025-06-14', tipo: 'Devolución Cliente', articulo: 'Mascarilla Regeneradora 250g', bodega: 'Bodega Producto Terminado', cantidad: 5, lote: 'PT2024-019', usuario: 'Sistema', motivo: 'Pedido #1072 devuelto' },
];

const TRASLADOS: Traslado[] = [
  { id: '1', numero: 'TRF-2025-008', fecha: '2025-06-14', bOrigen: 'Bodega Producto Terminado', bDestino: 'Bodega Surtiendas', articulo: 'Shampoo Botánico 400ml', cantidad: 120, lote: 'PT2024-017', estado: 'confirmado', solicitadoPor: 'Pedro Vásquez' },
  { id: '2', numero: 'TRF-2025-009', fecha: '2025-06-18', bOrigen: 'Principal Cosméticos', bDestino: 'Producto en Proceso', articulo: 'Betaína de Coco 30%', cantidad: 9, lote: 'L2024-003', estado: 'pendiente', solicitadoPor: 'Ana González' },
];

const ORDENES_COMPRA: OrdenCompra[] = [
  { id: '1', numero: 'OC-2025-089', proveedor: 'Químicos Andinos SAS', fechaEmision: '2025-06-15', fechaEntrega: '2025-06-18', estado: 'cerrada', total: 1875000, lineas: [{ id: '1', articulo: 'Glicerina Vegetal USP', cantidad: 50, precio: 12500, recibido: 50 }, { id: '2', articulo: 'Betaína de Coco 30%', cantidad: 30, precio: 18000, recibido: 30 }] },
  { id: '2', numero: 'OC-2025-090', proveedor: 'Aromática del Valle Ltda', fechaEmision: '2025-06-16', fechaEntrega: '2025-06-22', estado: 'enviada', total: 1700000, lineas: [{ id: '1', articulo: 'Fragancia Coco Tahití', cantidad: 20, precio: 85000, recibido: 0 }] },
  { id: '3', numero: 'OC-2025-091', proveedor: 'Ingredientes Naturales SAS', fechaEmision: '2025-06-18', fechaEntrega: '2025-06-25', estado: 'borrador', total: 2900000, lineas: [{ id: '1', articulo: 'Aceite de Argán Prensado en Frío', cantidad: 20, precio: 145000, recibido: 0 }] },
  { id: '4', numero: 'OC-2025-088', proveedor: 'Envases y Más Colombia', fechaEmision: '2025-06-10', fechaEntrega: '2025-06-14', estado: 'parcial', total: 7560000, lineas: [{ id: '1', articulo: 'Envase PET 400ml Blanco', cantidad: 5000, precio: 1200, recibido: 3000 }, { id: '2', articulo: 'Tapa Flip-Top Negra 38mm', cantidad: 5000, precio: 380, recibido: 5000 }] },
];

const ORDENES_PRODUCCION: OrdenProduccion[] = [
  { id: '1', numero: 'OP-2025-042', producto: 'Shampoo Botánico 400ml', formula: 'FM-SHB-001', cantidadPlan: 500, cantidadReal: 0, estado: 'en-proceso', fechaInicio: '2025-06-18', fechaCierre: '', responsable: 'Ana González', dispensada: true, ptRecibido: false },
  { id: '2', numero: 'OP-2025-041', producto: 'Mascarilla Regeneradora 250g', formula: 'FM-MAS-003', cantidadPlan: 300, cantidadReal: 298, estado: 'cerrada', fechaInicio: '2025-06-14', fechaCierre: '2025-06-17', responsable: 'Ana González', dispensada: true, ptRecibido: true },
  { id: '3', numero: 'OP-2025-040', producto: 'Sérum Botánico 60ml', formula: 'FM-SER-002', cantidadPlan: 200, cantidadReal: 197, estado: 'cerrada', fechaInicio: '2025-06-10', fechaCierre: '2025-06-13', responsable: 'Pedro Vásquez', dispensada: true, ptRecibido: true },
  { id: '4', numero: 'OP-2025-043', producto: 'Aceite Nutritivo 90ml', formula: 'FM-ACE-004', cantidadPlan: 150, cantidadReal: 0, estado: 'pendiente', fechaInicio: '', fechaCierre: '', responsable: 'Ana González', dispensada: false, ptRecibido: false },
];

const FORMULAS: Formula[] = [
  { id: '1', codigo: 'FM-SHB-001', nombre: 'Shampoo Botánico Base', producto: 'Shampoo Botánico 400ml', rendimiento: 100, unidad: 'Kg', lineas: [{ id: '1', materia: 'Agua Purificada', cantidad: 60.0, unidad: 'Kg' }, { id: '2', materia: 'Betaína de Coco 30%', cantidad: 18.0, unidad: 'Kg' }, { id: '3', materia: 'Glicerina Vegetal USP', cantidad: 5.0, unidad: 'Kg' }, { id: '4', materia: 'Extracto de Aguacate', cantidad: 2.0, unidad: 'Kg' }, { id: '5', materia: 'Aceite de Argán', cantidad: 1.5, unidad: 'Kg' }, { id: '6', materia: 'Fragancia Coco Tahití', cantidad: 1.0, unidad: 'Kg' }, { id: '7', materia: 'Preservante Optiphen', cantidad: 0.5, unidad: 'Kg' }] },
];

const ORDENES_DISPENSACION: OrdenDispensacion[] = [
  { id: '1', numero: 'OD-2025-042', ordenProduccion: 'OP-2025-042', producto: 'Shampoo Botánico 400ml', lote: 'PT2025-021', fecha: '2025-06-18', pesador: 'Jhon Pérez', verificador: 'Ana González', estado: 'verificado', lineas: [{ id: '1', materia: 'Agua Purificada', cantidadTeorica: 30.0, cantidadPesada: 30.02, unidad: 'Kg' }, { id: '2', materia: 'Betaína de Coco 30%', cantidadTeorica: 9.0, cantidadPesada: 9.01, unidad: 'Kg' }, { id: '3', materia: 'Glicerina Vegetal USP', cantidadTeorica: 2.5, cantidadPesada: 2.50, unidad: 'Kg' }] },
];

const RECEPCIONES_PT: RecepcionPT[] = [
  { id: '1', numero: 'RPT-2025-018', ordenProduccion: 'OP-2025-041', producto: 'Mascarilla Regeneradora 250g', lote: 'PT2024-019', cantidadProducida: 300, cantidadRecibida: 298, cantidadRechazada: 1, cantidadDeterioro: 1, cajas: 25, entregadoPor: 'Ana González', recibidoPor: 'Laura Mejía', bodegaDestino: 'Bodega Producto Terminado', estado: 'recibido', fecha: '2025-06-17' },
];

const MERMAS_SOBRANTES: MermaSobrante[] = [
  { id: '1', fecha: '2025-06-17', ordenProduccion: 'OP-2025-041', tipo: 'merma', articulo: 'Glicerina Vegetal USP', cantidad: 0.8, unidad: 'Kg', motivo: 'Adherencia en paredes del reactor', responsable: 'Ana González' },
  { id: '2', fecha: '2025-06-17', ordenProduccion: 'OP-2025-041', tipo: 'sobrante', articulo: 'Agua Purificada', cantidad: 2.5, unidad: 'Kg', motivo: 'Ajuste de viscosidad no requerido', responsable: 'Ana González' },
  { id: '3', fecha: '2025-06-13', ordenProduccion: 'OP-2025-040', tipo: 'merma', articulo: 'Aceite de Argán', cantidad: 0.15, unidad: 'Kg', motivo: 'Merma por trasvase', responsable: 'Pedro Vásquez' },
];

const CONVERSIONES: Conversion[] = [
  { id: '1', numero: 'CV-2025-001', fecha: '2025-06-10', articuloSalida: 'Base Shampoo Granel', cantidadSalida: 50, articuloEntrada: 'Shampoo Botánico 400ml', cantidadEntrada: 120, motivo: 'Envasado lote PT2024-016', usuario: 'Ana González' },
];

const AUDITORIA: AuditoriaLog[] = [
  { id: '1', fecha: '2025-06-18', hora: '09:14', usuario: 'Carlos Roldán', modulo: 'Compras', accion: 'Cierre OC', detalle: 'OC-2025-089 marcada como cerrada. 50 Kg Glicerina recibida.', ip: '192.168.1.10' },
  { id: '2', fecha: '2025-06-18', hora: '09:45', usuario: 'Ana González', modulo: 'Producción', accion: 'Verificación dispensación', detalle: 'OD-2025-042 verificada. Todas las MPC dentro del rango permitido.', ip: '192.168.1.14' },
  { id: '3', fecha: '2025-06-17', hora: '16:30', usuario: 'Laura Mejía', modulo: 'Recepción PT', accion: 'Recepción PT registrada', detalle: 'RPT-2025-018: 298 und Mascarilla recibidas de OP-2025-041.', ip: '192.168.1.12' },
  { id: '4', fecha: '2025-06-17', hora: '17:02', usuario: 'Laura Mejía', modulo: 'Producción', accion: 'Cierre OP', detalle: 'OP-2025-041 cerrada. Plan: 300 und, Real: 298 und. Merma: 2 und.', ip: '192.168.1.12' },
  { id: '5', fecha: '2025-06-16', hora: '11:20', usuario: 'Carlos Roldán', modulo: 'Inventario', accion: 'Ajuste de inventario', detalle: 'Ajuste +200 Und Envase PET 400ml. Motivo: Conteo físico junio.', ip: '192.168.1.10' },
  { id: '6', fecha: '2025-06-15', hora: '08:55', usuario: 'Sistema', modulo: 'Ecommerce', accion: 'Salida por venta', detalle: 'Pedido #1089: 24 und Sérum Botánico descontadas de PT2024-020.', ip: '0.0.0.0' },
];

/* ═══════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════ */
const TODAY = new Date('2025-06-19');

function loteBadge(vencimiento: string): { label: string; color: 'green' | 'yellow' | 'red' | 'gray' } {
  if (!vencimiento) return { label: 'Sin venc.', color: 'gray' };
  const exp = new Date(vencimiento);
  const days = Math.ceil((exp.getTime() - TODAY.getTime()) / 86400000);
  if (days < 0) return { label: 'Vencido', color: 'red' };
  if (days <= 30) return { label: `${days}d`, color: 'red' };
  if (days <= 60) return { label: `${days}d`, color: 'yellow' };
  return { label: 'Vigente', color: 'green' };
}

function stockAlert(articuloId: string): 'ok' | 'low' | 'critical' {
  const art = ARTICULOS.find(a => a.id === articuloId);
  const stock = STOCKS.filter(s => s.articuloId === articuloId).reduce((a, s) => a + s.cantidad, 0);
  if (!art) return 'ok';
  if (stock <= 0) return 'critical';
  if (stock < art.stockMin) return art.stockMin > 0 && stock < art.stockMin * 0.5 ? 'critical' : 'low';
  return 'ok';
}

function Badge({ label, color }: { label: string; color: 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'purple' }) {
  const s = { green: 'bg-emerald-50 text-emerald-700 border border-emerald-200', yellow: 'bg-amber-50 text-amber-700 border border-amber-200', red: 'bg-red-50 text-red-700 border border-red-200', blue: 'bg-blue-50 text-blue-700 border border-blue-200', gray: 'bg-gray-50 text-gray-600 border border-gray-200', purple: 'bg-purple-50 text-purple-700 border border-purple-200' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${s[color]}`}>{label}</span>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5"><label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}{required && <span className="text-red-500 ml-1">*</span>}</label>{children}</div>;
}

const inp = "w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2a4038]/20 focus:border-[#2a4038] transition-all placeholder:text-gray-300";
const sel = "w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2a4038]/20 focus:border-[#2a4038] transition-all";

function Hdr({ title, subtitle, onNew, newLabel }: { title: string; subtitle?: string; onNew?: () => void; newLabel?: string }) {
  return <div className="flex items-center justify-between mb-6"><div><h2 className="text-lg font-semibold text-gray-900">{title}</h2>{subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}</div>{onNew && <button onClick={onNew} className="flex items-center gap-2 px-4 py-2.5 bg-[#2a4038] text-white text-xs font-semibold rounded-xl hover:bg-[#3d5c4e] transition-colors"><Plus size={14} /> {newLabel ?? 'Nuevo'}</button>}</div>;
}

function Tbl({ children }: { children: React.ReactNode }) {
  return <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm"><div className="overflow-x-auto"><table className="w-full text-sm">{children}</table></div></div>;
}

function Th({ children }: { children: React.ReactNode }) { return <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-50 border-b border-gray-100 whitespace-nowrap">{children}</th>; }
function Td({ children, className }: { children: React.ReactNode; className?: string }) { return <td className={`px-4 py-3 border-b border-gray-50 text-sm text-gray-700 ${className ?? ''}`}>{children}</td>; }

function Drawer({ title, open, onClose, wide, children }: { title: string; open: boolean; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex justify-end"><div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} /><div className={`relative bg-white ${wide ? 'w-full max-w-2xl' : 'w-full max-w-xl'} h-full flex flex-col shadow-2xl`}><div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50"><h3 className="font-semibold text-gray-900">{title}</h3><button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-200"><X size={16} /></button></div><div className="flex-1 overflow-y-auto px-6 py-5">{children}</div></div></div>;
}

function SBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder ?? 'Buscar...'} className="pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl w-full bg-white focus:outline-none focus:ring-2 focus:ring-[#2a4038]/20 focus:border-[#2a4038] transition-all" /></div>;
}

function DrawerFooter({ onClose }: { onClose: () => void }) {
  return <div className="flex gap-3 mt-8 pt-5 border-t border-gray-100"><button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</button><button className="flex-1 py-2.5 bg-[#2a4038] text-white rounded-xl text-sm font-semibold hover:bg-[#3d5c4e] flex items-center justify-center gap-2"><Save size={14} /> Guardar</button></div>;
}

/* ═══════════════════════════════════════════════════════
   PANEL — Dashboard KPIs
═══════════════════════════════════════════════════════ */
function ModuloPanel() {
  const totalInventario = STOCKS.reduce((a, s) => a + s.cantidad * s.costo, 0);
  const artBajoMin = ARTICULOS.filter(a => stockAlert(a.id) !== 'ok').length;
  const lotesAlerta = STOCKS.filter(s => { const b = loteBadge(s.vencimiento); return b.color === 'red' || b.color === 'yellow'; }).length;
  const opsActivas = ORDENES_PRODUCCION.filter(op => op.estado === 'en-proceso' || op.estado === 'pendiente').length;
  const ocPendientes = ORDENES_COMPRA.filter(oc => oc.estado === 'enviada' || oc.estado === 'parcial').length;

  const kpis = [
    { label: 'Valor total inventario', value: `$${(totalInventario / 1000000).toFixed(1)}M`, sub: 'Costo sin IVA', icon: BarChart3, color: 'text-[#2a4038] bg-[#2a4038]/10', trend: '+12% vs mes ant.' },
    { label: 'Artículos bajo mínimo', value: String(artBajoMin), sub: 'Requieren compra urgente', icon: TrendingDown, color: 'text-red-600 bg-red-50', trend: 'Ver alertas ↓' },
    { label: 'Lotes por vencer', value: String(lotesAlerta), sub: 'En los próximos 60 días', icon: Clock, color: 'text-amber-600 bg-amber-50', trend: '2 rojos · 1 amarillo' },
    { label: 'OPs activas', value: String(opsActivas), sub: `${ORDENES_PRODUCCION.filter(o => o.estado === 'en-proceso').length} en proceso`, icon: Factory, color: 'text-blue-600 bg-blue-50', trend: '1 sin recepción PT' },
    { label: 'OC pendientes', value: String(ocPendientes), sub: 'Enviadas o parciales', icon: ShoppingCart, color: 'text-purple-600 bg-purple-50', trend: '1 parcial pendiente' },
    { label: 'Movimientos hoy', value: '3', sub: '2 entradas · 1 salida', icon: RefreshCw, color: 'text-emerald-600 bg-emerald-50', trend: 'Último: 09:45' },
  ];

  const alertasStock = ARTICULOS.filter(a => stockAlert(a.id) !== 'ok').map(a => {
    const stock = STOCKS.filter(s => s.articuloId === a.id).reduce((acc, s) => acc + s.cantidad, 0);
    const alert = stockAlert(a.id);
    return { ...a, stockActual: stock, alert };
  });

  const alertasVenc = STOCKS.filter(s => { const b = loteBadge(s.vencimiento); return b.color === 'red' || b.color === 'yellow'; });

  return (
    <div>
      <Hdr title="Panel de Control" subtitle="Resumen del estado actual del inventario y producción" />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {kpis.map(k => (
          <div key={k.label} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${k.color}`}>
                <k.icon size={18} />
              </div>
              <span className="text-[10px] text-gray-400">{k.trend}</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{k.value}</p>
            <p className="text-xs font-medium text-gray-700 mt-0.5">{k.label}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Alertas de stock bajo */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-red-500" />
            <h3 className="text-sm font-semibold text-gray-900">Alertas de Stock Mínimo</h3>
            <span className="ml-auto text-xs text-gray-400">{alertasStock.length} artículos</span>
          </div>
          <div className="space-y-2">
            {alertasStock.length === 0 && <p className="text-xs text-gray-400 py-4 text-center">Sin alertas activas</p>}
            {alertasStock.map(a => (
              <div key={a.id} className={`flex items-center gap-3 p-3 rounded-xl border ${a.alert === 'critical' ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${a.alert === 'critical' ? 'bg-red-500' : 'bg-amber-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900 truncate">{a.nombre}</p>
                  <p className="text-[10px] text-gray-500">Stock: <strong>{a.stockActual} {a.unidad}</strong> · Mín: {a.stockMin} {a.unidad}</p>
                </div>
                <Badge label={a.alert === 'critical' ? 'Crítico' : 'Bajo'} color={a.alert === 'critical' ? 'red' : 'yellow'} />
              </div>
            ))}
          </div>
        </div>

        {/* Alertas de vencimiento */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-900">Lotes próximos a vencer</h3>
            <span className="ml-auto text-xs text-gray-400">{alertasVenc.length} lotes</span>
          </div>
          <div className="space-y-2">
            {alertasVenc.map(s => {
              const lb = loteBadge(s.vencimiento);
              return (
                <div key={s.id} className={`flex items-center gap-3 p-3 rounded-xl border ${lb.color === 'red' ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">{s.articulo}</p>
                    <p className="text-[10px] text-gray-500">Lote: <span className="font-mono">{s.lote}</span> · {s.cantidad} {ARTICULOS.find(a => a.id === s.articuloId)?.unidad ?? 'und'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <Badge label={lb.label} color={lb.color} />
                    <p className="text-[10px] text-gray-400 mt-1">{s.vencimiento}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Últimos movimientos */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Últimos movimientos del día</h3>
        <Tbl>
          <thead><tr><Th>Hora</Th><Th>Tipo</Th><Th>Artículo</Th><Th>Cantidad</Th><Th>Usuario</Th><Th>Referencia</Th></tr></thead>
          <tbody>
            {MOVIMIENTOS.filter(m => m.fecha === '2025-06-18').map(m => (
              <tr key={m.id} className="hover:bg-gray-50/50">
                <Td className="text-gray-400 text-xs">09:{m.id}4</Td>
                <Td><Badge label={m.tipo} color={m.cantidad > 0 ? 'green' : 'red'} /></Td>
                <Td className="font-medium">{m.articulo}</Td>
                <Td><span className={`font-bold ${m.cantidad > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{m.cantidad > 0 ? '+' : ''}{m.cantidad}</span></Td>
                <Td className="text-xs text-gray-500">{m.usuario}</Td>
                <Td className="text-xs text-gray-400">{m.motivo}</Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MÓDULO MAESTROS
═══════════════════════════════════════════════════════ */
function ModuloMaestros() {
  const [tab, setTab] = useState<TabMaestros>('articulos');
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const tabs: { id: TabMaestros; label: string; icon: ComponentType<{ size?: number; className?: string }> }[] = [
    { id: 'articulos', label: 'Artículos', icon: Package },
    { id: 'bodegas', label: 'Bodegas', icon: Warehouse },
    { id: 'grupos', label: 'Grupos', icon: Layers },
    { id: 'tipos', label: 'Tipos', icon: Box },
    { id: 'proveedores', label: 'Proveedores', icon: Truck },
    { id: 'unidades', label: 'Unidades', icon: Scale },
  ];

  return (
    <div>
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 flex-wrap">
        {tabs.map(t => { const Icon = t.icon; return <button key={t.id} onClick={() => { setTab(t.id); setSearch(''); setDrawerOpen(false); }} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${tab === t.id ? 'bg-white text-[#2a4038] shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'}`}><Icon size={12} /> {t.label}</button>; })}
      </div>
      {tab === 'articulos' && <TabArticulos search={search} setSearch={setSearch} drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen} />}
      {tab === 'bodegas' && <TabBodegas search={search} setSearch={setSearch} drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen} />}
      {tab === 'grupos' && <TabGrupos search={search} setSearch={setSearch} drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen} />}
      {tab === 'tipos' && <TabTipos />}
      {tab === 'proveedores' && <TabProveedores search={search} setSearch={setSearch} drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen} />}
      {tab === 'unidades' && <TabUnidades drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen} />}
    </div>
  );
}

function TabArticulos({ search, setSearch, drawerOpen, setDrawerOpen }: { search: string; setSearch: (v: string) => void; drawerOpen: boolean; setDrawerOpen: (v: boolean) => void }) {
  const [filterTipo, setFilterTipo] = useState('');
  const filtered = useMemo(() => ARTICULOS.filter(a => (a.nombre.toLowerCase().includes(search.toLowerCase()) || a.codigo.toLowerCase().includes(search.toLowerCase())) && (!filterTipo || a.tipo === filterTipo)), [search, filterTipo]);
  const tipoColor = (t: string): 'blue' | 'green' | 'purple' | 'yellow' | 'gray' => ({ 'Materia Prima': 'blue', 'Producto Terminado': 'green', 'Fragancia': 'purple', 'Material de Empaque': 'yellow' } as Record<string, 'blue' | 'green' | 'purple' | 'yellow' | 'gray'>)[t] ?? 'gray';

  return (
    <>
      <Hdr title="Artículos" subtitle={`${filtered.length} de ${ARTICULOS.length} artículos`} onNew={() => setDrawerOpen(true)} newLabel="Nuevo Artículo" />
      <div className="flex gap-3 mb-4">
        <div className="flex-1"><SBar value={search} onChange={setSearch} placeholder="Buscar por nombre o código..." /></div>
        <select className={sel + ' w-52'} value={filterTipo} onChange={e => setFilterTipo(e.target.value)}><option value="">Todos los tipos</option>{TIPOS_ARTICULO.filter(t => t.inventariable).map(t => <option key={t.id}>{t.nombre}</option>)}</select>
        <button className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl text-xs text-gray-600 hover:bg-gray-50"><Download size={13} /> Exportar</button>
      </div>
      <Tbl>
        <thead><tr><Th>Código</Th><Th>Nombre</Th><Th>Tipo</Th><Th>Unidad</Th><Th>Costo</Th><Th>Stock Mín.</Th><Th>IVA</Th><Th>Alerta</Th><Th>Estado</Th><Th></Th></tr></thead>
        <tbody>
          {filtered.map(a => {
            const alert = stockAlert(a.id);
            return (
              <tr key={a.id} className="hover:bg-gray-50/50">
                <Td><span className="font-mono text-xs text-gray-500">{a.codigo}</span></Td>
                <Td><span className="font-medium text-gray-900">{a.nombre}</span></Td>
                <Td><Badge label={a.tipo} color={tipoColor(a.tipo)} /></Td>
                <Td className="font-medium">{a.unidad}</Td>
                <Td className="font-semibold">${a.costo.toLocaleString('es-CO')}</Td>
                <Td className="text-gray-500">{a.stockMin} {a.unidad}</Td>
                <Td>{a.iva > 0 ? <Badge label={`${a.iva}%`} color="yellow" /> : <Badge label="Exento" color="gray" />}</Td>
                <Td>{alert === 'critical' ? <Badge label="Crítico" color="red" /> : alert === 'low' ? <Badge label="Bajo" color="yellow" /> : <Badge label="OK" color="green" />}</Td>
                <Td><Badge label={a.activo ? 'Activo' : 'Inactivo'} color={a.activo ? 'green' : 'red'} /></Td>
                <Td><div className="flex gap-1"><button className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600"><Eye size={13} /></button><button className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600"><Edit2 size={13} /></button></div></Td>
              </tr>
            );
          })}
        </tbody>
      </Tbl>
      <Drawer title="Nuevo Artículo" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Código" required><input className={inp} placeholder="Ej: MP005" /></Field>
          <Field label="Código de barras"><input className={inp} placeholder="EAN / UPC" /></Field>
          <div className="col-span-2"><Field label="Nombre del artículo" required><input className={inp} placeholder="Nombre completo" /></Field></div>
          <Field label="Tipo de artículo" required><select className={sel}><option value="">Seleccionar...</option>{TIPOS_ARTICULO.map(t => <option key={t.id}>{t.nombre}</option>)}</select></Field>
          <Field label="Grupo de artículo" required><select className={sel}><option value="">Seleccionar...</option>{GRUPOS.map(g => <option key={g.id}>{g.nombre}</option>)}</select></Field>
          <Field label="Unidad de medida" required><select className={sel}><option value="">Seleccionar...</option>{UNIDADES.map(u => <option key={u.id}>{u.nombre} ({u.abreviatura})</option>)}</select></Field>
          <Field label="Proveedor principal"><select className={sel}><option value="">Ninguno</option>{PROVEEDORES.map(p => <option key={p.id}>{p.nombre}</option>)}</select></Field>
          <Field label="Costo unitario" required><input className={inp} type="number" placeholder="0.00" /></Field>
          <Field label="IVA (%)"><select className={sel}><option value="0">0% — Exento</option><option value="5">5%</option><option value="19">19%</option></select></Field>
          <Field label="Stock mínimo"><input className={inp} type="number" placeholder="0" /></Field>
          <Field label="Stock máximo"><input className={inp} type="number" placeholder="0" /></Field>
          <div className="col-span-2"><Field label="Descripción técnica"><textarea className={inp + ' resize-none h-16'} placeholder="Descripción y especificaciones del artículo..." /></Field></div>
          <div className="col-span-2 flex flex-col gap-2 pt-1">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-[#2a4038]" defaultChecked /> Genera movimiento de inventario</label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-[#2a4038]" /> Maneja lote y fecha de vencimiento</label>
          </div>
        </div>
        <DrawerFooter onClose={() => setDrawerOpen(false)} />
      </Drawer>
    </>
  );
}

function TabBodegas({ search, setSearch, drawerOpen, setDrawerOpen }: { search: string; setSearch: (v: string) => void; drawerOpen: boolean; setDrawerOpen: (v: boolean) => void }) {
  const filtered = useMemo(() => BODEGAS.filter(b => b.nombre.toLowerCase().includes(search.toLowerCase())), [search]);
  return (
    <>
      <Hdr title="Bodegas" subtitle={`${BODEGAS.length} bodegas`} onNew={() => setDrawerOpen(true)} newLabel="Nueva Bodega" />
      <div className="mb-4"><SBar value={search} onChange={setSearch} placeholder="Buscar bodega..." /></div>
      <Tbl>
        <thead><tr><Th>Código</Th><Th>Nombre</Th><Th>Tipo</Th><Th>Responsable</Th><Th>Estado</Th><Th></Th></tr></thead>
        <tbody>{filtered.map(b => <tr key={b.id} className="hover:bg-gray-50/50"><Td><span className="font-mono text-xs">{b.codigo}</span></Td><Td className="font-medium text-gray-900">{b.nombre}</Td><Td><Badge label={b.tipo} color="blue" /></Td><Td className="text-gray-500">{b.responsable}</Td><Td><Badge label={b.activa ? 'Activa' : 'Inactiva'} color={b.activa ? 'green' : 'red'} /></Td><Td><div className="flex gap-1"><button className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600"><Edit2 size={13} /></button><button className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button></div></Td></tr>)}</tbody>
      </Tbl>
      <Drawer title="Nueva Bodega" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Código" required><input className={inp} placeholder="Ej: B08" /></Field>
          <Field label="Tipo de bodega" required><select className={sel}><option>Materia Prima</option><option>Producto Terminado</option><option>Empaque</option><option>En Proceso</option><option>Deteriorados</option><option>Distribución</option><option>Punto de Venta</option></select></Field>
          <div className="col-span-2"><Field label="Nombre de la bodega" required><input className={inp} placeholder="Nombre completo" /></Field></div>
          <div className="col-span-2"><Field label="Responsable" required><select className={sel}><option>Carlos Roldán</option><option>Laura Mejía</option><option>Ana González</option><option>Pedro Vásquez</option></select></Field></div>
          <div className="col-span-2"><Field label="Ubicación física"><input className={inp} placeholder="Área, bloque o dirección" /></Field></div>
          <div className="col-span-2"><Field label="Observaciones"><textarea className={inp + ' resize-none h-14'} placeholder="Notas sobre la bodega..." /></Field></div>
          <div className="col-span-2"><label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-[#2a4038]" defaultChecked /> Bodega activa</label></div>
        </div>
        <DrawerFooter onClose={() => setDrawerOpen(false)} />
      </Drawer>
    </>
  );
}

function TabGrupos({ search, setSearch, drawerOpen, setDrawerOpen }: { search: string; setSearch: (v: string) => void; drawerOpen: boolean; setDrawerOpen: (v: boolean) => void }) {
  const filtered = useMemo(() => GRUPOS.filter(g => g.nombre.toLowerCase().includes(search.toLowerCase())), [search]);
  return (
    <>
      <Hdr title="Grupos de Artículos" subtitle="Clasificación primaria" onNew={() => setDrawerOpen(true)} newLabel="Nuevo Grupo" />
      <div className="mb-4"><SBar value={search} onChange={setSearch} placeholder="Buscar grupo..." /></div>
      <Tbl>
        <thead><tr><Th>Código</Th><Th>Nombre</Th><Th>Tipo</Th><Th>Artículos</Th><Th></Th></tr></thead>
        <tbody>{filtered.map(g => <tr key={g.id} className="hover:bg-gray-50/50"><Td><span className="font-mono text-xs">{g.codigo}</span></Td><Td className="font-medium text-gray-900">{g.nombre}</Td><Td><Badge label={g.tipo} color={g.tipo === 'Inventariable' ? 'green' : 'purple'} /></Td><Td className="font-semibold">{g.articulos}</Td><Td><div className="flex gap-1"><button className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600"><Edit2 size={13} /></button><button className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button></div></Td></tr>)}</tbody>
      </Tbl>
      <Drawer title="Nuevo Grupo de Artículo" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Código" required><input className={inp} placeholder="Ej: GR11" /></Field>
          <Field label="Tipo" required><select className={sel}><option>Inventariable</option><option>Especial</option><option>No Inventariable</option></select></Field>
          <div className="col-span-2"><Field label="Nombre del grupo" required><input className={inp} placeholder="Nombre descriptivo" /></Field></div>
          <div className="col-span-2"><Field label="Descripción"><textarea className={inp + ' resize-none h-14'} placeholder="Descripción del grupo..." /></Field></div>
        </div>
        <DrawerFooter onClose={() => setDrawerOpen(false)} />
      </Drawer>
    </>
  );
}

function TabTipos() {
  return (<><Hdr title="Tipos de Artículo" subtitle="Clasificación técnica para reglas de negocio" /><Tbl><thead><tr><Th>#</Th><Th>Tipo</Th><Th>Inventariable</Th><Th>Descripción</Th></tr></thead><tbody>{TIPOS_ARTICULO.map((t, i) => <tr key={t.id} className="hover:bg-gray-50/50"><Td className="text-gray-400 text-xs">{i + 1}</Td><Td className="font-medium text-gray-900">{t.nombre}</Td><Td><Badge label={t.inventariable ? 'Sí' : 'No'} color={t.inventariable ? 'green' : 'gray'} /></Td><Td className="text-gray-500 text-xs">{t.descripcion}</Td></tr>)}</tbody></Tbl></>);
}

function TabProveedores({ search, setSearch, drawerOpen, setDrawerOpen }: { search: string; setSearch: (v: string) => void; drawerOpen: boolean; setDrawerOpen: (v: boolean) => void }) {
  const filtered = useMemo(() => PROVEEDORES.filter(p => p.nombre.toLowerCase().includes(search.toLowerCase()) || p.nit.includes(search)), [search]);
  return (
    <>
      <Hdr title="Proveedores" subtitle={`${PROVEEDORES.length} proveedores`} onNew={() => setDrawerOpen(true)} newLabel="Nuevo Proveedor" />
      <div className="mb-4"><SBar value={search} onChange={setSearch} placeholder="Buscar por nombre o NIT..." /></div>
      <Tbl>
        <thead><tr><Th>NIT</Th><Th>Razón Social</Th><Th>Contacto</Th><Th>Teléfono</Th><Th>Ciudad</Th><Th>Estado</Th><Th></Th></tr></thead>
        <tbody>{filtered.map(p => <tr key={p.id} className="hover:bg-gray-50/50"><Td><span className="font-mono text-xs">{p.nit}</span></Td><Td className="font-medium text-gray-900">{p.nombre}</Td><Td className="text-gray-500">{p.contacto}</Td><Td className="text-gray-500">{p.telefono}</Td><Td><Badge label={p.ciudad} color="blue" /></Td><Td><Badge label={p.activo ? 'Activo' : 'Inactivo'} color={p.activo ? 'green' : 'red'} /></Td><Td><div className="flex gap-1"><button className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600"><Eye size={13} /></button><button className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600"><Edit2 size={13} /></button></div></Td></tr>)}</tbody>
      </Tbl>
      <Drawer title="Nuevo Proveedor" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="NIT" required><input className={inp} placeholder="000.000.000-0" /></Field>
          <Field label="Tipo persona"><select className={sel}><option>Jurídica</option><option>Natural</option></select></Field>
          <div className="col-span-2"><Field label="Razón social / Nombre" required><input className={inp} placeholder="Nombre completo o razón social" /></Field></div>
          <Field label="Nombre contacto"><input className={inp} placeholder="Nombre del contacto" /></Field>
          <Field label="Cargo"><input className={inp} placeholder="Cargo" /></Field>
          <Field label="Teléfono"><input className={inp} placeholder="Teléfono o celular" /></Field>
          <Field label="Correo"><input className={inp} type="email" placeholder="correo@empresa.com" /></Field>
          <Field label="Ciudad"><input className={inp} placeholder="Ciudad" /></Field>
          <Field label="Departamento"><input className={inp} placeholder="Departamento" /></Field>
          <div className="col-span-2"><Field label="Dirección"><input className={inp} placeholder="Dirección completa" /></Field></div>
          <div className="col-span-2"><Field label="Artículos que provee"><textarea className={inp + ' resize-none h-14'} placeholder="Descripción de los productos suministrados..." /></Field></div>
        </div>
        <DrawerFooter onClose={() => setDrawerOpen(false)} />
      </Drawer>
    </>
  );
}

function TabUnidades({ drawerOpen, setDrawerOpen }: { drawerOpen: boolean; setDrawerOpen: (v: boolean) => void }) {
  return (
    <>
      <Hdr title="Unidades de Medida" onNew={() => setDrawerOpen(true)} newLabel="Nueva Unidad" />
      <Tbl><thead><tr><Th>Código</Th><Th>Nombre</Th><Th>Abreviatura</Th></tr></thead><tbody>{UNIDADES.map(u => <tr key={u.id} className="hover:bg-gray-50/50"><Td><span className="font-mono text-xs">{u.codigo}</span></Td><Td className="font-medium">{u.nombre}</Td><Td className="font-semibold">{u.abreviatura}</Td></tr>)}</tbody></Tbl>
      <Drawer title="Nueva Unidad de Medida" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <div className="grid grid-cols-2 gap-4"><Field label="Código" required><input className={inp} placeholder="Ej: TON" /></Field><Field label="Abreviatura" required><input className={inp} placeholder="Ej: t" /></Field><div className="col-span-2"><Field label="Nombre completo" required><input className={inp} placeholder="Ej: Tonelada" /></Field></div></div>
        <DrawerFooter onClose={() => setDrawerOpen(false)} />
      </Drawer>
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   MÓDULO COMPRAS (NUEVO)
═══════════════════════════════════════════════════════ */
function ModuloCompras() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [recepcionOC, setRecepcionOC] = useState<OrdenCompra | null>(null);
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('');

  const filtered = useMemo(() => ORDENES_COMPRA.filter(oc => (oc.numero.toLowerCase().includes(search.toLowerCase()) || oc.proveedor.toLowerCase().includes(search.toLowerCase())) && (!filterEstado || oc.estado === filterEstado)), [search, filterEstado]);

  const estadoColor: Record<string, 'yellow' | 'blue' | 'green' | 'red' | 'gray'> = { borrador: 'gray', enviada: 'blue', parcial: 'yellow', cerrada: 'green', anulada: 'red' };
  const estadoLabel: Record<string, string> = { borrador: 'Borrador', enviada: 'Enviada', parcial: 'Parcial', cerrada: 'Cerrada', anulada: 'Anulada' };

  const resumen = useMemo(() => ({
    pendientes: ORDENES_COMPRA.filter(oc => oc.estado === 'enviada').length,
    parciales: ORDENES_COMPRA.filter(oc => oc.estado === 'parcial').length,
    cerradas: ORDENES_COMPRA.filter(oc => oc.estado === 'cerrada').length,
    valorTotal: ORDENES_COMPRA.filter(oc => oc.estado !== 'anulada').reduce((a, oc) => a + oc.total, 0),
  }), []);

  return (
    <div>
      <Hdr title="Órdenes de Compra" subtitle="Gestión de compras a proveedores y recepción de mercancía" onNew={() => setDrawerOpen(true)} newLabel="Nueva OC" />

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Enviadas (pendientes)', value: resumen.pendientes, color: 'bg-blue-50 text-blue-600 border-blue-100' },
          { label: 'Recepción parcial', value: resumen.parciales, color: 'bg-amber-50 text-amber-600 border-amber-100' },
          { label: 'Cerradas (mes)', value: resumen.cerradas, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
          { label: 'Valor total', value: `$${(resumen.valorTotal / 1000000).toFixed(1)}M`, color: 'bg-gray-50 text-gray-700 border-gray-100' },
        ].map(s => <div key={s.label} className={`border rounded-2xl p-4 ${s.color}`}><p className="text-3xl font-bold">{s.value}</p><p className="text-xs font-medium mt-0.5">{s.label}</p></div>)}
      </div>

      <div className="flex gap-3 mb-4">
        <div className="flex-1"><SBar value={search} onChange={setSearch} placeholder="Buscar por número o proveedor..." /></div>
        <select className={sel + ' w-44'} value={filterEstado} onChange={e => setFilterEstado(e.target.value)}><option value="">Todos los estados</option><option value="borrador">Borrador</option><option value="enviada">Enviada</option><option value="parcial">Parcial</option><option value="cerrada">Cerrada</option><option value="anulada">Anulada</option></select>
        <button className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl text-xs text-gray-600 hover:bg-gray-50"><Download size={13} /> Exportar</button>
      </div>

      <Tbl>
        <thead><tr><Th>Número</Th><Th>Proveedor</Th><Th>F. Emisión</Th><Th>F. Entrega</Th><Th>Total</Th><Th>Estado</Th><Th>Avance</Th><Th>Acciones</Th></tr></thead>
        <tbody>
          {filtered.map(oc => {
            const totalPedido = oc.lineas.reduce((a, l) => a + l.cantidad, 0);
            const totalRecibido = oc.lineas.reduce((a, l) => a + l.recibido, 0);
            const pct = totalPedido > 0 ? Math.round((totalRecibido / totalPedido) * 100) : 0;
            return (
              <tr key={oc.id} className="hover:bg-gray-50/50">
                <Td><span className="font-mono text-xs font-semibold text-[#2a4038]">{oc.numero}</span></Td>
                <Td className="font-medium text-gray-900">{oc.proveedor}</Td>
                <Td className="text-xs text-gray-500">{oc.fechaEmision}</Td>
                <Td className="text-xs text-gray-500">{oc.fechaEntrega}</Td>
                <Td className="font-semibold">${oc.total.toLocaleString('es-CO')}</Td>
                <Td><Badge label={estadoLabel[oc.estado]} color={estadoColor[oc.estado]} /></Td>
                <Td>
                  <div className="flex items-center gap-2 w-28">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5"><div className="bg-[#2a4038] h-1.5 rounded-full" style={{ width: `${pct}%` }} /></div>
                    <span className="text-[10px] font-semibold text-gray-600 w-8">{pct}%</span>
                  </div>
                </Td>
                <Td>
                  <div className="flex gap-1">
                    <button className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600"><Eye size={13} /></button>
                    {(oc.estado === 'enviada' || oc.estado === 'parcial') && (
                      <button onClick={() => setRecepcionOC(oc)} className="p-1.5 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-600" title="Registrar recepción"><ClipboardCheck size={13} /></button>
                    )}
                    {oc.estado === 'borrador' && <button className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600"><Edit2 size={13} /></button>}
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Tbl>

      {/* Drawer: Nueva OC */}
      <Drawer title="Nueva Orden de Compra" open={drawerOpen} onClose={() => setDrawerOpen(false)} wide>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Número OC" required><input className={inp} placeholder="OC-2025-092" /></Field>
          <Field label="Fecha de emisión" required><input className={inp} type="date" defaultValue="2025-06-19" /></Field>
          <div className="col-span-2"><Field label="Proveedor" required><select className={sel}><option value="">Seleccionar proveedor...</option>{PROVEEDORES.map(p => <option key={p.id}>{p.nombre}</option>)}</select></Field></div>
          <Field label="Fecha de entrega esperada" required><input className={inp} type="date" /></Field>
          <Field label="Condiciones de pago"><select className={sel}><option>Contado</option><option>30 días</option><option>60 días</option><option>Crédito bancario</option></select></Field>
          <div className="col-span-2"><Field label="Dirección de entrega"><input className={inp} placeholder="Dirección de la bodega receptora" /></Field></div>
        </div>
        <div className="mt-5">
          <div className="flex items-center justify-between mb-3"><p className="text-xs font-bold uppercase tracking-wider text-gray-500">Líneas de la OC</p><button className="text-xs text-[#2a4038] font-semibold flex items-center gap-1"><Plus size={12} /> Agregar artículo</button></div>
          <div className="bg-gray-50 rounded-xl p-3 space-y-2">
            <div className="grid grid-cols-12 gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2">
              <div className="col-span-5">Artículo</div><div className="col-span-2">Cantidad</div><div className="col-span-2">Precio Unit.</div><div className="col-span-2">Total</div><div className="col-span-1" />
            </div>
            {[1, 2].map(i => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center bg-white rounded-lg p-2">
                <div className="col-span-5"><select className={sel + ' text-xs py-2'}><option>Seleccionar artículo...</option>{ARTICULOS.slice(0, 5).map(a => <option key={a.id}>{a.nombre}</option>)}</select></div>
                <div className="col-span-2"><input className={inp + ' text-xs py-2'} type="number" placeholder="0" /></div>
                <div className="col-span-2"><input className={inp + ' text-xs py-2'} type="number" placeholder="$0" /></div>
                <div className="col-span-2"><input className={inp + ' text-xs py-2 bg-gray-50'} readOnly placeholder="$0" /></div>
                <div className="col-span-1 flex justify-center"><button className="p-1 text-red-400 hover:text-red-600"><X size={14} /></button></div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-4 mt-4 pr-2">
          <div className="text-right"><p className="text-xs text-gray-500">Subtotal</p><p className="font-bold text-gray-900">$0</p></div>
          <div className="text-right"><p className="text-xs text-gray-500">IVA</p><p className="font-bold text-gray-900">$0</p></div>
          <div className="text-right"><p className="text-xs text-gray-500">Total OC</p><p className="text-lg font-bold text-[#2a4038]">$0</p></div>
        </div>
        <div className="col-span-2 mt-3"><Field label="Observaciones"><textarea className={inp + ' resize-none h-14'} placeholder="Condiciones especiales, notas de entrega..." /></Field></div>
        <DrawerFooter onClose={() => setDrawerOpen(false)} />
      </Drawer>

      {/* Drawer: Recepción de OC */}
      <Drawer title={`Recepción — ${recepcionOC?.numero ?? ''}`} open={!!recepcionOC} onClose={() => setRecepcionOC(null)} wide>
        {recepcionOC && (
          <>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-5 flex gap-2">
              <AlertTriangle size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">Al registrar la recepción se generará automáticamente un movimiento <strong>Entrada por Compra</strong> y se asignará el lote correspondiente en inventario.</p>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <Field label="Fecha de recepción" required><input className={inp} type="date" defaultValue="2025-06-19" /></Field>
              <Field label="Número de factura proveedor"><input className={inp} placeholder="Factura / Remisión" /></Field>
              <Field label="Responsable de recepción" required><input className={inp} placeholder="Nombre del receptor" /></Field>
              <Field label="Bodega de ingreso" required><select className={sel}>{BODEGAS.map(b => <option key={b.id}>{b.nombre}</option>)}</select></Field>
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Artículos recibidos</p>
            <div className="space-y-3">
              {recepcionOC.lineas.map(l => (
                <div key={l.id} className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-semibold text-gray-900">{l.articulo}</p>
                    <div className="text-right"><p className="text-[10px] text-gray-400">Pedido</p><p className="font-bold">{l.cantidad}</p></div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Cantidad recibida" required><input className={inp} type="number" defaultValue={l.recibido} /></Field>
                    <Field label="Lote asignado" required><input className={inp} placeholder="Ej: L2025-010" /></Field>
                    <Field label="Fecha vencimiento"><input className={inp} type="date" /></Field>
                  </div>
                  {l.recibido < l.cantidad && <div className="mt-2 text-xs text-amber-600 flex items-center gap-1"><AlertTriangle size={11} /> Recepción incompleta: quedan {l.cantidad - l.recibido} unidades pendientes</div>}
                </div>
              ))}
            </div>
            <div className="mt-4"><Field label="Observaciones de recepción"><textarea className={inp + ' resize-none h-14'} placeholder="Estado de la mercancía, notas de calidad, etc." /></Field></div>
            <div className="flex gap-3 mt-6 pt-5 border-t border-gray-100">
              <button onClick={() => setRecepcionOC(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button className="flex-1 py-2.5 bg-[#2a4038] text-white rounded-xl text-sm font-semibold hover:bg-[#3d5c4e] flex items-center justify-center gap-2"><Save size={14} /> Confirmar Recepción</button>
            </div>
          </>
        )}
      </Drawer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MÓDULO EXISTENCIAS
═══════════════════════════════════════════════════════ */
function ModuloExistencias() {
  const [tab, setTab] = useState<TabExistencias>('por-bodega');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filterBodega, setFilterBodega] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [search, setSearch] = useState('');

  const filteredStocks = useMemo(() => STOCKS.filter(s =>
    (!filterBodega || s.bodega === filterBodega) &&
    (!filterTipo || s.tipo === filterTipo) &&
    (!search || s.articulo.toLowerCase().includes(search.toLowerCase()) || s.lote.toLowerCase().includes(search.toLowerCase()))
  ), [filterBodega, filterTipo, search]);

  const tabs = ['por-bodega', 'por-lote', 'valorizado', 'ajustes'] as const;
  const tabLabels = { 'por-bodega': 'Por Bodega', 'por-lote': 'Por Lote', valorizado: 'Valorizado', ajustes: 'Ajustes' };

  return (
    <div>
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
        {tabs.map(t => <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${tab === t ? 'bg-white text-[#2a4038] shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'}`}>{tabLabels[t]}</button>)}
      </div>

      {tab === 'por-bodega' && (
        <>
          <Hdr title="Existencias por Bodega" subtitle="Stock disponible, reservado y en proceso por ubicación" />
          <div className="grid grid-cols-4 gap-4 mb-5">
            {[
              { label: 'Artículos activos', value: STOCKS.length, icon: Package, color: 'bg-blue-50 text-blue-600' },
              { label: 'Stock disponible', value: STOCKS.reduce((a, s) => a + s.cantidad, 0).toLocaleString(), icon: CheckCircle, color: 'bg-emerald-50 text-emerald-600' },
              { label: 'Stock reservado', value: STOCKS.reduce((a, s) => a + s.reservado, 0).toLocaleString(), icon: Clock, color: 'bg-amber-50 text-amber-600' },
              { label: 'Bajo mínimo', value: ARTICULOS.filter(a => stockAlert(a.id) !== 'ok').length, icon: AlertTriangle, color: 'bg-red-50 text-red-600' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${s.color}`}><s.icon size={16} /></div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-3 mb-4">
            <select className={sel + ' w-52'} value={filterBodega} onChange={e => setFilterBodega(e.target.value)}><option value="">Todas las bodegas</option>{BODEGAS.map(b => <option key={b.id}>{b.nombre}</option>)}</select>
            <select className={sel + ' w-48'} value={filterTipo} onChange={e => setFilterTipo(e.target.value)}><option value="">Todos los tipos</option>{TIPOS_ARTICULO.filter(t => t.inventariable).map(t => <option key={t.id}>{t.nombre}</option>)}</select>
            <div className="flex-1"><SBar value={search} onChange={setSearch} placeholder="Buscar artículo o lote..." /></div>
          </div>
          <Tbl>
            <thead><tr><Th>Artículo</Th><Th>Bodega</Th><Th>Lote</Th><Th>Disponible</Th><Th>Reservado</Th><Th>En Proceso</Th><Th>Total Físico</Th><Th>Costo Unit.</Th><Th>Vencimiento</Th><Th>Alerta</Th></tr></thead>
            <tbody>
              {filteredStocks.map(s => {
                const total = s.cantidad + s.reservado + s.enProceso;
                const lb = loteBadge(s.vencimiento);
                const alert = stockAlert(s.articuloId);
                return (
                  <tr key={s.id} className="hover:bg-gray-50/50">
                    <Td><span className="font-medium text-gray-900">{s.articulo}</span></Td>
                    <Td><span className="text-xs text-gray-500">{s.bodega}</span></Td>
                    <Td><span className="font-mono text-xs text-gray-500">{s.lote}</span></Td>
                    <Td><span className={`font-bold ${s.cantidad === 0 ? 'text-red-600' : s.cantidad < 20 ? 'text-amber-600' : 'text-emerald-600'}`}>{s.cantidad.toLocaleString()}</span></Td>
                    <Td className="text-amber-600 font-semibold">{s.reservado}</Td>
                    <Td className="text-blue-600 font-semibold">{s.enProceso}</Td>
                    <Td className="font-semibold text-gray-900">{total.toLocaleString()}</Td>
                    <Td>${s.costo.toLocaleString('es-CO')}</Td>
                    <Td>{s.vencimiento ? <span className={lb.color === 'red' ? 'text-red-600 font-semibold' : lb.color === 'yellow' ? 'text-amber-600 font-semibold' : 'text-gray-600'}>{s.vencimiento}</span> : <span className="text-gray-300">—</span>}</Td>
                    <Td>{alert !== 'ok' && <Badge label={alert === 'critical' ? 'Crítico' : 'Bajo'} color={alert === 'critical' ? 'red' : 'yellow'} />}{lb.color !== 'gray' && lb.color !== 'green' && <Badge label={`Vence ${lb.label}`} color={lb.color} />}</Td>
                  </tr>
                );
              })}
              {filteredStocks.length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400 text-sm">Sin resultados para los filtros aplicados</td></tr>}
            </tbody>
          </Tbl>
        </>
      )}

      {tab === 'por-lote' && (
        <>
          <Hdr title="Trazabilidad por Lote" subtitle="Control de lotes, fechas de vencimiento y estado" />
          <div className="mb-4"><SBar value={search} onChange={setSearch} placeholder="Buscar lote o artículo..." /></div>
          <Tbl>
            <thead><tr><Th>Lote</Th><Th>Artículo</Th><Th>Bodega</Th><Th>Cantidad</Th><Th>F. Ingreso</Th><Th>F. Vencimiento</Th><Th>Estado</Th></tr></thead>
            <tbody>
              {STOCKS.filter(s => !search || s.lote.toLowerCase().includes(search.toLowerCase()) || s.articulo.toLowerCase().includes(search.toLowerCase())).map(s => {
                const lb = loteBadge(s.vencimiento);
                return (
                  <tr key={s.id} className="hover:bg-gray-50/50">
                    <Td><span className="font-mono text-xs font-semibold text-[#2a4038]">{s.lote}</span></Td>
                    <Td className="font-medium">{s.articulo}</Td>
                    <Td className="text-gray-500 text-xs">{s.bodega}</Td>
                    <Td className="font-bold">{s.cantidad.toLocaleString()}</Td>
                    <Td className="text-gray-500 text-xs">2025-06-01</Td>
                    <Td>{s.vencimiento || <span className="text-gray-300">N/A</span>}</Td>
                    <Td><Badge label={lb.label} color={lb.color} /></Td>
                  </tr>
                );
              })}
            </tbody>
          </Tbl>
        </>
      )}

      {tab === 'valorizado' && (
        <>
          <Hdr title="Inventario Valorizado" subtitle="Valorización financiera del inventario" />
          <div className="flex gap-3 mb-4">
            <select className={sel + ' w-56'}><option>Costo Unitario sin IVA</option><option>Costo con IVA incluido</option><option>Precio de Venta con IVA</option></select>
            <select className={sel + ' w-48'} value={filterBodega} onChange={e => setFilterBodega(e.target.value)}><option value="">Todas las bodegas</option>{BODEGAS.map(b => <option key={b.id}>{b.nombre}</option>)}</select>
            <input type="date" className={inp + ' w-44'} defaultValue="2025-06-19" />
            <button className="flex items-center gap-2 px-4 py-2.5 bg-[#2a4038] text-white text-xs rounded-xl"><Download size={13} /> Exportar</button>
          </div>
          <Tbl>
            <thead><tr><Th>Artículo</Th><Th>Tipo</Th><Th>Cantidad</Th><Th>Costo Unit.</Th><Th>Total Costo</Th><Th>IVA</Th><Th>Total + IVA</Th></tr></thead>
            <tbody>
              {filteredStocks.map(s => {
                const art = ARTICULOS.find(a => a.id === s.articuloId);
                const tc = s.cantidad * s.costo;
                const tiva = tc * (art?.iva ?? 0) / 100;
                return (
                  <tr key={s.id} className="hover:bg-gray-50/50">
                    <Td className="font-medium">{s.articulo}</Td>
                    <Td><Badge label={art?.tipo ?? '—'} color="gray" /></Td>
                    <Td className="font-semibold">{s.cantidad.toLocaleString()}</Td>
                    <Td>${s.costo.toLocaleString('es-CO')}</Td>
                    <Td className="font-bold text-gray-900">${tc.toLocaleString('es-CO')}</Td>
                    <Td className="text-gray-500">{art?.iva ?? 0}%</Td>
                    <Td className="font-bold text-[#2a4038]">${(tc + tiva).toLocaleString('es-CO', { maximumFractionDigits: 0 })}</Td>
                  </tr>
                );
              })}
              <tr className="bg-gray-50">
                <Td colSpan={4}><span className="font-bold text-gray-900">TOTAL GENERAL</span></Td>
                <Td className="font-bold text-gray-900">${filteredStocks.reduce((a, s) => a + s.cantidad * s.costo, 0).toLocaleString('es-CO')}</Td>
                <Td />
                <Td className="font-bold text-[#2a4038]">${filteredStocks.reduce((a, s) => { const art = ARTICULOS.find(x => x.id === s.articuloId); return a + s.cantidad * s.costo * (1 + (art?.iva ?? 0) / 100); }, 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}</Td>
              </tr>
            </tbody>
          </Tbl>
        </>
      )}

      {tab === 'ajustes' && (
        <>
          <Hdr title="Ajustes de Inventario" subtitle="Correcciones documentadas con motivo y aprobador" onNew={() => setDrawerOpen(true)} newLabel="Nuevo Ajuste" />
          <Tbl>
            <thead><tr><Th>Fecha</Th><Th>Artículo</Th><Th>Bodega</Th><Th>Cant. Sistema</Th><Th>Cant. Física</Th><Th>Diferencia</Th><Th>Motivo</Th><Th>Usuario</Th><Th>Estado</Th></tr></thead>
            <tbody>
              <tr className="hover:bg-gray-50/50"><Td>2025-06-15</Td><Td className="font-medium">Envase PET 400ml</Td><Td className="text-xs text-gray-500">Bodega Plástico</Td><Td>4.000</Td><Td className="font-bold">4.200</Td><Td><span className="text-emerald-600 font-bold">+200</span></Td><Td className="text-xs text-gray-500">Conteo físico junio</Td><Td className="text-xs">Carlos Roldán</Td><Td><Badge label="Aprobado" color="green" /></Td></tr>
              <tr className="hover:bg-gray-50/50"><Td>2025-06-10</Td><Td className="font-medium">Betaína de Coco</Td><Td className="text-xs text-gray-500">Principal Cosméticos</Td><Td>90</Td><Td className="font-bold">85</Td><Td><span className="text-red-600 font-bold">-5</span></Td><Td className="text-xs text-gray-500">Merma por derrame</Td><Td className="text-xs">Ana González</Td><Td><Badge label="Aprobado" color="green" /></Td></tr>
            </tbody>
          </Tbl>
          <Drawer title="Nuevo Ajuste de Inventario" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 flex gap-2">
              <AlertTriangle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">Todo ajuste queda registrado en auditoría. Requiere motivo obligatorio y aprobación de supervisor.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Fecha" required><input className={inp} type="date" defaultValue="2025-06-19" /></Field>
              <Field label="Tipo" required><select className={sel}><option>Ajuste Positivo (+)</option><option>Ajuste Negativo (-)</option></select></Field>
              <div className="col-span-2"><Field label="Artículo" required><select className={sel}><option value="">Seleccionar artículo...</option>{ARTICULOS.map(a => <option key={a.id}>{a.nombre}</option>)}</select></Field></div>
              <Field label="Bodega" required><select className={sel}><option value="">Seleccionar...</option>{BODEGAS.map(b => <option key={b.id}>{b.nombre}</option>)}</select></Field>
              <Field label="Lote"><input className={inp} placeholder="Número de lote" /></Field>
              <Field label="Cantidad en sistema"><input className={inp + ' bg-gray-50'} readOnly placeholder="Se carga al seleccionar" /></Field>
              <Field label="Cantidad física contada" required><input className={inp} type="number" placeholder="0" /></Field>
              <div className="col-span-2"><Field label="Motivo" required><select className={sel}><option>Conteo físico</option><option>Merma por derrame</option><option>Merma por proceso</option><option>Sobrante encontrado</option><option>Deterioro detectado</option><option>Error de registro</option><option>Otro</option></select></Field></div>
              <div className="col-span-2"><Field label="Descripción detallada" required><textarea className={inp + ' resize-none h-16'} placeholder="Descripción completa del motivo del ajuste..." /></Field></div>
              <Field label="Responsable del conteo" required><input className={inp} placeholder="Nombre" /></Field>
              <Field label="Aprobado por" required><input className={inp} placeholder="Supervisor o jefe de bodega" /></Field>
            </div>
            <DrawerFooter onClose={() => setDrawerOpen(false)} />
          </Drawer>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MÓDULO MOVIMIENTOS
═══════════════════════════════════════════════════════ */
function ModuloMovimientos() {
  const [tab, setTab] = useState<TabMovimientos>('todos');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [trasladoDrawer, setTrasladoDrawer] = useState(false);
  const [tipoFilter, setTipoFilter] = useState('');
  const [bodegaFilter, setBodegaFilter] = useState('');
  const [search, setSearch] = useState('');

  const tiposMovimiento = ['Entrada por Compra', 'Salida a Producción', 'Entrada PT', 'Salida por Venta', 'Traslado entre Bodegas', 'Ajuste Positivo', 'Ajuste Negativo', 'Devolución Cliente', 'Devolución Proveedor', 'Deterioro', 'Bonificación', 'Merma', 'Sobrante'];
  const movColor = (tipo: string): 'green' | 'red' | 'blue' | 'yellow' | 'gray' => {
    if (tipo.includes('Entrada') || tipo.includes('Sobrante') || tipo.includes('Positivo') || tipo.includes('Devolución')) return tipo.includes('Proveedor') ? 'green' : tipo.includes('Cliente') ? 'yellow' : 'green';
    if (tipo.includes('Salida') || tipo.includes('Negativo') || tipo.includes('Deterioro') || tipo.includes('Merma')) return 'red';
    if (tipo.includes('Traslado')) return 'blue';
    return 'gray';
  };

  const filteredMovs = useMemo(() => MOVIMIENTOS.filter(m =>
    (!tipoFilter || m.tipo === tipoFilter) &&
    (!bodegaFilter || m.bodega === bodegaFilter) &&
    (!search || m.articulo.toLowerCase().includes(search.toLowerCase()) || m.motivo.toLowerCase().includes(search.toLowerCase()) || m.lote.toLowerCase().includes(search.toLowerCase()))
  ), [tipoFilter, bodegaFilter, search]);

  const estadoTrf: Record<string, 'green' | 'yellow' | 'red'> = { confirmado: 'green', pendiente: 'yellow', anulado: 'red' };

  return (
    <div>
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
        <button onClick={() => setTab('todos')} className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${tab === 'todos' ? 'bg-white text-[#2a4038] shadow-sm font-semibold' : 'text-gray-500'}`}>Todos los movimientos</button>
        <button onClick={() => setTab('traslados')} className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${tab === 'traslados' ? 'bg-white text-[#2a4038] shadow-sm font-semibold' : 'text-gray-500'}`}>Traslados entre Bodegas</button>
      </div>

      {tab === 'todos' && (
        <>
          <Hdr title="Movimientos de Inventario" subtitle="Todos los cambios de stock con trazabilidad completa" onNew={() => setDrawerOpen(true)} newLabel="Registrar Movimiento" />
          <div className="flex gap-3 mb-4 flex-wrap">
            <select className={sel + ' w-60'} value={tipoFilter} onChange={e => setTipoFilter(e.target.value)}><option value="">Todos los tipos</option>{tiposMovimiento.map(t => <option key={t}>{t}</option>)}</select>
            <select className={sel + ' w-48'} value={bodegaFilter} onChange={e => setBodegaFilter(e.target.value)}><option value="">Todas las bodegas</option>{BODEGAS.map(b => <option key={b.id}>{b.nombre}</option>)}</select>
            <input type="date" className={inp + ' w-40'} />
            <div className="flex-1"><SBar value={search} onChange={setSearch} placeholder="Buscar artículo, lote, motivo..." /></div>
            <button className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl text-xs text-gray-600 hover:bg-gray-50"><Download size={13} /> Exportar</button>
          </div>
          <Tbl>
            <thead><tr><Th>Fecha</Th><Th>Tipo</Th><Th>Artículo</Th><Th>Bodega</Th><Th>Cantidad</Th><Th>Lote</Th><Th>Motivo / Ref.</Th><Th>Usuario</Th></tr></thead>
            <tbody>
              {filteredMovs.map(m => (
                <tr key={m.id} className="hover:bg-gray-50/50">
                  <Td className="text-gray-500 text-xs">{m.fecha}</Td>
                  <Td><Badge label={m.tipo} color={movColor(m.tipo)} /></Td>
                  <Td className="font-medium text-gray-900">{m.articulo}</Td>
                  <Td className="text-xs text-gray-500">{m.bodega}</Td>
                  <Td><span className={`font-bold ${m.cantidad > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{m.cantidad > 0 ? '+' : ''}{m.cantidad.toLocaleString()}</span></Td>
                  <Td><span className="font-mono text-xs text-gray-400">{m.lote}</span></Td>
                  <Td className="text-xs text-gray-500">{m.motivo}</Td>
                  <Td className="text-xs text-gray-500">{m.usuario}</Td>
                </tr>
              ))}
              {filteredMovs.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">Sin movimientos para los filtros aplicados</td></tr>}
            </tbody>
          </Tbl>
          <Drawer title="Registrar Movimiento" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tipo de movimiento" required><select className={sel}><option value="">Seleccionar...</option>{tiposMovimiento.map(t => <option key={t}>{t}</option>)}</select></Field>
              <Field label="Fecha" required><input className={inp} type="date" defaultValue="2025-06-19" /></Field>
              <div className="col-span-2"><Field label="Artículo" required><select className={sel}><option value="">Buscar artículo...</option>{ARTICULOS.map(a => <option key={a.id}>{a.codigo} — {a.nombre}</option>)}</select></Field></div>
              <Field label="Bodega origen" required><select className={sel}><option value="">Seleccionar...</option>{BODEGAS.map(b => <option key={b.id}>{b.nombre}</option>)}</select></Field>
              <Field label="Bodega destino"><select className={sel}><option value="">N/A</option>{BODEGAS.map(b => <option key={b.id}>{b.nombre}</option>)}</select></Field>
              <Field label="Lote"><input className={inp} placeholder="Número de lote" /></Field>
              <Field label="Cantidad" required><input className={inp} type="number" placeholder="0.00" step="0.01" /></Field>
              <Field label="Costo unitario"><input className={inp} type="number" placeholder="0.00" /></Field>
              <Field label="Referencia documental"><input className={inp} placeholder="OC, OP, Factura..." /></Field>
              <div className="col-span-2"><Field label="Motivo" required><select className={sel}><option>Compra a proveedor</option><option>Consumo en producción</option><option>Venta ecommerce</option><option>Traslado interno</option><option>Ajuste conteo</option><option>Deterioro</option><option>Merma proceso</option><option>Devolución</option><option>Otro</option></select></Field></div>
              <div className="col-span-2"><Field label="Observaciones"><textarea className={inp + ' resize-none h-14'} placeholder="Notas adicionales..." /></Field></div>
            </div>
            <DrawerFooter onClose={() => setDrawerOpen(false)} />
          </Drawer>
        </>
      )}

      {tab === 'traslados' && (
        <>
          <Hdr title="Traslados entre Bodegas" subtitle="Movimiento controlado de artículos entre ubicaciones" onNew={() => setTrasladoDrawer(true)} newLabel="Nuevo Traslado" />
          <Tbl>
            <thead><tr><Th>Número</Th><Th>Fecha</Th><Th>Bodega Origen</Th><Th>Bodega Destino</Th><Th>Artículo</Th><Th>Cantidad</Th><Th>Lote</Th><Th>Solicitado por</Th><Th>Estado</Th><Th></Th></tr></thead>
            <tbody>
              {TRASLADOS.map(t => (
                <tr key={t.id} className="hover:bg-gray-50/50">
                  <Td><span className="font-mono text-xs font-semibold text-[#2a4038]">{t.numero}</span></Td>
                  <Td className="text-xs text-gray-500">{t.fecha}</Td>
                  <Td className="text-xs text-gray-600">{t.bOrigen}</Td>
                  <Td className="text-xs text-gray-600">{t.bDestino}</Td>
                  <Td className="font-medium text-gray-900">{t.articulo}</Td>
                  <Td className="font-bold">{t.cantidad.toLocaleString()}</Td>
                  <Td><span className="font-mono text-xs text-gray-400">{t.lote}</span></Td>
                  <Td className="text-xs text-gray-500">{t.solicitadoPor}</Td>
                  <Td><Badge label={t.estado === 'confirmado' ? 'Confirmado' : t.estado === 'pendiente' ? 'Pendiente' : 'Anulado'} color={estadoTrf[t.estado]} /></Td>
                  <Td>{t.estado === 'pendiente' && <button className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 border border-emerald-200 px-2 py-1 rounded-lg">Confirmar</button>}</Td>
                </tr>
              ))}
            </tbody>
          </Tbl>
          <Drawer title="Nuevo Traslado entre Bodegas" open={trasladoDrawer} onClose={() => setTrasladoDrawer(false)}>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4 flex gap-2">
              <MoveRight size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">El traslado genera dos movimientos: <strong>Salida</strong> de bodega origen y <strong>Entrada</strong> en bodega destino. Debe ser confirmado por el responsable de la bodega destino.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Número traslado" required><input className={inp} placeholder="TRF-2025-010" /></Field>
              <Field label="Fecha" required><input className={inp} type="date" defaultValue="2025-06-19" /></Field>
              <Field label="Bodega origen" required><select className={sel}><option value="">Seleccionar...</option>{BODEGAS.map(b => <option key={b.id}>{b.nombre}</option>)}</select></Field>
              <Field label="Bodega destino" required><select className={sel}><option value="">Seleccionar...</option>{BODEGAS.map(b => <option key={b.id}>{b.nombre}</option>)}</select></Field>
              <div className="col-span-2"><Field label="Artículo" required><select className={sel}><option value="">Seleccionar artículo...</option>{ARTICULOS.map(a => <option key={a.id}>{a.nombre}</option>)}</select></Field></div>
              <Field label="Lote" required><input className={inp} placeholder="Número de lote" /></Field>
              <Field label="Cantidad a trasladar" required><input className={inp} type="number" placeholder="0" /></Field>
              <Field label="Solicitado por" required><input className={inp} placeholder="Nombre del solicitante" /></Field>
              <Field label="Responsable destino" required><input className={inp} placeholder="Quien recibirá en destino" /></Field>
              <div className="col-span-2"><Field label="Motivo del traslado"><textarea className={inp + ' resize-none h-14'} placeholder="Razón del traslado..." /></Field></div>
            </div>
            <DrawerFooter onClose={() => setTrasladoDrawer(false)} />
          </Drawer>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MÓDULO PRODUCCIÓN
═══════════════════════════════════════════════════════ */
function ModuloProduccion() {
  const [tab, setTab] = useState<TabProduccion>('ordenes');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cierreOP, setCierreOP] = useState<OrdenProduccion | null>(null);

  const tabs = [
    { id: 'ordenes' as TabProduccion, label: 'Órdenes de Producción' },
    { id: 'formulas' as TabProduccion, label: 'Fórmulas / Recetas' },
    { id: 'dispensacion' as TabProduccion, label: 'Dispensación' },
    { id: 'recepcion-pt' as TabProduccion, label: 'Recepción PT' },
    { id: 'mermas' as TabProduccion, label: 'Mermas / Sobrantes' },
  ];

  const estadoColor: Record<string, 'yellow' | 'blue' | 'green' | 'red'> = { pendiente: 'yellow', 'en-proceso': 'blue', cerrada: 'green', anulada: 'red' };
  const estadoLabel: Record<string, string> = { pendiente: 'Pendiente', 'en-proceso': 'En Proceso', cerrada: 'Cerrada', anulada: 'Anulada' };

  return (
    <div>
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 flex-wrap">
        {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${tab === t.id ? 'bg-white text-[#2a4038] shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'}`}>{t.label}</button>)}
      </div>

      {/* ÓRDENES */}
      {tab === 'ordenes' && (
        <>
          <Hdr title="Órdenes de Producción" subtitle="Planificación y control del proceso productivo" onNew={() => setDrawerOpen(true)} newLabel="Nueva Orden" />
          <div className="grid grid-cols-4 gap-4 mb-5">
            {[
              { label: 'Pendientes', value: ORDENES_PRODUCCION.filter(o => o.estado === 'pendiente').length, color: 'bg-amber-50 text-amber-600 border-amber-100' },
              { label: 'En Proceso', value: ORDENES_PRODUCCION.filter(o => o.estado === 'en-proceso').length, color: 'bg-blue-50 text-blue-600 border-blue-100' },
              { label: 'Cerradas (mes)', value: ORDENES_PRODUCCION.filter(o => o.estado === 'cerrada').length, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
              { label: 'Sin Recepción PT', value: ORDENES_PRODUCCION.filter(o => o.dispensada && !o.ptRecibido && o.estado !== 'pendiente').length, color: 'bg-red-50 text-red-600 border-red-100' },
            ].map(s => <div key={s.label} className={`border rounded-2xl p-4 ${s.color}`}><p className="text-3xl font-bold">{s.value}</p><p className="text-xs font-medium mt-0.5">{s.label}</p></div>)}
          </div>
          <Tbl>
            <thead><tr><Th>Número</Th><Th>Producto</Th><Th>Plan</Th><Th>Real</Th><Th>Estado</Th><Th>Dispensada</Th><Th>PT Recibido</Th><Th>Responsable</Th><Th>Acciones</Th></tr></thead>
            <tbody>
              {ORDENES_PRODUCCION.map(op => (
                <tr key={op.id} className="hover:bg-gray-50/50">
                  <Td><span className="font-mono text-xs font-semibold text-[#2a4038]">{op.numero}</span></Td>
                  <Td className="font-medium text-gray-900">{op.producto}</Td>
                  <Td className="font-bold">{op.cantidadPlan.toLocaleString()}</Td>
                  <Td className={op.cantidadReal > 0 ? 'font-bold text-emerald-600' : 'text-gray-400'}>{op.cantidadReal > 0 ? op.cantidadReal.toLocaleString() : '—'}</Td>
                  <Td><Badge label={estadoLabel[op.estado]} color={estadoColor[op.estado]} /></Td>
                  <Td>{op.dispensada ? <CheckCircle size={14} className="text-emerald-500" /> : <Clock size={14} className="text-gray-300" />}</Td>
                  <Td>{op.ptRecibido ? <CheckCircle size={14} className="text-emerald-500" /> : <Clock size={14} className="text-gray-300" />}</Td>
                  <Td className="text-xs text-gray-500">{op.responsable}</Td>
                  <Td>
                    <div className="flex gap-1">
                      <button className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600"><Eye size={13} /></button>
                      {op.estado === 'en-proceso' && op.dispensada && op.ptRecibido && (
                        <button onClick={() => setCierreOP(op)} className="p-1.5 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-600" title="Cerrar orden"><ClipboardCheck size={13} /></button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tbl>

          {/* Modal de Cierre de OP */}
          {cierreOP && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCierreOP(null)} />
              <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <h3 className="font-bold text-gray-900 text-lg mb-1">Cerrar Orden de Producción</h3>
                <p className="text-xs text-gray-500 mb-5">{cierreOP.numero} · {cierreOP.producto}</p>
                <div className="space-y-3 mb-6">
                  {[
                    { label: 'Dispensación verificada', ok: cierreOP.dispensada },
                    { label: 'Recepción PT registrada', ok: cierreOP.ptRecibido },
                    { label: 'Mermas y sobrantes documentados', ok: MERMAS_SOBRANTES.some(m => m.ordenProduccion === cierreOP.numero) },
                  ].map(item => (
                    <div key={item.label} className={`flex items-center gap-3 p-3 rounded-xl ${item.ok ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
                      {item.ok ? <CheckCircle size={16} className="text-emerald-600 flex-shrink-0" /> : <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />}
                      <p className={`text-sm font-medium ${item.ok ? 'text-emerald-700' : 'text-red-700'}`}>{item.label}</p>
                    </div>
                  ))}
                </div>
                <div className="mb-4"><Field label="Cantidad real producida" required><input className={inp} type="number" defaultValue={cierreOP.cantidadPlan} /></Field></div>
                <div className="mb-5"><Field label="Observaciones de cierre"><textarea className={inp + ' resize-none h-14'} placeholder="Notas finales de la orden..." /></Field></div>
                <div className="flex gap-3">
                  <button onClick={() => setCierreOP(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">Cancelar</button>
                  <button className="flex-1 py-2.5 bg-[#2a4038] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2"><CheckCircle size={14} /> Confirmar Cierre</button>
                </div>
              </div>
            </div>
          )}

          <Drawer title="Nueva Orden de Producción" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Número de orden" required><input className={inp} placeholder="OP-2025-044" /></Field>
              <Field label="Fecha programada" required><input className={inp} type="date" defaultValue="2025-06-20" /></Field>
              <div className="col-span-2"><Field label="Producto a fabricar" required><select className={sel}><option value="">Seleccionar producto terminado...</option>{ARTICULOS.filter(a => a.tipo === 'Producto Terminado').map(a => <option key={a.id}>{a.nombre}</option>)}</select></Field></div>
              <div className="col-span-2"><Field label="Fórmula / Receta" required><select className={sel}><option value="">Seleccionar fórmula...</option>{FORMULAS.map(f => <option key={f.id}>{f.codigo} — {f.nombre}</option>)}</select></Field></div>
              <Field label="Cantidad planificada" required><input className={inp} type="number" placeholder="0" /></Field>
              <Field label="Lote asignado" required><input className={inp} placeholder="Ej: PT2025-022" /></Field>
              <Field label="Fecha vencimiento del lote"><input className={inp} type="date" /></Field>
              <div className="col-span-2"><Field label="Responsable" required><select className={sel}><option>Ana González</option><option>Pedro Vásquez</option><option>Luis Herrera</option></select></Field></div>
              <div className="col-span-2"><Field label="Observaciones"><textarea className={inp + ' resize-none h-14'} placeholder="Instrucciones especiales..." /></Field></div>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mt-4"><p className="text-xs text-blue-700 font-medium">Al crear la orden se generará automáticamente la Orden de Dispensación con las materias primas de la fórmula seleccionada.</p></div>
            <DrawerFooter onClose={() => setDrawerOpen(false)} />
          </Drawer>
        </>
      )}

      {/* FÓRMULAS */}
      {tab === 'formulas' && (
        <>
          <Hdr title="Fórmulas y Recetas" subtitle="Composición de ingredientes por producto" onNew={() => setDrawerOpen(true)} newLabel="Nueva Fórmula" />
          {FORMULAS.map(f => (
            <div key={f.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm mb-4">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div><div className="flex items-center gap-2 mb-1"><span className="font-mono text-xs text-gray-400">{f.codigo}</span><Badge label={f.producto} color="green" /></div><h3 className="font-semibold text-gray-900">{f.nombre}</h3></div>
                <div className="text-right"><p className="text-xs text-gray-500">Rendimiento base</p><p className="text-xl font-bold text-[#2a4038]">{f.rendimiento} {f.unidad}</p></div>
              </div>
              <div className="px-5 py-3">
                <table className="w-full text-sm">
                  <thead><tr className="text-[10px] font-bold uppercase tracking-wider text-gray-400"><th className="py-2 text-left">Ingrediente</th><th className="py-2 text-right">Cantidad</th><th className="py-2 text-right">Und</th><th className="py-2 text-right">%</th><th className="py-2 text-right">Stock disp.</th></tr></thead>
                  <tbody>
                    {f.lineas.map(l => {
                      const stockDisp = STOCKS.filter(s => s.articulo.toLowerCase().includes(l.materia.toLowerCase())).reduce((a, s) => a + s.cantidad, 0);
                      return (
                        <tr key={l.id} className="border-t border-gray-50">
                          <td className="py-2.5 font-medium text-gray-800">{l.materia}</td>
                          <td className="py-2.5 text-right font-bold">{l.cantidad}</td>
                          <td className="py-2.5 text-right text-gray-500">{l.unidad}</td>
                          <td className="py-2.5 text-right text-gray-500">{((l.cantidad / f.rendimiento) * 100).toFixed(1)}%</td>
                          <td className="py-2.5 text-right"><span className={stockDisp > l.cantidad ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>{stockDisp > 0 ? stockDisp : 'Sin stock'}</span></td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-gray-200"><td className="py-2.5 font-bold">Total</td><td className="py-2.5 text-right font-bold">{f.lineas.reduce((a, l) => a + l.cantidad, 0).toFixed(1)}</td><td className="py-2.5 text-right text-gray-500">{f.unidad}</td><td className="py-2.5 text-right text-[#2a4038] font-bold">{((f.lineas.reduce((a, l) => a + l.cantidad, 0) / f.rendimiento) * 100).toFixed(1)}%</td><td /></tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <Drawer title="Nueva Fórmula / Receta" open={drawerOpen} onClose={() => setDrawerOpen(false)} wide>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Código" required><input className={inp} placeholder="FM-XXX-000" /></Field>
              <div className="col-span-2"><Field label="Nombre de la fórmula" required><input className={inp} placeholder="Nombre descriptivo" /></Field></div>
              <div className="col-span-2"><Field label="Producto resultante" required><select className={sel}><option value="">Seleccionar producto terminado...</option>{ARTICULOS.filter(a => a.tipo === 'Producto Terminado').map(a => <option key={a.id}>{a.nombre}</option>)}</select></Field></div>
              <Field label="Rendimiento base" required><input className={inp} type="number" placeholder="100" /></Field>
              <Field label="Unidad del rendimiento"><select className={sel}>{UNIDADES.map(u => <option key={u.id}>{u.nombre}</option>)}</select></Field>
            </div>
            <div className="mt-5">
              <div className="flex items-center justify-between mb-3"><p className="text-xs font-bold uppercase tracking-wider text-gray-500">Ingredientes</p><button className="text-xs text-[#2a4038] font-semibold flex items-center gap-1"><Plus size={12} /> Agregar línea</button></div>
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg p-2">
                    <div className="col-span-5"><select className={sel + ' text-xs py-2'}><option>Seleccionar materia prima...</option>{ARTICULOS.map(a => <option key={a.id}>{a.nombre}</option>)}</select></div>
                    <div className="col-span-3"><input className={inp + ' text-xs py-2'} type="number" placeholder="Cantidad" /></div>
                    <div className="col-span-2"><select className={sel + ' text-xs py-2'}>{UNIDADES.map(u => <option key={u.id}>{u.abreviatura}</option>)}</select></div>
                    <div className="col-span-2 flex justify-center"><button className="p-1 text-red-400 hover:text-red-600"><X size={14} /></button></div>
                  </div>
                ))}
              </div>
            </div>
            <DrawerFooter onClose={() => setDrawerOpen(false)} />
          </Drawer>
        </>
      )}

      {/* DISPENSACIÓN */}
      {tab === 'dispensacion' && (
        <>
          <Hdr title="Órdenes de Dispensación" subtitle="Pesaje y verificación de materias primas" onNew={() => setDrawerOpen(true)} newLabel="Nueva Dispensación" />
          {ORDENES_DISPENSACION.map(od => (
            <div key={od.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm mb-4">
              <div className="grid grid-cols-3 gap-4 px-5 py-4 border-b border-gray-100">
                <div><p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Número</p><p className="font-mono font-semibold text-[#2a4038]">{od.numero}</p></div>
                <div><p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Orden Producción</p><p className="font-semibold">{od.ordenProduccion}</p></div>
                <div><p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Estado</p><Badge label={od.estado === 'verificado' ? 'Verificado' : od.estado === 'pesado' ? 'Pesado' : 'Pendiente'} color={od.estado === 'verificado' ? 'green' : od.estado === 'pesado' ? 'blue' : 'yellow'} /></div>
                <div><p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Pesador</p><p className="text-gray-700">{od.pesador}</p></div>
                <div><p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Verificador</p><p className="text-gray-700">{od.verificador}</p></div>
                <div><p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Fecha</p><p className="text-gray-700">{od.fecha}</p></div>
              </div>
              <div className="px-5 py-3">
                <table className="w-full text-sm">
                  <thead><tr className="text-[10px] font-bold uppercase tracking-wider text-gray-400"><th className="py-2 text-left">Materia Prima</th><th className="py-2 text-right">Teórico</th><th className="py-2 text-right">Pesado</th><th className="py-2 text-right">Diferencia</th><th className="py-2 text-right">Und</th><th className="py-2 text-center">OK</th></tr></thead>
                  <tbody>
                    {od.lineas.map(l => {
                      const diff = l.cantidadPesada - l.cantidadTeorica;
                      return <tr key={l.id} className="border-t border-gray-50"><td className="py-2.5 font-medium text-gray-800">{l.materia}</td><td className="py-2.5 text-right">{l.cantidadTeorica}</td><td className="py-2.5 text-right font-bold">{l.cantidadPesada}</td><td className={`py-2.5 text-right font-semibold ${Math.abs(diff) > 0.1 ? 'text-red-500' : 'text-emerald-500'}`}>{diff >= 0 ? '+' : ''}{diff.toFixed(2)}</td><td className="py-2.5 text-right text-gray-500">{l.unidad}</td><td className="py-2.5 text-center">{Math.abs(diff) <= 0.1 ? <CheckCircle size={14} className="text-emerald-500 mx-auto" /> : <AlertTriangle size={14} className="text-amber-500 mx-auto" />}</td></tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <Drawer title="Nueva Orden de Dispensación" open={drawerOpen} onClose={() => setDrawerOpen(false)} wide>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Orden de producción" required><select className={sel}><option value="">Seleccionar...</option>{ORDENES_PRODUCCION.filter(op => op.estado !== 'cerrada').map(op => <option key={op.id}>{op.numero} — {op.producto}</option>)}</select></Field>
              <Field label="Fecha" required><input className={inp} type="date" defaultValue="2025-06-19" /></Field>
              <Field label="Lote de producción" required><input className={inp} placeholder="Ej: PT2025-022" /></Field>
              <Field label="Cantidad a dispensar (Kg)" required><input className={inp} type="number" placeholder="0" /></Field>
              <Field label="Persona que pesa" required><input className={inp} placeholder="Nombre del pesador" /></Field>
              <Field label="Persona que verifica" required><input className={inp} placeholder="Nombre del verificador" /></Field>
            </div>
            <div className="mt-5">
              <div className="flex items-center justify-between mb-3"><p className="text-xs font-bold uppercase tracking-wider text-gray-500">Materias primas a dispensar</p><button className="text-xs text-[#2a4038] font-semibold flex items-center gap-1"><Plus size={12} /> Agregar materia</button></div>
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg p-2">
                    <div className="col-span-4"><select className={sel + ' text-xs py-2'}><option>Materia prima...</option>{ARTICULOS.filter(a => a.tipo === 'Materia Prima').map(a => <option key={a.id}>{a.nombre}</option>)}</select></div>
                    <div className="col-span-2"><input className={inp + ' text-xs py-2 bg-gray-100'} placeholder="Teórico" readOnly /></div>
                    <div className="col-span-2"><input className={inp + ' text-xs py-2'} placeholder="Pesado" /></div>
                    <div className="col-span-2"><input className={inp + ' text-xs py-2 bg-gray-100'} placeholder="Diferencia" readOnly /></div>
                    <div className="col-span-1"><select className={sel + ' text-xs py-2'}><option>Kg</option><option>g</option><option>L</option></select></div>
                    <div className="col-span-1 flex justify-center"><button className="p-1 text-red-400 hover:text-red-600"><X size={14} /></button></div>
                  </div>
                ))}
              </div>
            </div>
            <DrawerFooter onClose={() => setDrawerOpen(false)} />
          </Drawer>
        </>
      )}

      {/* RECEPCIÓN PT */}
      {tab === 'recepcion-pt' && (
        <>
          <Hdr title="Recepción de Producto Terminado" subtitle="Digitalización de la boleta de entrega física" onNew={() => setDrawerOpen(true)} newLabel="Nueva Recepción" />
          {RECEPCIONES_PT.map(r => (
            <div key={r.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm mb-4 p-5">
              <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-3"><span className="font-mono font-semibold text-[#2a4038]">{r.numero}</span><Badge label={r.estado === 'recibido' ? 'Recibido' : r.estado === 'parcial' ? 'Parcial' : 'Pendiente'} color={r.estado === 'recibido' ? 'green' : r.estado === 'parcial' ? 'yellow' : 'gray'} /></div><span className="text-xs text-gray-400">{r.fecha}</span></div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div><p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Orden Producción</p><p className="font-semibold">{r.ordenProduccion}</p></div>
                <div><p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Producto</p><p className="font-medium text-gray-900">{r.producto}</p></div>
                <div><p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Lote</p><p className="font-mono text-[#2a4038]">{r.lote}</p></div>
                <div><p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Entregado por</p><p>{r.entregadoPor}</p></div>
                <div><p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Recibido por</p><p>{r.recibidoPor}</p></div>
                <div><p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Bodega destino</p><p className="text-gray-700">{r.bodegaDestino}</p></div>
              </div>
              <div className="grid grid-cols-5 gap-3 bg-gray-50 rounded-xl p-3">
                {[{ label: 'Producida', value: r.cantidadProducida, color: 'text-gray-900' }, { label: 'Recibida', value: r.cantidadRecibida, color: 'text-emerald-600' }, { label: 'Rechazada', value: r.cantidadRechazada, color: 'text-red-600' }, { label: 'Deterioro', value: r.cantidadDeterioro, color: 'text-amber-600' }, { label: 'Cajas', value: r.cajas, color: 'text-blue-600' }].map(s => <div key={s.label} className="text-center"><p className={`text-2xl font-bold ${s.color}`}>{s.value}</p><p className="text-[10px] text-gray-500 uppercase font-medium mt-0.5">{s.label}</p></div>)}
              </div>
            </div>
          ))}
          <Drawer title="Nueva Recepción de PT" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Orden de producción" required><select className={sel}><option value="">Seleccionar...</option>{ORDENES_PRODUCCION.map(op => <option key={op.id}>{op.numero} — {op.producto}</option>)}</select></Field>
              <Field label="Fecha" required><input className={inp} type="date" defaultValue="2025-06-19" /></Field>
              <div className="col-span-2"><Field label="Producto fabricado"><input className={inp + ' bg-gray-50'} readOnly placeholder="Se carga de la OP" /></Field></div>
              <Field label="Lote" required><input className={inp} placeholder="Número de lote" /></Field>
              <Field label="Bodega destino" required><select className={sel}><option>Bodega Producto Terminado</option>{BODEGAS.map(b => <option key={b.id}>{b.nombre}</option>)}</select></Field>
              <Field label="Cantidad producida" required><input className={inp} type="number" placeholder="0" /></Field>
              <Field label="Cantidad recibida" required><input className={inp} type="number" placeholder="0" /></Field>
              <Field label="Cantidad rechazada"><input className={inp} type="number" defaultValue="0" /></Field>
              <Field label="Cantidad deterioro"><input className={inp} type="number" defaultValue="0" /></Field>
              <Field label="Número de cajas" required><input className={inp} type="number" placeholder="0" /></Field>
              <Field label="Unidades por caja"><input className={inp} type="number" placeholder="0" /></Field>
              <Field label="Entregado por (Producción)" required><input className={inp} placeholder="Nombre" /></Field>
              <Field label="Recibido por (Almacén)" required><input className={inp} placeholder="Nombre" /></Field>
              <div className="col-span-2"><Field label="Observaciones"><textarea className={inp + ' resize-none h-14'} placeholder="Notas sobre la recepción..." /></Field></div>
            </div>
            <DrawerFooter onClose={() => setDrawerOpen(false)} />
          </Drawer>
        </>
      )}

      {/* MERMAS Y SOBRANTES */}
      {tab === 'mermas' && (
        <>
          <Hdr title="Mermas y Sobrantes" subtitle="Registro de pérdidas y excedentes en producción" onNew={() => setDrawerOpen(true)} newLabel="Registrar Merma/Sobrante" />
          <div className="grid grid-cols-3 gap-4 mb-5">
            {[
              { label: 'Total mermas (mes)', value: `${MERMAS_SOBRANTES.filter(m => m.tipo === 'merma').reduce((a, m) => a + m.cantidad, 0).toFixed(2)} Kg`, color: 'bg-red-50 text-red-600 border-red-100', icon: TrendingDown },
              { label: 'Total sobrantes (mes)', value: `${MERMAS_SOBRANTES.filter(m => m.tipo === 'sobrante').reduce((a, m) => a + m.cantidad, 0).toFixed(2)} Kg`, color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: TrendingUp },
              { label: 'Registros del mes', value: MERMAS_SOBRANTES.length, color: 'bg-gray-50 text-gray-600 border-gray-100', icon: FileText },
            ].map(s => <div key={s.label} className={`border rounded-2xl p-4 ${s.color}`}><div className="flex items-center gap-2 mb-2"><s.icon size={16} /></div><p className="text-2xl font-bold">{s.value}</p><p className="text-xs font-medium mt-0.5">{s.label}</p></div>)}
          </div>
          <Tbl>
            <thead><tr><Th>Fecha</Th><Th>OP</Th><Th>Tipo</Th><Th>Artículo</Th><Th>Cantidad</Th><Th>Und</Th><Th>Motivo</Th><Th>Responsable</Th></tr></thead>
            <tbody>
              {MERMAS_SOBRANTES.map(m => (
                <tr key={m.id} className="hover:bg-gray-50/50">
                  <Td className="text-xs text-gray-500">{m.fecha}</Td>
                  <Td><span className="font-mono text-xs text-[#2a4038]">{m.ordenProduccion}</span></Td>
                  <Td><Badge label={m.tipo === 'merma' ? 'Merma' : 'Sobrante'} color={m.tipo === 'merma' ? 'red' : 'green'} /></Td>
                  <Td className="font-medium text-gray-900">{m.articulo}</Td>
                  <Td className={`font-bold ${m.tipo === 'merma' ? 'text-red-600' : 'text-emerald-600'}`}>{m.tipo === 'merma' ? '-' : '+'}{m.cantidad}</Td>
                  <Td className="text-gray-500">{m.unidad}</Td>
                  <Td className="text-xs text-gray-500">{m.motivo}</Td>
                  <Td className="text-xs text-gray-500">{m.responsable}</Td>
                </tr>
              ))}
            </tbody>
          </Tbl>
          <Drawer title="Registrar Merma / Sobrante" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4 flex gap-2">
              <AlertTriangle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">Las mermas generan un movimiento de <strong>Salida por Merma</strong>. Los sobrantes generan un movimiento de <strong>Entrada por Sobrante</strong> y deben retornar a la bodega de materias primas.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tipo" required><select className={sel}><option>Merma</option><option>Sobrante</option></select></Field>
              <Field label="Fecha" required><input className={inp} type="date" defaultValue="2025-06-19" /></Field>
              <div className="col-span-2"><Field label="Orden de producción" required><select className={sel}><option value="">Seleccionar OP...</option>{ORDENES_PRODUCCION.map(op => <option key={op.id}>{op.numero} — {op.producto}</option>)}</select></Field></div>
              <div className="col-span-2"><Field label="Artículo" required><select className={sel}><option value="">Seleccionar artículo...</option>{ARTICULOS.map(a => <option key={a.id}>{a.nombre}</option>)}</select></Field></div>
              <Field label="Cantidad" required><input className={inp} type="number" placeholder="0.00" step="0.001" /></Field>
              <Field label="Unidad de medida"><select className={sel}>{UNIDADES.map(u => <option key={u.id}>{u.nombre}</option>)}</select></Field>
              <div className="col-span-2"><Field label="Motivo" required><select className={sel}><option>Adherencia en equipos</option><option>Derrame accidental</option><option>Evaporación</option><option>Ajuste de formulación</option><option>No requerido en proceso</option><option>Otro</option></select></Field></div>
              <div className="col-span-2"><Field label="Descripción detallada" required><textarea className={inp + ' resize-none h-16'} placeholder="Descripción del motivo de la merma o sobrante..." /></Field></div>
              <Field label="Responsable" required><input className={inp} placeholder="Nombre del operario" /></Field>
              <Field label="Bodega destino (sobrante)"><select className={sel}><option>N/A — Merma</option>{BODEGAS.map(b => <option key={b.id}>{b.nombre}</option>)}</select></Field>
            </div>
            <DrawerFooter onClose={() => setDrawerOpen(false)} />
          </Drawer>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MÓDULO CONVERSIÓN
═══════════════════════════════════════════════════════ */
function ModuloConversion() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cantSalida, setCantSalida] = useState('');
  const [cantEntrada, setCantEntrada] = useState('');
  const factor = cantSalida && cantEntrada ? (parseFloat(cantEntrada) / parseFloat(cantSalida)).toFixed(3) : '—';

  return (
    <div>
      <Hdr title="Conversión / Transformación de Productos" subtitle="Registro de salida de un artículo y entrada de otro" onNew={() => setDrawerOpen(true)} newLabel="Nueva Conversión" />
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-5 flex gap-3">
        <ArrowRightLeft size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <div><p className="text-xs font-semibold text-blue-800">¿Qué es una conversión?</p><p className="text-xs text-blue-700 mt-0.5">Un artículo <strong>sale</strong> del inventario (granel, en proceso) y otro artículo <strong>entra</strong> (unidades envasadas, presentación fraccionada). Ambos movimientos quedan trazados con factor de conversión.</p></div>
      </div>
      <Tbl>
        <thead><tr><Th>Número</Th><Th>Fecha</Th><Th>Artículo Salida</Th><Th>Cant. Salida</Th><Th>Artículo Entrada</Th><Th>Cant. Entrada</Th><Th>Factor</Th><Th>Motivo</Th><Th>Usuario</Th></tr></thead>
        <tbody>
          {CONVERSIONES.map(c => {
            const factor = (c.cantidadEntrada / c.cantidadSalida).toFixed(2);
            return (
              <tr key={c.id} className="hover:bg-gray-50/50">
                <Td><span className="font-mono text-xs font-semibold text-[#2a4038]">{c.numero}</span></Td>
                <Td className="text-xs text-gray-500">{c.fecha}</Td>
                <Td className="font-medium text-red-700">{c.articuloSalida}</Td>
                <Td><span className="text-red-600 font-bold">-{c.cantidadSalida} Kg</span></Td>
                <Td className="font-medium text-emerald-700">{c.articuloEntrada}</Td>
                <Td><span className="text-emerald-600 font-bold">+{c.cantidadEntrada} Und</span></Td>
                <Td><span className="font-mono text-xs font-semibold text-gray-600">{factor} und/Kg</span></Td>
                <Td className="text-xs text-gray-500">{c.motivo}</Td>
                <Td className="text-xs text-gray-500">{c.usuario}</Td>
              </tr>
            );
          })}
        </tbody>
      </Tbl>

      <Drawer title="Nueva Conversión de Producto" open={drawerOpen} onClose={() => setDrawerOpen(false)} wide>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Número de conversión" required><input className={inp} placeholder="CV-2025-002" /></Field>
          <Field label="Fecha" required><input className={inp} type="date" defaultValue="2025-06-19" /></Field>
        </div>
        <div className="mt-4 bg-red-50 border border-red-100 rounded-xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-3">🔴 Artículo que SALE del inventario</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Artículo de salida" required><select className={sel}><option value="">Seleccionar...</option>{ARTICULOS.map(a => <option key={a.id}>{a.nombre}</option>)}</select></Field>
            <Field label="Bodega origen" required><select className={sel}><option value="">Seleccionar...</option>{BODEGAS.map(b => <option key={b.id}>{b.nombre}</option>)}</select></Field>
            <Field label="Lote origen"><input className={inp} placeholder="Lote del artículo de salida" /></Field>
            <Field label="Cantidad a transformar" required><input className={inp} type="number" placeholder="0.00" step="0.01" value={cantSalida} onChange={e => setCantSalida(e.target.value)} /></Field>
          </div>
        </div>
        <div className="flex justify-center py-3 items-center gap-3 text-gray-400"><div className="h-px flex-1 bg-gray-200" /><div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5"><ArrowRightLeft size={14} className="text-[#2a4038]" /><span className="text-xs font-semibold text-gray-600">Factor: {factor}</span></div><div className="h-px flex-1 bg-gray-200" /></div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-3">🟢 Artículo que ENTRA al inventario</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Artículo de entrada" required><select className={sel}><option value="">Seleccionar...</option>{ARTICULOS.map(a => <option key={a.id}>{a.nombre}</option>)}</select></Field>
            <Field label="Bodega destino" required><select className={sel}><option value="">Seleccionar...</option>{BODEGAS.map(b => <option key={b.id}>{b.nombre}</option>)}</select></Field>
            <Field label="Nuevo lote"><input className={inp} placeholder="Lote del artículo resultante" /></Field>
            <Field label="Cantidad resultante" required><input className={inp} type="number" placeholder="0" value={cantEntrada} onChange={e => setCantEntrada(e.target.value)} /></Field>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <Field label="Motivo de la conversión" required><select className={sel}><option>Granel a unidades envasadas</option><option>MP a presentación fraccionada</option><option>En proceso a terminado</option><option>Ajuste de costos</option><option>Otro</option></select></Field>
          <div className="col-span-1"><Field label="Observaciones"><textarea className={inp + ' resize-none h-[42px]'} placeholder="Notas..." /></Field></div>
        </div>
        <DrawerFooter onClose={() => setDrawerOpen(false)} />
      </Drawer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MÓDULO REPORTES
═══════════════════════════════════════════════════════ */
function ModuloReportes() {
  const [desde, setDesde] = useState('2025-06-01');
  const [hasta, setHasta] = useState('2025-06-19');
  const [bodega, setBodega] = useState('');
  const [grupo, setGrupo] = useState('');

  const reportes = [
    { id: 'inv-general', title: 'Inventario General', desc: 'Existencias en todas las bodegas con costos y valorización', icon: Package, tags: ['PDF', 'Excel'] },
    { id: 'inv-bodega', title: 'Inventario por Bodega', desc: 'Stock filtrado por bodega específica y fecha de corte', icon: Warehouse, tags: ['PDF', 'Excel'] },
    { id: 'inv-grupo', title: 'Inventario por Grupo', desc: 'Agrupado por grupo de artículo con subtotales', icon: Layers, tags: ['Excel'] },
    { id: 'valorizado', title: 'Valorización de Inventario', desc: 'Valor total sin IVA, con IVA y a precio de venta', icon: BarChart3, tags: ['PDF', 'Excel'] },
    { id: 'movimientos', title: 'Movimientos del Período', desc: 'Todas las entradas y salidas en el rango de fechas', icon: ArrowRightLeft, tags: ['Excel'] },
    { id: 'trazabilidad', title: 'Trazabilidad por Lote', desc: 'Rastrear un lote desde materia prima hasta PT', icon: ChevronRight, tags: ['PDF'] },
    { id: 'produccion', title: 'Órdenes de Producción', desc: 'Estado, rendimiento y mermas de OPs del período', icon: Factory, tags: ['PDF', 'Excel'] },
    { id: 'mermas', title: 'Mermas y Sobrantes', desc: 'Consolidado de pérdidas y excedentes en producción', icon: Beaker, tags: ['Excel'] },
    { id: 'compras', title: 'Órdenes de Compra', desc: 'OC emitidas, recibidas y pendientes del período', icon: ShoppingCart, tags: ['Excel'] },
    { id: 'corte', title: 'Inventario a Fecha de Corte', desc: 'Stock histórico en una fecha específica pasada', icon: FileText, tags: ['Excel'] },
    { id: 'bajo-minimo', title: 'Artículos bajo Mínimo', desc: 'Artículos que requieren reabastecimiento urgente', icon: TrendingDown, tags: ['PDF', 'Excel'] },
    { id: 'vencimiento', title: 'Control de Vencimientos', desc: 'Lotes por vencer en los próximos 30, 60 y 90 días', icon: Clock, tags: ['PDF'] },
  ];

  return (
    <div>
      <Hdr title="Reportes de Inventario" subtitle="Exportación en PDF y Excel" />
      <div className="grid grid-cols-4 gap-3 mb-6 p-4 bg-gray-50 border border-gray-100 rounded-2xl">
        <Field label="Desde"><input className={inp} type="date" value={desde} onChange={e => setDesde(e.target.value)} /></Field>
        <Field label="Hasta"><input className={inp} type="date" value={hasta} onChange={e => setHasta(e.target.value)} /></Field>
        <Field label="Bodega"><select className={sel} value={bodega} onChange={e => setBodega(e.target.value)}><option value="">Todas</option>{BODEGAS.map(b => <option key={b.id}>{b.nombre}</option>)}</select></Field>
        <Field label="Grupo de artículo"><select className={sel} value={grupo} onChange={e => setGrupo(e.target.value)}><option value="">Todos</option>{GRUPOS.map(g => <option key={g.id}>{g.nombre}</option>)}</select></Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {reportes.map(r => (
          <div key={r.id} className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center group-hover:bg-[#2a4038]/8 transition-colors"><r.icon size={18} className="text-[#2a4038]" /></div>
              <div className="flex gap-1.5">{r.tags.map(tag => <span key={tag} className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{tag}</span>)}</div>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">{r.title}</h3>
            <p className="text-xs text-gray-500 mb-4">{r.desc}</p>
            <div className="flex gap-2">
              {r.tags.includes('PDF') && <button className="flex-1 py-2 text-xs font-semibold border border-[#2a4038] text-[#2a4038] rounded-xl hover:bg-[#2a4038] hover:text-white transition-all flex items-center justify-center gap-1.5"><Download size={12} /> PDF</button>}
              {r.tags.includes('Excel') && <button className="flex-1 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5"><Download size={12} /> Excel</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MÓDULO AUDITORÍA
═══════════════════════════════════════════════════════ */
function ModuloAuditoria() {
  const [search, setSearch] = useState('');
  const [modFilter, setModFilter] = useState('');

  const modulos = [...new Set(AUDITORIA.map(a => a.modulo))];
  const filtered = useMemo(() => AUDITORIA.filter(a =>
    (!modFilter || a.modulo === modFilter) &&
    (!search || a.detalle.toLowerCase().includes(search.toLowerCase()) || a.usuario.toLowerCase().includes(search.toLowerCase()) || a.accion.toLowerCase().includes(search.toLowerCase()))
  ), [search, modFilter]);

  return (
    <div>
      <Hdr title="Auditoría del Sistema" subtitle="Registro de todas las acciones sobre el inventario" />
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-5 flex gap-2">
        <Bell size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">Todas las acciones sobre inventario, producción y compras son registradas automáticamente. Este log no puede modificarse ni eliminarse.</p>
      </div>
      <div className="flex gap-3 mb-4">
        <select className={sel + ' w-44'} value={modFilter} onChange={e => setModFilter(e.target.value)}><option value="">Todos los módulos</option>{modulos.map(m => <option key={m}>{m}</option>)}</select>
        <input type="date" className={inp + ' w-40'} />
        <div className="flex-1"><SBar value={search} onChange={setSearch} placeholder="Buscar acción, usuario, detalle..." /></div>
        <button className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl text-xs text-gray-600 hover:bg-gray-50"><Download size={13} /> Exportar</button>
      </div>
      <Tbl>
        <thead><tr><Th>Fecha</Th><Th>Hora</Th><Th>Usuario</Th><Th>Módulo</Th><Th>Acción</Th><Th>Detalle</Th><Th>IP</Th></tr></thead>
        <tbody>
          {filtered.map(a => (
            <tr key={a.id} className="hover:bg-gray-50/50">
              <Td className="text-xs text-gray-500">{a.fecha}</Td>
              <Td className="font-mono text-xs text-gray-500">{a.hora}</Td>
              <Td className="font-medium text-gray-900">{a.usuario}</Td>
              <Td><Badge label={a.modulo} color="blue" /></Td>
              <Td className="text-xs font-semibold text-gray-700">{a.accion}</Td>
              <Td className="text-xs text-gray-500 max-w-xs"><span className="line-clamp-2">{a.detalle}</span></Td>
              <Td><span className="font-mono text-[10px] text-gray-400">{a.ip}</span></Td>
            </tr>
          ))}
        </tbody>
      </Tbl>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════ */
export function AdminInventarioProduccion() {
  const [modulo, setModulo] = useState<Modulo>('panel');

  const alertCount = ARTICULOS.filter(a => stockAlert(a.id) !== 'ok').length + STOCKS.filter(s => loteBadge(s.vencimiento).color === 'red').length;

  type NavItem = { id: Modulo; label: string; icon: ComponentType<{ size?: number; className?: string }>; desc: string; badge?: number };

  const navGroups: { group: string; items: NavItem[] }[] = [
    {
      group: 'Inicio',
      items: [{ id: 'panel', label: 'Panel de Control', icon: LayoutDashboard, desc: 'KPIs y alertas', badge: alertCount > 0 ? alertCount : undefined }],
    },
    {
      group: 'Inventario',
      items: [
        { id: 'existencias', label: 'Existencias', icon: Package, desc: 'Stock por bodega y lote' },
        { id: 'movimientos', label: 'Movimientos', icon: RefreshCw, desc: 'Entradas, salidas, traslados' },
        { id: 'conversion', label: 'Conversión', icon: ArrowRightLeft, desc: 'Transformación de productos' },
      ],
    },
    {
      group: 'Producción',
      items: [{ id: 'produccion', label: 'Producción', icon: Factory, desc: 'OP, fórmulas, dispensación' }],
    },
    {
      group: 'Compras',
      items: [{ id: 'compras', label: 'Órdenes de Compra', icon: ShoppingCart, desc: 'OC y recepción de mercancía', badge: ORDENES_COMPRA.filter(oc => oc.estado === 'parcial').length || undefined }],
    },
    {
      group: 'Catálogos',
      items: [{ id: 'maestros', label: 'Maestros', icon: Layers, desc: 'Artículos, bodegas, grupos' }],
    },
    {
      group: 'Informes',
      items: [
        { id: 'reportes', label: 'Reportes', icon: BarChart3, desc: 'PDF y Excel' },
        { id: 'auditoria', label: 'Auditoría', icon: FileText, desc: 'Log de acciones' },
      ],
    },
  ];

  return (
    <div className="flex gap-0 min-h-[calc(100vh-80px)] -m-6 md:-m-8">
      {/* Sidebar del módulo */}
      <div className="w-56 flex-shrink-0 bg-gray-50 border-r border-gray-100 overflow-y-auto">
        <div className="px-4 pt-5 pb-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400 mb-0.5">Inventario & Producción</p>
          <p className="text-[11px] text-gray-500">Juhnios Rold S.A.S.</p>
        </div>
        <nav className="px-2 pb-6 space-y-4">
          {navGroups.map(group => (
            <div key={group.group}>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-gray-400 px-3 mb-1">{group.group}</p>
              <div className="space-y-0.5">
                {group.items.map(m => {
                  const Icon = m.icon;
                  const active = modulo === m.id;
                  return (
                    <button key={m.id} onClick={() => setModulo(m.id)} className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all group ${active ? 'bg-[#2a4038] text-white shadow-sm' : 'hover:bg-white hover:shadow-sm text-gray-600'}`}>
                      <Icon size={14} className={`flex-shrink-0 mt-0.5 ${active ? 'text-white' : 'text-gray-400 group-hover:text-[#2a4038]'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p className={`text-xs font-semibold truncate ${active ? 'text-white' : 'text-gray-700'}`}>{m.label}</p>
                          {m.badge && m.badge > 0 && <span className={`flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600'}`}>{m.badge}</span>}
                        </div>
                        <p className={`text-[10px] leading-tight mt-0.5 truncate ${active ? 'text-white/70' : 'text-gray-400'}`}>{m.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-6 md:p-8">
        {modulo === 'panel' && <ModuloPanel />}
        {modulo === 'maestros' && <ModuloMaestros />}
        {modulo === 'compras' && <ModuloCompras />}
        {modulo === 'existencias' && <ModuloExistencias />}
        {modulo === 'movimientos' && <ModuloMovimientos />}
        {modulo === 'produccion' && <ModuloProduccion />}
        {modulo === 'conversion' && <ModuloConversion />}
        {modulo === 'reportes' && <ModuloReportes />}
        {modulo === 'auditoria' && <ModuloAuditoria />}
      </div>
    </div>
  );
}
