import type { UserRole as AuthUserRole } from '../services/auth.service';

export type UserRole = AuthUserRole;

export interface User {
  id: string;
  nombre: string;
  email: string;
  rol: UserRole;
}

export interface Product {
  id: string;
  nombre: string;
  categoria: string;
  tipo: string;
  presentacion: string;
  presentacionNumero?: number;
  presentacionUnidad?: 'ML' | 'LT' | 'GR' | 'KG' | 'UND';
  precio: number;
  precioCosto?: number;
  descripcion: string;
  imagen: string;
  /** Hasta 3 imágenes del producto; imagenes[0] coincide con `imagen`. */
  imagenes?: string[];
  estado: 'activo' | 'inactivo' | 'agotado';
  // optional fields
  codigo?: string;
  marca?: string;
  beneficios?: string;
  modoDeUso?: string;
  ingredientes?: string;
  // inventory control
  controlarInventario?: boolean;
  stockMinimo?: number;
  /** Only used when creating a product to seed its first stock movement. */
  stockInicial?: number;
  fechaCreacion?: string;
}

export interface Inventory {
  id: string;
  productoId: string;
  varianteId?: string;
  ubicacionId?: string;
  stockActual: number;
  stockMinimo: number;
  ubicacion: string;
}

export interface OrderItem {
  productoId: string;
  nombre: string;
  cantidad: number;
  precio: number;
}

export interface Order {
  id: string;
  numero?: string;
  clienteId: string;
  productos: OrderItem[];
  total: number;
  estado:
    | 'pendiente'
    | 'confirmado'
    | 'procesando'
    | 'empacado'
    | 'pagado'
    | 'enviado'
    | 'en_camino'
    | 'entregado'
    | 'cancelado'
    | 'devuelto'
    | 'fallido';
  fecha: string;
  metodoPago?: string;
  direccionEnvio?: string;
  ciudadEnvio?: string;
  departamentoEnvio?: string;
  paisEnvio?: string;
  latitudEnvio?: number | null;
  longitudEnvio?: number | null;
}

export interface Payment {
  id: string;
  pedidoId: string;
  metodo: 'pse' | 'tarjeta' | 'nequi' | 'daviplata' | 'efectivo';
  estado: 'aprobado' | 'rechazado' | 'pendiente';
  referencia: string;
  monto: number;
  fecha: string;
}

export interface Customer {
  id: string;
  tipoDocumento: string;
  documento: string;
  nombre: string;
  telefono: string;
  email: string;
  direccion: string;
  ciudad: string;
  totalCompras: number;
  ultimaCompra?: string;
  modoCompra?: 'RETAIL' | 'WHOLESALE';
  codigoMayorista?: string;
  companyName?: string;
  companyIdType?: string;
  companyIdTypeOther?: string;
  companyIdNumber?: string;
  businessType?: string;
  isInternationalDistributor?: boolean;
  companyPhone?: string;
}

export interface DashboardMetrics {
  ventasHoy: number;
  ventasMes: number;
  pedidosPendientes: number;
  productosStockBajo: number;
  clientesNuevos: number;
}
