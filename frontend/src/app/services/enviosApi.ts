import { api } from './api';

export type EstadoEnvio =
  | 'PENDIENTE'
  | 'GENERANDO_GUIA'
  | 'GUIA_GENERADA'
  | 'RECOGIDA_PROGRAMADA'
  | 'RECOGIDO'
  | 'EN_TRANSITO'
  | 'EN_REPARTO'
  | 'ENTREGADO'
  | 'NOVEDAD'
  | 'DEVUELTO'
  | 'CANCELADO';

export interface Transportadora {
  id: string;
  codigo: string;
  nombre: string;
  sitio_web: string;
  tracking_url_template: string;
  proveedor_externo: string;
  soporta_api: boolean;
  activa: boolean;
}

export interface TrackingEvent {
  id: string;
  estado: EstadoEnvio;
  descripcion: string;
  ubicacion: string;
  fecha_evento: string;
  changed_by_email?: string;
  created_at: string;
}

export interface Envio {
  id: string;
  pedido_id: string;
  numero_pedido: string;
  estado_pedido: string;
  transportadora: Transportadora | null;
  numero_guia: string;
  estado_envio: EstadoEnvio;
  tracking_url: string;
  direccion_envio: string;
  ciudad: string;
  departamento: string;
  pais: string;
  codigo_postal: string;
  costo_envio: string;
  fecha_despacho: string | null;
  fecha_entrega_estimada: string | null;
  fecha_entrega_real: string | null;
  proveedor_externo: string;
  external_label_url: string;
  eventos: TrackingEvent[];
  created_at: string;
  updated_at: string;
}

export interface HistorialPedido {
  id: string;
  status: string;
  notes: string;
  changed_by_email?: string;
  created_at: string;
}

export interface TrackingPedido {
  pedido_id: string;
  numero_pedido: string;
  estado_pedido: string;
  direccion_envio: string;
  historial_pedido: HistorialPedido[];
  envio: Envio | null;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface CrearEnvioPayload {
  pedido_id: string;
  direccion_envio?: string;
  ciudad?: string;
  departamento?: string;
  pais?: string;
  codigo_postal?: string;
  costo_envio?: number;
  fecha_entrega_estimada?: string;
}

export interface RegistrarGuiaManualPayload {
  transportadora_id: string;
  numero_guia: string;
  tracking_url?: string;
  costo_envio?: number;
  fecha_entrega_estimada?: string;
}

export async function getTrackingPedido(
  pedidoId: string,
  signal?: AbortSignal,
): Promise<TrackingPedido> {
  const response = await api.get<TrackingPedido>(
    `/pedidos/${pedidoId}/tracking/`,
    signal,
  );
  if (!response.data) throw new Error(response.message);
  return response.data;
}

export async function getTransportadoras(): Promise<Transportadora[]> {
  const response = await api.get<PaginatedResponse<Transportadora>>(
    '/transportadoras/?activa=true&page_size=100',
  );
  if (!response.data) throw new Error(response.message);
  return response.data.results;
}

export async function crearEnvio(payload: CrearEnvioPayload): Promise<Envio> {
  const response = await api.post<Envio>('/envios/', payload);
  if (!response.data) throw new Error(response.message);
  return response.data;
}

export async function registrarGuiaManual(
  envioId: string,
  payload: RegistrarGuiaManualPayload,
): Promise<Envio> {
  const response = await api.post<Envio>(
    `/envios/${envioId}/registrar-guia-manual/`,
    payload,
  );
  if (!response.data) throw new Error(response.message);
  return response.data;
}

export async function actualizarEstadoEnvio(
  envioId: string,
  estado: EstadoEnvio,
  descripcion = '',
): Promise<Envio> {
  const response = await api.put<Envio>(`/envios/${envioId}/estado/`, {
    estado,
    descripcion,
  });
  if (!response.data) throw new Error(response.message);
  return response.data;
}
