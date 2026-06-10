import { useState } from 'react';
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

export function Admin() {
  const { currentUser } = useAdmin();
  const [currentView, setCurrentView] = useState('dashboard');

  if (!currentUser) {
    return <AdminLogin />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <AdminDashboard />;
      case 'products':
        return <AdminProducts />;
      case 'inventory':
        return <AdminInventory />;
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
