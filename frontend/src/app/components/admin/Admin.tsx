import { useEffect, useState } from 'react';
import { useAdmin } from '../../contexts/AdminContext';
import { AdminLogin } from './AdminLogin';
import { AdminLayout } from './AdminLayout';
import { AdminDashboard } from './AdminDashboard';
import { AdminProducts } from './AdminProducts';
import { AdminInventory } from './AdminInventory';
import { AdminOrders } from './AdminOrders';
import { AdminCustomers } from './AdminCustomers';
import { AdminPayments } from './AdminPayments';
import { AdminReports } from './AdminReports';
import { AdminPayroll } from './AdminPayroll';
import { AdminHR } from './AdminHR';
import { AdminLegal } from './AdminLegal';
import { AdminEmployeePortal } from './AdminEmployeePortal';

function getDefaultViewForRole(role?: string) {
  switch (role) {
    case 'RRHH':
      return 'hr';
    case 'PEDIDOS':
      return 'orders';
    case 'EMPLEADO':
      return 'employee-portal';
    case 'SELLER':
      return 'products';
    case 'DISTRIBUTOR':
      return 'orders';
    case 'ADMIN':
    default:
      return 'dashboard';
  }
}

export function Admin() {
  const { currentUser } = useAdmin();
  const [currentView, setCurrentView] = useState(getDefaultViewForRole(currentUser?.rol));
  const [inventorySearch, setInventorySearch] = useState('');

  useEffect(() => {
    setCurrentView(getDefaultViewForRole(currentUser?.rol));
  }, [currentUser?.rol]);

  if (!currentUser) {
    return <AdminLogin />;
  }

  const goToInventory = (search: string) => {
    setInventorySearch(search);
    setCurrentView('inventory');
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <AdminDashboard />;
      case 'products':
        return <AdminProducts onViewInInventory={goToInventory} />;
      case 'inventory':
        return <AdminInventory initialSearch={inventorySearch} />;
      case 'orders':
        return <AdminOrders />;
      case 'customers':
        return <AdminCustomers />;
      case 'payments':
        return <AdminPayments />;
      case 'reports':
        return <AdminReports />;
      case 'payroll':
        return <AdminPayroll />;
      case 'hr':
        return <AdminHR />;
      case 'legal':
        return <AdminLegal />;
      case 'employee-portal':
        return <AdminEmployeePortal />;
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <AdminLayout currentView={currentView} onViewChange={setCurrentView}>
      {renderView()}
    </AdminLayout>
  );
}
