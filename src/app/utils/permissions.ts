type Role = 'admin' | 'vendedor' | 'distribuidor';

interface Permission {
  // Products
  canCreateProducts: boolean;
  canEditProducts: boolean;
  canDeleteProducts: boolean;
  canViewProducts: boolean;

  // Inventory
  canManageInventory: boolean;
  canViewInventory: boolean;

  // Orders
  canViewAllOrders: boolean;
  canUpdateOrderStatus: boolean;
  canCancelOrders: boolean;

  // Customers
  canViewCustomers: boolean;
  canEditCustomers: boolean;
  canDeleteCustomers: boolean;

  // Payments
  canViewPayments: boolean;
  canProcessRefunds: boolean;

  // Reports
  canViewReports: boolean;
  canExportData: boolean;

  // Settings
  canAccessSettings: boolean;
  canManageUsers: boolean;
}

export const rolePermissions: Record<Role, Permission> = {
  admin: {
    // Full access to everything
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

  vendedor: {
    // Can manage products and orders, limited access
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

  distribuidor: {
    // Can view inventory and orders, very limited write access
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
    case 'admin':
      return 'Administrador';
    case 'vendedor':
      return 'Vendedor';
    case 'distribuidor':
      return 'Distribuidor';
    default:
      return role;
  }
}

export function getRoleBadgeColor(role: Role): string {
  switch (role) {
    case 'admin':
      return 'bg-purple-100 text-purple-900 border-purple-200';
    case 'vendedor':
      return 'bg-blue-100 text-blue-900 border-blue-200';
    case 'distribuidor':
      return 'bg-green-100 text-green-900 border-green-200';
    default:
      return 'bg-gray-100 text-gray-900 border-gray-200';
  }
}
