import { useState } from 'react';
import { motion } from 'motion/react';
import { useAdmin } from '../../contexts/AdminContext';
import { Users, TrendingUp, DollarSign, Plus } from 'lucide-react';
import { format } from 'date-fns';
import type { Customer } from '../../types/admin';

export function AdminCustomers() {
  const { customers, orders, addCustomer } = useAdmin();
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    email: '',
    direccion: '',
    ciudad: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addCustomer(formData);
    setFormData({
      nombre: '',
      telefono: '',
      email: '',
      direccion: '',
      ciudad: '',
    });
    setShowModal(false);
  };

  const topCustomers = customers
    .sort((a, b) => b.totalCompras - a.totalCompras)
    .slice(0, 10);

  const stats = {
    total: customers.length,
    nuevos: customers.filter(c => {
      if (!c.ultimaCompra) return false;
      const daysSince = (Date.now() - new Date(c.ultimaCompra).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 30;
    }).length,
    ingresos: customers.reduce((sum, c) => sum + c.totalCompras, 0),
  };

  const getCustomerOrders = (customerId: string) => {
    return orders.filter(o => o.clienteId === customerId && o.estado !== 'cancelado');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl mb-2">Clientes</h1>
          <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
            {customers.length} clientes registrados
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-foreground text-background text-xs tracking-wider uppercase hover:opacity-90"
        >
          <Plus className="w-4 h-4" strokeWidth={1} />
          Nuevo Cliente
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-secondary p-4 border border-border"
        >
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-muted-foreground" strokeWidth={1} />
            <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              Total
            </div>
          </div>
          <div className="text-xl">{stats.total}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-secondary p-4 border border-border"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" strokeWidth={1} />
            <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              Nuevos (30d)
            </div>
          </div>
          <div className="text-xl">{stats.nuevos}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-secondary p-4 border border-border"
        >
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-muted-foreground" strokeWidth={1} />
            <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              Total Compras
            </div>
          </div>
          <div className="text-xl">${(stats.ingresos / 1000).toFixed(0)}k</div>
        </motion.div>
      </div>

      {/* Top Customers */}
      <div>
        <div className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4">
          Top 10 Clientes
        </div>
        <div className="bg-secondary border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                    Contacto
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                    Ciudad
                  </th>
                  <th className="px-4 py-3 text-center text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                    Pedidos
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                    Total Compras
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                    Última Compra
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topCustomers.map((customer) => {
                  const customerOrders = getCustomerOrders(customer.id);

                  return (
                    <tr key={customer.id} className="hover:bg-background/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-xs">{customer.nombre}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs">{customer.email}</div>
                        <div className="text-[10px] text-muted-foreground">{customer.telefono}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs">{customer.ciudad}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="text-xs">{customerOrders.length}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-xs font-medium">${customer.totalCompras.toLocaleString()}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-muted-foreground">
                          {customer.ultimaCompra
                            ? format(new Date(customer.ultimaCompra), 'dd/MM/yyyy')
                            : '-'}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-foreground/90 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="bg-background p-6 max-w-2xl w-full"
          >
            <h2 className="text-2xl mb-6">Nuevo Cliente</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2 block">
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full px-3 py-2 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2 block">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    className="w-full px-3 py-2 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2 block">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2 block">
                    Ciudad
                  </label>
                  <input
                    type="text"
                    value={formData.ciudad}
                    onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
                    className="w-full px-3 py-2 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2 block">
                  Dirección
                </label>
                <input
                  type="text"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  className="w-full px-3 py-2 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-foreground text-background text-xs tracking-wider uppercase hover:opacity-90"
                >
                  Crear Cliente
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 border border-border text-xs tracking-wider uppercase hover:bg-secondary"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
