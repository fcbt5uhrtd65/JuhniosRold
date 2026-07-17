import { type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function getMonthGrid(month: Date): Date[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstOfMonth = new Date(year, monthIndex, 1);
  // Lunes = 0 ... Domingo = 6
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, monthIndex, 1 - firstWeekday);

  const days: Date[] = [];
  for (let i = 0; i < 42; i += 1) {
    days.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  }
  return days;
}

function getMonthLabel(month: Date): string {
  return month.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
}

function addMonths(month: Date, delta: number): Date {
  return new Date(month.getFullYear(), month.getMonth() + delta, 1);
}

export { toDateKey, isSameDay, isSameMonth, getMonthGrid, addMonths };

export function CalendarMonthNav({ month, onChange }: { month: Date; onChange: (month: Date) => void }) {
  const label = getMonthLabel(month);
  return (
    <div className="flex items-center justify-between sm:justify-start gap-3">
      <button
        type="button"
        onClick={() => onChange(addMonths(month, -1))}
        className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
        aria-label="Mes anterior"
      >
        <ChevronLeft size={15} />
      </button>
      <div className="min-w-[140px] text-center sm:text-left">
        <p className="text-sm font-semibold text-gray-900 capitalize">{label}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(addMonths(month, 1))}
        className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
        aria-label="Mes siguiente"
      >
        <ChevronRight size={15} />
      </button>
      <button
        type="button"
        onClick={() => onChange(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
        className="hidden sm:inline-flex px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
      >
        Hoy
      </button>
    </div>
  );
}

export function MonthCalendar({
  month,
  renderDay,
}: {
  month: Date;
  renderDay: (date: Date, inCurrentMonth: boolean) => ReactNode;
}) {
  const days = getMonthGrid(month);
  const today = new Date();

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-400 py-1">
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((date) => {
            const inCurrentMonth = isSameMonth(date, month);
            const isToday = isSameDay(date, today);
            return (
              <div
                key={toDateKey(date)}
                className={`min-h-[92px] sm:min-h-[108px] rounded-xl border p-1.5 flex flex-col gap-1 ${
                  inCurrentMonth ? 'bg-white border-gray-100' : 'bg-gray-50/60 border-gray-50'
                } ${isToday ? 'ring-2 ring-[#2a4038]/30' : ''}`}
              >
                <span className={`text-[11px] font-semibold ${inCurrentMonth ? 'text-gray-700' : 'text-gray-300'} ${isToday ? 'text-[#2a4038]' : ''}`}>
                  {date.getDate()}
                </span>
                <div className="flex-1 flex flex-col gap-1 min-h-0">{renderDay(date, inCurrentMonth)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export type CalendarChipColor = 'green' | 'blue' | 'amber' | 'purple' | 'red' | 'pink';

const CALENDAR_CHIP_STYLES: Record<CalendarChipColor, string> = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  pink: 'bg-pink-50 text-pink-700 border-pink-200',
};

export function CalendarChip({
  label,
  color,
  onClick,
}: {
  label: string;
  color: CalendarChipColor;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-1.5 py-0.5 rounded-md border text-[9.5px] sm:text-[10.5px] font-medium truncate transition-colors ${CALENDAR_CHIP_STYLES[color]} ${onClick ? 'hover:opacity-75 cursor-pointer' : 'cursor-default'}`}
      title={label}
    >
      {label}
    </button>
  );
}

export function CalendarMoreChip({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-1.5 py-0.5 rounded-md text-[9.5px] sm:text-[10.5px] font-semibold text-gray-500 hover:text-gray-700 transition-colors"
    >
      +{count} más
    </button>
  );
}
