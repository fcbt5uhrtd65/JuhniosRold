type Role =
  | 'ADMIN'
  | 'CLIENT'
  | 'PRO'
  | 'SELLER'
  | 'DISTRIBUTOR'
  | 'RRHH'
  | 'EMPLEADO'
  | 'PEDIDOS';

interface Permission {
  canCreateProducts: boolean;
  canEditProducts: boolean;
  canDeleteProducts: boolean;
  canViewProducts: boolean;
  canManageInventory: boolean;
  canViewInventory: boolean;
  canViewAllOrders: boolean;
  canUpdateOrderStatus: boolean;
  canCancelOrders: boolean;
  canViewCustomers: boolean;
  canEditCustomers: boolean;
  canDeleteCustomers: boolean;
  canViewPayments: boolean;
  canProcessRefunds: boolean;
  canViewReports: boolean;
  canExportData: boolean;
  canAccessSettings: boolean;
  canManageUsers: boolean;
}

export const rolePermissions: Record<Role, Permission> = {
  ADMIN: {
    canCreateProducts: true,
    canEditProducts: true,
    canDeleteProducts: true,
    canViewProducts: true,
    canManageInventory: true,
    canViewInventory: true,
    canViewAllOrders: true,
    canUpdateOrderStatus: true,
    canCancelOrders: true,
    canViewCustomers: true,
    canEditCustomers: true,
    canDeleteCustomers: true,
    canViewPayments: true,
    canProcessRefunds: true,
    canViewReports: true,
    canExportData: true,
    canAccessSettings: true,
    canManageUsers: true,
  },
  CLIENT: {
    canCreateProducts: false,
    canEditProducts: false,
    canDeleteProducts: false,
    canViewProducts: true,
    canManageInventory: false,
    canViewInventory: false,
    canViewAllOrders: false,
    canUpdateOrderStatus: false,
    canCancelOrders: false,
    canViewCustomers: false,
    canEditCustomers: false,
    canDeleteCustomers: false,
    canViewPayments: false,
    canProcessRefunds: false,
    canViewReports: false,
    canExportData: false,
    canAccessSettings: false,
    canManageUsers: false,
  },
  PRO: {
    canCreateProducts: false,
    canEditProducts: false,
    canDeleteProducts: false,
    canViewProducts: true,
    canManageInventory: false,
    canViewInventory: false,
    canViewAllOrders: false,
    canUpdateOrderStatus: false,
    canCancelOrders: false,
    canViewCustomers: false,
    canEditCustomers: false,
    canDeleteCustomers: false,
    canViewPayments: false,
    canProcessRefunds: false,
    canViewReports: false,
    canExportData: false,
    canAccessSettings: false,
    canManageUsers: false,
  },
  SELLER: {
    canCreateProducts: true,
    canEditProducts: true,
    canDeleteProducts: false,
    canViewProducts: true,
    canManageInventory: true,
    canViewInventory: true,
    canViewAllOrders: true,
    canUpdateOrderStatus: true,
    canCancelOrders: false,
    canViewCustomers: true,
    canEditCustomers: false,
    canDeleteCustomers: false,
    canViewPayments: true,
    canProcessRefunds: false,
    canViewReports: true,
    canExportData: false,
    canAccessSettings: false,
    canManageUsers: false,
  },
  DISTRIBUTOR: {
    canCreateProducts: false,
    canEditProducts: false,
    canDeleteProducts: false,
    canViewProducts: true,
    canManageInventory: false,
    canViewInventory: true,
    canViewAllOrders: true,
    canUpdateOrderStatus: false,
    canCancelOrders: false,
    canViewCustomers: true,
    canEditCustomers: false,
    canDeleteCustomers: false,
    canViewPayments: true,
    canProcessRefunds: false,
    canViewReports: true,
    canExportData: false,
    canAccessSettings: false,
    canManageUsers: false,
  },
  RRHH: {
    canCreateProducts: false,
    canEditProducts: false,
    canDeleteProducts: false,
    canViewProducts: false,
    canManageInventory: false,
    canViewInventory: false,
    canViewAllOrders: false,
    canUpdateOrderStatus: false,
    canCancelOrders: false,
    canViewCustomers: false,
    canEditCustomers: false,
    canDeleteCustomers: false,
    canViewPayments: false,
    canProcessRefunds: false,
    canViewReports: true,
    canExportData: true,
    canAccessSettings: false,
    canManageUsers: true,
  },
  EMPLEADO: {
    canCreateProducts: false,
    canEditProducts: false,
    canDeleteProducts: false,
    canViewProducts: false,
    canManageInventory: false,
    canViewInventory: false,
    canViewAllOrders: false,
    canUpdateOrderStatus: false,
    canCancelOrders: false,
    canViewCustomers: false,
    canEditCustomers: false,
    canDeleteCustomers: false,
    canViewPayments: false,
    canProcessRefunds: false,
    canViewReports: false,
    canExportData: false,
    canAccessSettings: false,
    canManageUsers: false,
  },
  PEDIDOS: {
    canCreateProducts: false,
    canEditProducts: false,
    canDeleteProducts: false,
    canViewProducts: true,
    canManageInventory: true,
    canViewInventory: true,
    canViewAllOrders: true,
    canUpdateOrderStatus: true,
    canCancelOrders: true,
    canViewCustomers: true,
    canEditCustomers: false,
    canDeleteCustomers: false,
    canViewPayments: true,
    canProcessRefunds: false,
    canViewReports: true,
    canExportData: false,
    canAccessSettings: false,
    canManageUsers: false,
  },
};

