import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useAdmin } from '../../contexts/AdminContext';
import { EmployeeSelfProfileModal } from './EmployeeSelfProfileModal';
import {
  LayoutDashboard,
  Package,
  BookOpen,
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
  FlaskConical,
  HandCoins,
  Banknote,
  Settings,
  ScrollText,
  Ticket,
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
  currentView: string;
  onViewChange: (view: string) => void;
}

export function AdminLayout({ children, currentView, onViewChange }: AdminLayoutProps) {
  const { currentUser, logout } = useAdmin();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarHover, setSidebarHover] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const isCompactSidebar = currentView !== 'dashboard';
  const isSidebarExpanded = !isCompactSidebar || sidebarHover;

  const employeeAccessRoles = [
    'ADMIN',
    'SELLER',
    'DISTRIBUTOR',
    'RRHH',
    'EMPLEADO',
    'PEDIDOS',
    'PLANEACION',
    'DISPENSADOR',
    'VERIFICADOR_DISPENSACION',
    'OPERARIO_PRODUCCION',
    'SUPERVISOR_PRODUCCION',
    'OPERARIO_LLENADO',
    'OPERARIO_ACONDICIONAMIENTO',
    'ASEGURAMIENTO_CALIDAD',
    'CONTROL_CALIDAD',
    'DIRECTOR_TECNICO',
    'AUDITOR',
    'CONTABILIDAD',
    'TESORERIA',
  ];

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'SELLER'] },
    { id: 'products', label: 'Productos', icon: Package, roles: ['ADMIN'] },
    { id: 'raw-materials', label: 'Materias primas', icon: FlaskConical, roles: ['ADMIN'] },
    { id: 'flipbook-catalogs', label: 'Catálogos', icon: BookOpen, roles: ['ADMIN'] },
    { id: 'inventory', label: 'Stock Rápido', icon: Warehouse, roles: ['ADMIN'] },
    { id: 'inventory-production', label: 'Inventario', icon: Boxes, roles: ['ADMIN'] },
    { id: 'seller-discount', label: 'Descuentos', icon: Ticket, roles: ['SELLER'] },
    {
      id: 'manufacturing',
      label: 'Producción',
      icon: FlaskConical,
      roles: [
        'ADMIN',
        'PLANEACION',
        'DISPENSADOR',
        'VERIFICADOR_DISPENSACION',
        'OPERARIO_PRODUCCION',
        'SUPERVISOR_PRODUCCION',
        'OPERARIO_LLENADO',
        'OPERARIO_ACONDICIONAMIENTO',
        'ASEGURAMIENTO_CALIDAD',
        'CONTROL_CALIDAD',
        'DIRECTOR_TECNICO',
        'AUDITOR',
      ],
    },
    { id: 'orders', label: 'Pedidos', icon: ShoppingCart, roles: ['ADMIN', 'SELLER', 'DISTRIBUTOR', 'PEDIDOS'] },
    { id: 'customers', label: 'Clientes', icon: Users, roles: ['ADMIN'] },
    { id: 'referrals', label: 'Referidos', icon: Gift, roles: ['ADMIN'] },
    { id: 'shipping', label: 'Configuración de Envíos', icon: Truck, roles: ['ADMIN', 'PEDIDOS'] },
    { id: 'payments', label: 'Pagos', icon: CreditCard, roles: ['ADMIN'] },
    { id: 'reports', label: 'Reportes', icon: BarChart3, roles: ['ADMIN'] },
    { id: 'hr', label: 'RRHH', icon: Briefcase, roles: ['ADMIN', 'RRHH'] },
    { id: 'payroll', label: 'Nómina', icon: Banknote, roles: ['ADMIN', 'RRHH', 'CONTABILIDAD', 'TESORERIA'] },
    { id: 'employee-portal', label: 'Mis solicitudes', icon: CalendarClock, roles: ['ADMIN', 'SELLER', 'DISTRIBUTOR', 'RRHH', 'EMPLEADO', 'PEDIDOS'] },
    { id: 'company-documents', label: 'Reglamento interno', icon: ScrollText, roles: employeeAccessRoles },
    { id: 'employee-settings', label: 'Configuración', icon: Settings, roles: employeeAccessRoles },
    { id: 'loans', label: 'Préstamos', icon: HandCoins, roles: ['ADMIN', 'RRHH', 'CONTABILIDAD', 'TESORERIA'] },
    { id: 'roles', label: 'Roles', icon: Shield, roles: ['ADMIN'] },
    { id: 'components', label: 'Permisos', icon: Puzzle, roles: ['ADMIN'] },
  ] as const;

  const allowedNavItems = useMemo(() => {
    if (!currentUser) return navItems;
    // "Préstamos" también se habilita por acceso puntual (canViewLoans), no solo
    // por rol — así una persona específica puede verlo sin cambiar su rol asignado.
    return navItems.filter(
      item => item.roles.includes(currentUser.rol) || (item.id === 'loans' && currentUser.canViewLoans),
    );
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

  const Sidebar = ({ compact = false }: { compact?: boolean }) => (
    <div className={`bg-gray-50 border-r border-gray-100 h-full flex flex-col shadow-sm ${compact ? 'items-center' : ''}`}>
      <div className={`border-b border-gray-100 ${compact ? 'px-3 pt-5 pb-5' : 'px-5 pt-6 pb-4'}`}>
        {compact ? (
          <div className="h-12 w-12 rounded-2xl bg-[#2a4038] text-white flex items-center justify-center text-xs font-bold shadow-sm" title="Juhnios Rold">
            JR
          </div>
        ) : (
          <>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400 mb-0.5">Juhnios Rold</p>
            <p className="text-[11px] text-gray-500">Panel Admin</p>
          </>
        )}
      </div>

      <nav className={`flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${compact ? 'w-full px-3 py-4' : 'p-3'}`}>
        <div className={compact ? 'space-y-1.5' : 'space-y-0.5'}>
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
                title={compact ? item.label : undefined}
                className={`${compact ? 'mx-auto h-12 w-12 justify-center px-0' : 'w-full gap-3 px-3'} flex items-center py-2.5 rounded-2xl text-left text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[#2a4038] text-white shadow-sm'
                    : 'text-gray-600 hover:bg-white hover:shadow-sm'
                }`}
              >
                <Icon size={15} className={isActive ? 'text-white' : 'text-gray-400'} strokeWidth={1.75} />
                {!compact && item.label}
              </button>
            );
          })}
        </div>
      </nav>

      <div className={`border-t border-gray-100 ${compact ? 'w-full p-3 space-y-2' : 'p-3'}`}>
        <button
          type="button"
          onClick={() => {
            setProfileModalOpen(true);
            setSidebarOpen(false);
          }}
          className={`${compact ? 'mx-auto flex h-12 w-12 items-center justify-center p-0' : 'w-full mb-3 p-3 text-left'} bg-white border border-gray-100 rounded-2xl hover:border-[#2a4038]/40 hover:shadow-sm transition-all cursor-pointer`}
          title="Ver mi perfil"
        >
          {compact ? (
            <Users size={16} className="text-gray-500" strokeWidth={1.75} />
          ) : (
            <>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400 mb-1">Usuario</p>
              <p className="text-xs font-semibold text-gray-800 mb-0.5">{currentUser?.nombre}</p>
              <p className="text-[11px] text-gray-400">{roleLabel}</p>
            </>
          )}
        </button>
        <button
          onClick={logout}
          title="Cerrar sesión"
          className={`${compact ? 'mx-auto h-12 w-12 px-0 overflow-hidden text-[0px]' : 'w-full gap-2 px-4 text-xs'} flex items-center justify-center py-2.5 border border-gray-200 rounded-2xl font-semibold text-gray-600 hover:bg-white transition-colors`}
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
      <div
        className={`hidden md:block fixed left-0 top-0 bottom-0 z-30 transition-[width] duration-150 ${isSidebarExpanded ? 'w-56 lg:w-64' : 'w-20'}`}
        onMouseEnter={() => {
          if (isCompactSidebar) setSidebarHover(true);
        }}
        onMouseLeave={() => setSidebarHover(false)}
      >
        <Sidebar compact={!isSidebarExpanded} />
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
            <Sidebar compact={false} />
          </motion.div>
        </div>
      )}

      {/* Main Content */}
      <div className={`flex-1 min-w-0 transition-[margin] duration-150 ${isCompactSidebar ? 'md:ml-20' : 'md:ml-56 lg:ml-64'}`}>
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

      <EmployeeSelfProfileModal open={profileModalOpen} onClose={() => setProfileModalOpen(false)} />
    </div>
  );
}
