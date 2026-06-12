import { Calculator, Clock3, FileText, ShieldAlert } from 'lucide-react';

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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl mb-2">Nómina</h2>
          <p className="text-xs text-muted-foreground">
            Este módulo queda reservado para una fase posterior del proyecto.
          </p>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 border border-border bg-secondary/20 text-xs uppercase tracking-wider">
          <Calculator className="w-4 h-4" strokeWidth={1} />
          Próximamente
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="border border-border bg-secondary/20 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 border border-border bg-background">
                  <Icon className="w-4 h-4" strokeWidth={1} />
                </div>
                <h3 className="text-sm uppercase tracking-wider">{card.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-6">{card.description}</p>
            </div>
          );
        })}
      </div>

      <div className="border border-border bg-background p-6 md:p-8">
        <div className="max-w-2xl">
          <h3 className="text-lg mb-3">Estado actual</h3>
          <p className="text-sm text-muted-foreground leading-6">
            Por ahora, este espacio solo informa que la nómina no está operativa. Así evitamos
            dependencias innecesarias con el backend y dejamos el módulo listo para desarrollarlo
            más adelante con su propio flujo y reglas.
          </p>
        </div>
      </div>
    </div>
  );
}
