import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useAdmin } from '../../contexts/AdminContext';
import {
  LayoutDashboard,
  Package,
  Warehouse,
  Boxes,
  ShoppingCart,
  Users,
  CreditCard,
  BarChart3,
  Briefcase,
  CalendarClock,
  LogOut,
  Menu,
  X,
  Shield,
  Puzzle,
  Gift,
  Truck,
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
  currentView: string;
  onViewChange: (view: string) => void;
}

export function AdminLayout({ children, currentView, onViewChange }: AdminLayoutProps) {
  const { currentUser, logout } = useAdmin();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'SELLER'] },
    { id: 'products', label: 'Productos', icon: Package, roles: ['ADMIN', 'SELLER'] },
    { id: 'inventory', label: 'Stock Rápido', icon: Warehouse, roles: ['ADMIN', 'SELLER'] },
    { id: 'inventory-production', label: 'Inventario', icon: Boxes, roles: ['ADMIN', 'SELLER'] },
    { id: 'orders', label: 'Pedidos', icon: ShoppingCart, roles: ['ADMIN', 'SELLER', 'DISTRIBUTOR', 'PEDIDOS'] },
    { id: 'customers', label: 'Clientes', icon: Users, roles: ['ADMIN', 'SELLER'] },
    { id: 'referrals', label: 'Referidos', icon: Gift, roles: ['ADMIN'] },
    { id: 'shipping', label: 'Configuración de Envíos', icon: Truck, roles: ['ADMIN', 'PEDIDOS'] },
    { id: 'payments', label: 'Pagos', icon: CreditCard, roles: ['ADMIN', 'SELLER'] },
    { id: 'reports', label: 'Reportes', icon: BarChart3, roles: ['ADMIN', 'SELLER'] },
    { id: 'hr', label: 'RRHH', icon: Briefcase, roles: ['ADMIN', 'RRHH'] },
    { id: 'employee-portal', label: 'Mis solicitudes', icon: CalendarClock, roles: ['ADMIN', 'SELLER', 'DISTRIBUTOR', 'RRHH', 'EMPLEADO', 'PEDIDOS'] },
    { id: 'roles', label: 'Roles', icon: Shield, roles: ['ADMIN'] },
    { id: 'components', label: 'Permisos', icon: Puzzle, roles: ['ADMIN'] },
  ] as const;

  const allowedNavItems = useMemo(() => {
    if (!currentUser) return navItems;
    return navItems.filter(item => item.roles.includes(currentUser.rol));
  }, [currentUser, navItems]);

  const roleLabel = useMemo(() => {
    switch (currentUser?.rol) {
      case 'ADMIN':
        return 'Administrador';
      case 'RRHH':
        return 'Recursos humanos';
      case 'PEDIDOS':
        return 'Pedidos y seguimiento';
      case 'EMPLEADO':
        return 'Empleado';
      case 'SELLER':
        return 'Vendedor';
      case 'DISTRIBUTOR':
        return 'Distribuidor';
      default:
        return currentUser?.rol ?? '';
    }
  }, [currentUser?.rol]);

  const Sidebar = () => (
    <div className="bg-gray-50 border-r border-gray-100 h-full flex flex-col">
      <div className="px-5 pt-6 pb-4 border-b border-gray-100">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400 mb-0.5">Juhnios Rold</p>
        <p className="text-[11px] text-gray-500">Panel Admin</p>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <div className="space-y-0.5">
          {allowedNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  onViewChange(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[#2a4038] text-white shadow-sm'
                    : 'text-gray-600 hover:bg-white hover:shadow-sm'
                }`}
              >
                <Icon size={15} className={isActive ? 'text-white' : 'text-gray-400'} strokeWidth={1.75} />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="p-3 border-t border-gray-100">
        <div className="mb-3 p-3 bg-white border border-gray-100 rounded-xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400 mb-1">Usuario</p>
          <p className="text-xs font-semibold text-gray-800 mb-0.5">{currentUser?.nombre}</p>
          <p className="text-[11px] text-gray-400">{roleLabel}</p>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-white transition-colors"
        >
          <LogOut size={14} strokeWidth={1.75} />
          Cerrar Sesión
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50/40 flex">
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-56 lg:w-64 fixed left-0 top-0 bottom-0 z-30">
        <Sidebar />
      </div>

      {/* Mobile Sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <motion.div
            initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="absolute left-0 top-0 bottom-0 w-64 bg-gray-50 shadow-xl"
          >
            <Sidebar />
          </motion.div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 md:ml-56 lg:ml-64 min-w-0">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-40 bg-white border-b border-gray-100 md:hidden">
          <div className="flex items-center justify-between px-4 h-14">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Menu className="w-5 h-5 text-gray-600" strokeWidth={1.75} />
            </button>
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400 leading-none">Juhnios Rold</p>
              <p className="text-[9px] text-gray-400 mt-0.5">{roleLabel}</p>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 md:p-8 overflow-x-hidden">{children}</div>
      </div>
    </div>
  );
}
