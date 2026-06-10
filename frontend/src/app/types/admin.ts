export type UserRole = 'admin' | 'vendedor' | 'distribuidor' | 'contador' | 'rrhh' | 'abogado';

export interface User {
  id: string;
  nombre: string;
  email: string;
  rol: UserRole;
}

export interface Product {
  id: string;
  nombre: string;
  categoria: 'capilar' | 'corporal' | 'baby' | 'personal';
  tipo: string;
  presentacion: string;
  precio: number;
  descripcion: string;
  imagen: string;
  estado: 'activo' | 'inactivo';
}

export interface Inventory {
  id: string;
  productoId: string;
  stockActual: number;
  stockMinimo: number;
  lote?: string;
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
  clienteId: string;
  productos: OrderItem[];
  total: number;
  estado: 'pendiente' | 'pagado' | 'enviado' | 'entregado' | 'cancelado';
  fecha: string;
  metodoPago?: string;
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
  nombre: string;
  telefono: string;
  email: string;
  direccion: string;
  ciudad: string;
  totalCompras: number;
  ultimaCompra?: string;
}

export interface DashboardMetrics {
  ventasHoy: number;
  ventasMes: number;
  pedidosPendientes: number;
  productosStockBajo: number;
  clientesNuevos: number;
}
