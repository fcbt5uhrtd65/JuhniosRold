import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useAdmin } from '../../contexts/AdminContext';
import {
  LayoutDashboard,
  Package,
  Warehouse,
  ShoppingCart,
  Users,
  CreditCard,
  BarChart3,
  Calculator,
  Briefcase,
  Scale,
  CalendarClock,
  LogOut,
  Menu,
  X,
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
    { id: 'inventory', label: 'Inventario', icon: Warehouse, roles: ['ADMIN', 'SELLER'] },
    { id: 'orders', label: 'Pedidos', icon: ShoppingCart, roles: ['ADMIN', 'SELLER', 'DISTRIBUTOR', 'PEDIDOS'] },
    { id: 'customers', label: 'Clientes', icon: Users, roles: ['ADMIN', 'SELLER'] },
    { id: 'payments', label: 'Pagos', icon: CreditCard, roles: ['ADMIN', 'SELLER'] },
    { id: 'reports', label: 'Reportes', icon: BarChart3, roles: ['ADMIN', 'SELLER'] },
    { id: 'payroll', label: 'Nómina', icon: Calculator, roles: ['ADMIN', 'RRHH'] },
    { id: 'hr', label: 'RRHH', icon: Briefcase, roles: ['ADMIN', 'RRHH'] },
    { id: 'employee-portal', label: 'Mis solicitudes', icon: CalendarClock, roles: ['ADMIN', 'EMPLEADO'] },
    { id: 'legal', label: 'Legal', icon: Scale, roles: ['ADMIN'] },
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
    <div className="bg-secondary border-r border-border h-full flex flex-col">
      <div className="p-6 border-b border-border">
        <div className="text-xs tracking-[0.3em] uppercase mb-2">JUHNIOS ROLD</div>
        <div className="text-[10px] text-muted-foreground">Panel Admin</div>
      </div>

      <nav className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
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
                className={`w-full flex items-center gap-3 px-4 py-3 text-xs tracking-wider uppercase transition-colors ${
                  isActive
                    ? 'bg-foreground text-background'
                    : 'hover:bg-background'
                }`}
              >
                <Icon className="w-4 h-4" strokeWidth={1} />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="p-4 border-t border-border">
        <div className="mb-4 p-3 bg-background border border-border">
          <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-1">
            Usuario
          </div>
          <div className="text-xs mb-1">{currentUser?.nombre}</div>
          <div className="text-[10px] text-muted-foreground">{roleLabel}</div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-border text-xs tracking-wider uppercase hover:bg-background transition-colors"
        >
          <LogOut className="w-4 h-4" strokeWidth={1} />
          Cerrar Sesión
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-64 fixed left-0 top-0 bottom-0">
        <Sidebar />
      </div>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-foreground/90"
            onClick={() => setSidebarOpen(false)}
          />
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className="absolute left-0 top-0 bottom-0 w-64 bg-background"
          >
            <Sidebar />
          </motion.div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 md:ml-64">
        <div className="sticky top-0 z-40 bg-background border-b border-border p-4 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 hover:bg-secondary transition-colors"
          >
            <Menu className="w-5 h-5" strokeWidth={1} />
          </button>
        </div>

        <div className="p-6 md:p-8">{children}</div>
      </div>
    </div>
  );
}