export function hasPermission(role: Role, permission: keyof Permission): boolean {
  return rolePermissions[role]?.[permission] ?? false;
}

export function canAccessFeature(role: Role, feature: string): boolean {
  switch (feature) {
    case 'products':
      return hasPermission(role, 'canViewProducts');
    case 'inventory':
      return hasPermission(role, 'canViewInventory');
    case 'orders':
      return hasPermission(role, 'canViewAllOrders');
    case 'customers':
      return hasPermission(role, 'canViewCustomers');
    case 'payments':
      return hasPermission(role, 'canViewPayments');
    case 'reports':
      return hasPermission(role, 'canViewReports');
    case 'settings':
      return hasPermission(role, 'canAccessSettings');
    default:
      return false;
  }
}

export function getRoleLabel(role: Role): string {
  switch (role) {
    case 'ADMIN':
      return 'Administrador';
    case 'CLIENT':
      return 'Cliente';
    case 'PRO':
      return 'Cliente PRO';
    case 'SELLER':
      return 'Vendedor';
    case 'DISTRIBUTOR':
      return 'Distribuidor';
    case 'RRHH':
      return 'RRHH';
    case 'EMPLEADO':
      return 'Empleado';
    case 'PEDIDOS':
      return 'Pedidos y seguimiento';
    default:
      return role;
  }
}

export function getRoleBadgeColor(role: Role): string {
  switch (role) {
    case 'ADMIN':
      return 'bg-purple-100 text-purple-900 border-purple-200';
    case 'RRHH':
      return 'bg-rose-100 text-rose-900 border-rose-200';
    case 'EMPLEADO':
      return 'bg-slate-100 text-slate-900 border-slate-200';
    case 'PEDIDOS':
      return 'bg-amber-100 text-amber-900 border-amber-200';
    case 'SELLER':
      return 'bg-blue-100 text-blue-900 border-blue-200';
    case 'DISTRIBUTOR':
      return 'bg-green-100 text-green-900 border-green-200';
    case 'PRO':
      return 'bg-indigo-100 text-indigo-900 border-indigo-200';
    case 'CLIENT':
      return 'bg-gray-100 text-gray-900 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-900 border-gray-200';
  }
}
