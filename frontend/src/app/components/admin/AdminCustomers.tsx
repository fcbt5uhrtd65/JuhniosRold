import { useState } from 'react';
import { useAdmin } from '../../contexts/AdminContext';
import { Users, TrendingUp, DollarSign, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { LocationPicker } from '../ui/LocationPicker';
import { AddressMap } from '../ui/AddressMap';
import { EMPTY_LOCATION, type LocationValue } from '../../services/geography.types';
import { KpiCard, Table, Th, Td, Modal, Field, inputCls, selectCls } from './AdminUI';

export function AdminCustomers() {
  const { customers, orders, addCustomer } = useAdmin();
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    tipoDocumento: 'CC',
    documento: '',
    nombre: '',
    telefono: '',
    email: '',
    direccion: '',
    ciudad: '',
  });
  const [customerLocation, setCustomerLocation] = useState<LocationValue>(EMPTY_LOCATION);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await addCustomer({ ...formData, ciudad: customerLocation.cityName || formData.ciudad });
    setFormData({ tipoDocumento: 'CC', documento: '', nombre: '', telefono: '', email: '', direccion: '', ciudad: '' });
    setCustomerLocation(EMPTY_LOCATION);
    setShowModal(false);
  };

  const topCustomers = customers
    .slice()
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Clientes</h2>
          <p className="text-xs text-gray-500 mt-0.5">{customers.length} clientes registrados</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#2a4038] text-white text-xs font-semibold rounded-xl hover:bg-[#3d5c4e] transition-colors"
        >
          <Plus size={14} /> Nuevo Cliente
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <KpiCard label="Total" value={String(stats.total)} icon={Users} color="text-[#2a4038] bg-[#2a4038]/10" />
        <KpiCard label="Nuevos (30d)" value={String(stats.nuevos)} icon={TrendingUp} color="text-emerald-600 bg-emerald-50" />
        <KpiCard label="Total Compras" value={`$${(stats.ingresos / 1000).toFixed(0)}k`} icon={DollarSign} color="text-blue-600 bg-blue-50" />
      </div>

      {/* Top Customers */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Top 10 Clientes</h3>
        <Table>
          <thead>
            <tr>
              <Th>Cliente</Th>
              <Th>Documento</Th>
              <Th>Contacto</Th>
              <Th>Ciudad</Th>
              <Th>Pedidos</Th>
              <Th>Total Compras</Th>
              <Th>Última Compra</Th>
            </tr>
          </thead>
          <tbody>
            {topCustomers.map((customer) => {
              const customerOrders = getCustomerOrders(customer.id);

              return (
                <tr key={customer.id} className="hover:bg-gray-50/50">
                  <Td className="font-medium text-gray-900">{customer.nombre}</Td>
                  <Td>{customer.tipoDocumento} {customer.documento}</Td>
                  <Td>
                    <div>{customer.email}</div>
                    <div className="text-[11px] text-gray-400">{customer.telefono}</div>
                  </Td>
                  <Td>{customer.ciudad}</Td>
                  <Td>{customerOrders.length}</Td>
                  <Td className="font-semibold">${customer.totalCompras.toLocaleString()}</Td>
                  <Td className="text-gray-500">
                    {customer.ultimaCompra ? format(new Date(customer.ultimaCompra), 'dd/MM/yyyy') : '-'}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>

      {/* Modal */}
      <Modal title="Nuevo Cliente" open={showModal} onClose={() => setShowModal(false)} wide>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Tipo de Documento" required>
              <select
                value={formData.tipoDocumento}
                onChange={(e) => setFormData({ ...formData, tipoDocumento: e.target.value })}
                className={selectCls}
                required
              >
                <option value="CC">Cédula de Ciudadanía</option>
                <option value="CE">Cédula de Extranjería</option>
                <option value="PASSPORT">Pasaporte</option>
                <option value="NIT">NIT</option>
                <option value="OTHER">Otro</option>
              </select>
            </Field>

            <Field label="Número de Documento" required>
              <input
                type="text"
                value={formData.documento}
                onChange={(e) => setFormData({ ...formData, documento: e.target.value })}
                className={inputCls}
                required
              />
            </Field>

            <Field label="Nombre Completo" required>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                className={inputCls}
                required
              />
            </Field>

            <Field label="Teléfono" required>
              <input
                type="tel"
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                className={inputCls}
                required
              />
            </Field>

            <Field label="Email" required>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={inputCls}
                required
              />
            </Field>

            <div className="sm:col-span-2">
              <LocationPicker
                value={customerLocation}
                onChange={setCustomerLocation}
              />
            </div>
          </div>

          <Field label="Dirección" required>
            <input
              type="text"
              value={formData.direccion}
              onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
              className={inputCls}
              required
            />
          </Field>

          {/* Mapa de vista previa */}
          {(formData.direccion || customerLocation.cityName) && (
            <AddressMap
              address={formData.direccion}
              city={customerLocation.cityName}
              country={customerLocation.countryName || 'Colombia'}
              className="h-56 rounded-xl border border-gray-200"
            />
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 py-2.5 bg-[#2a4038] text-white rounded-xl text-sm font-semibold hover:bg-[#3d5c4e] transition-colors"
            >
              Crear Cliente
            </button>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
