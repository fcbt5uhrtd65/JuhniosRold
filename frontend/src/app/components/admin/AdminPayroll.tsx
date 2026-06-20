import { Calculator, Clock3, FileText, ShieldAlert } from 'lucide-react';
import { Card, Badge } from './AdminUI';

export function AdminPayroll() {
  const cards = [
    {
      title: 'Proceso pendiente',
      description: 'La nómina se implementará más adelante, cuando el flujo de cálculo y aprobación esté definido.',
      icon: ShieldAlert,
    },
    {
      title: 'Sin backend por ahora',
      description: 'Esta vista no consulta servicios de backend ni expone formularios operativos.',
      icon: Clock3,
    },
    {
      title: 'Preparado para el futuro',
      description: 'Cuando llegue el momento, aquí conectaremos empleados, períodos y liquidaciones.',
      icon: FileText,
    },
  ];

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Nómina</h2>
          <p className="text-xs text-gray-500 mt-0.5">Este módulo queda reservado para una fase posterior del proyecto.</p>
        </div>

        <Badge label={<span className="flex items-center gap-1.5"><Calculator size={12} />Próximamente</span>} color="yellow" />
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500">
                  <Icon size={16} />
                </div>
                <h3 className="text-xs font-semibold text-gray-900">{card.title}</h3>
              </div>
              <p className="text-sm text-gray-500 leading-6">{card.description}</p>
            </Card>
          );
        })}
      </div>

      <Card className="p-6 md:p-8">
        <div className="max-w-2xl">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Estado actual</h3>
          <p className="text-sm text-gray-500 leading-6">
            Por ahora, este espacio solo informa que la nómina no está operativa. Así evitamos
            dependencias innecesarias con el backend y dejamos el módulo listo para desarrollarlo
            más adelante con su propio flujo y reglas.
          </p>
        </div>
      </Card>
    </div>
  );
}
