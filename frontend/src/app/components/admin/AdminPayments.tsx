import { motion } from 'motion/react';
import { useAdmin } from '../../contexts/AdminContext';
import { CreditCard, Check, X, Clock } from 'lucide-react';
import { format } from 'date-fns';
import type { Payment } from '../../types/admin';

export function AdminPayments() {
  const { payments, orders } = useAdmin();

  const getStatusIcon = (estado: Payment['estado']) => {
    switch (estado) {
      case 'aprobado':
        return <Check className="w-4 h-4" strokeWidth={1} />;
      case 'rechazado':
        return <X className="w-4 h-4" strokeWidth={1} />;
      case 'pendiente':
        return <Clock className="w-4 h-4" strokeWidth={1} />;
    }
  };

  const getStatusColor = (estado: Payment['estado']) => {
    switch (estado) {
      case 'aprobado':
        return 'bg-green-100 text-green-800';
      case 'rechazado':
        return 'bg-red-100 text-red-800';
      case 'pendiente':
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getMetodoIcon = (metodo: Payment['metodo']) => {
    return <CreditCard className="w-4 h-4" strokeWidth={1} />;
  };

  const stats = {
    aprobados: payments.filter(p => p.estado === 'aprobado').length,
    pendientes: payments.filter(p => p.estado === 'pendiente').length,
    rechazados: payments.filter(p => p.estado === 'rechazado').length,
    total: payments.reduce((sum, p) => p.estado === 'aprobado' ? sum + p.monto : sum, 0),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl mb-2">Pagos</h1>
        <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
          {payments.length} transacciones registradas
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-secondary p-4 border border-border"
        >
          <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2">
            Aprobados
          </div>
          <div className="text-xl">{stats.aprobados}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-secondary p-4 border border-border"
        >
          <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2">
            Pendientes
          </div>
          <div className="text-xl">{stats.pendientes}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-secondary p-4 border border-border"
        >
          <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2">
            Rechazados
          </div>
          <div className="text-xl">{stats.rechazados}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-secondary p-4 border border-border"
        >
          <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2">
            Total Procesado
          </div>
          <div className="text-xl">${(stats.total / 1000).toFixed(0)}k</div>
        </motion.div>
      </div>

      {/* Payments Table */}
      <div className="bg-secondary border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-background border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                  ID Pago
                </th>
                <th className="px-4 py-3 text-left text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                  Pedido
                </th>
                <th className="px-4 py-3 text-left text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                  Método
                </th>
                <th className="px-4 py-3 text-right text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                  Monto
                </th>
                <th className="px-4 py-3 text-center text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                  Referencia
                </th>
                <th className="px-4 py-3 text-left text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                  Fecha
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.map((payment) => {
                const order = orders.find(o => o.id === payment.pedidoId);

                return (
                  <tr key={payment.id} className="hover:bg-background/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-xs font-mono">#{payment.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs">Pedido #{payment.pedidoId}</div>
                      {order && (
                        <div className="text-[10px] text-muted-foreground">
                          {order.productos.length} producto(s)
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getMetodoIcon(payment.metodo)}
                        <div className="text-xs capitalize">{payment.metodo}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-sm font-medium">${payment.monto.toLocaleString()}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 ${getStatusColor(payment.estado)}`}>
                        {getStatusIcon(payment.estado)}
                        <span className="capitalize">{payment.estado}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-mono text-muted-foreground">
                        {payment.referencia}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(payment.fecha), 'dd/MM/yyyy')}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {format(new Date(payment.fecha), 'HH:mm')}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {payments.length === 0 && (
        <div className="bg-secondary border border-border p-12 text-center">
          <CreditCard className="w-12 h-12 mx-auto mb-4 text-muted-foreground" strokeWidth={1} />
          <div className="text-sm text-muted-foreground">
            No hay transacciones registradas
          </div>
        </div>
      )}
    </div>
  );
}
