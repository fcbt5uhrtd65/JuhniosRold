import { useEffect, useMemo, useState } from 'react';
import { Gift, Users, Clock, CheckCircle2, Loader2, Inbox, AlertCircle } from 'lucide-react';
import { getReferralRedemptions, type ReferralRedemption, type ReferralRedemptionStatus } from '../../services/referrals.service';
import { KpiCard, Card, Badge, PageHeader, Table, Th, Td, selectCls, type BadgeColor } from './AdminUI';
import { format } from 'date-fns';

const STATUS_LABEL: Record<ReferralRedemptionStatus, string> = {
  PENDING: 'Pendiente',
  VALIDATED: 'Validado',
  REWARDED: 'Recompensado',
  REJECTED: 'Rechazado',
};

const STATUS_COLOR: Record<ReferralRedemptionStatus, BadgeColor> = {
  PENDING: 'yellow',
  VALIDATED: 'blue',
  REWARDED: 'green',
  REJECTED: 'red',
};

export function AdminReferrals() {
  const [redemptions, setRedemptions] = useState<ReferralRedemption[]>([]);
  const [statusFilter, setStatusFilter] = useState<ReferralRedemptionStatus | ''>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setError(null);
    getReferralRedemptions(statusFilter ? { status: statusFilter } : undefined)
      .then(res => { if (mounted) setRedemptions(res.results); })
      .catch(err => { if (mounted) setError(err instanceof Error ? err.message : 'No se pudo cargar la información.'); })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, [statusFilter]);

  const kpis = useMemo(() => {
    const total = redemptions.length;
    const pending = redemptions.filter(r => r.status === 'PENDING').length;
    const rewarded = redemptions.filter(r => r.status === 'REWARDED').length;
    const uniqueReferrers = new Set(redemptions.map(r => r.referrer_customer)).size;
    return { total, pending, rewarded, uniqueReferrers };
  }, [redemptions]);

  return (
    <div>
      <PageHeader
        title="Programa de referidos"
        subtitle="Auditoría de códigos de referido y canjes registrados por clientes."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Canjes totales" value={String(kpis.total)} icon={Gift} color="bg-emerald-50 text-emerald-600" />
        <KpiCard label="Pendientes" value={String(kpis.pending)} icon={Clock} color="bg-amber-50 text-amber-600" />
        <KpiCard label="Recompensados" value={String(kpis.rewarded)} icon={CheckCircle2} color="bg-blue-50 text-blue-600" />
        <KpiCard label="Referentes activos" value={String(kpis.uniqueReferrers)} icon={Users} color="bg-purple-50 text-purple-600" />
      </div>

      <div className="flex items-center gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as ReferralRedemptionStatus | '')}
          className={`${selectCls} max-w-[220px]`}
        >
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <Card className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="animate-spin" size={20} />
        </Card>
      ) : error ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center gap-2 text-gray-400">
          <AlertCircle size={22} />
          <p className="text-sm">{error}</p>
        </Card>
      ) : redemptions.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center gap-2 text-gray-400">
          <Inbox size={22} />
          <p className="text-sm">Aún no hay canjes de referidos registrados.</p>
        </Card>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Código</Th>
              <Th>Referente</Th>
              <Th>Referido</Th>
              <Th>Estado</Th>
              <Th>Fecha de canje</Th>
            </tr>
          </thead>
          <tbody>
            {redemptions.map(r => (
              <tr key={r.id}>
                <Td className="font-mono text-xs font-semibold text-gray-900">{r.referral_code_value}</Td>
                <Td>{r.referrer_name}</Td>
                <Td>{r.referred_name}</Td>
                <Td><Badge label={STATUS_LABEL[r.status]} color={STATUS_COLOR[r.status]} /></Td>
                <Td>{format(new Date(r.redeemed_at), 'dd/MM/yyyy HH:mm')}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
