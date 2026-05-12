import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, FileText, Download, Calculator, AlertCircle, CheckCircle, X } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

interface Employee {
  id: string;
  nombre: string;
  cedula: string;
  cargo: string;
  salarioBase: number;
  horasExtras: number;
  bonificaciones: number;
  deducciones: number;
  salarioNeto: number;
}

interface PayrollSummary {
  totalEmpleados: number;
  totalSalarioBase: number;
  totalBonificaciones: number;
  totalDeducciones: number;
  totalNeto: number;
}

export function AdminPayroll() {
  const toast = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);

  const parsePayrollFile = (content: string): Employee[] => {
    const lines = content.trim().split('\n');
    const parsedEmployees: Employee[] = [];

    lines.forEach((line, index) => {
      if (index === 0 || line.trim() === '') return;

      const parts = line.split('|').map(p => p.trim());
      if (parts.length < 7) return;

      const salarioBase = parseFloat(parts[3]) || 0;
      const horasExtras = parseFloat(parts[4]) || 0;
      const bonificaciones = parseFloat(parts[5]) || 0;
      const deducciones = parseFloat(parts[6]) || 0;
      const salarioNeto = salarioBase + horasExtras + bonificaciones - deducciones;

      parsedEmployees.push({
        id: `emp-${index}`,
        nombre: parts[0],
        cedula: parts[1],
        cargo: parts[2],
        salarioBase,
        horasExtras,
        bonificaciones,
        deducciones,
        salarioNeto
      });
    });

    return parsedEmployees;
  };

  const calculateSummary = (emps: Employee[]): PayrollSummary => {
    return {
      totalEmpleados: emps.length,
      totalSalarioBase: emps.reduce((sum, e) => sum + e.salarioBase, 0),
      totalBonificaciones: emps.reduce((sum, e) => sum + e.bonificaciones + e.horasExtras, 0),
      totalDeducciones: emps.reduce((sum, e) => sum + e.deducciones, 0),
      totalNeto: emps.reduce((sum, e) => sum + e.salarioNeto, 0)
    };
  };

  const handleFileUpload = async (file: File) => {
    setProcessing(true);

    try {
      const content = await file.text();
      const parsedEmployees = parsePayrollFile(content);

      if (parsedEmployees.length === 0) {
        toast.error('El archivo no contiene datos válidos');
        setProcessing(false);
        return;
      }

      setEmployees(parsedEmployees);
      setSummary(calculateSummary(parsedEmployees));
      toast.success(`Nómina procesada: ${parsedEmployees.length} empleados`);
    } catch (error) {
      toast.error('Error al procesar el archivo');
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.dat') || file.name.endsWith('.txt'))) {
      handleFileUpload(file);
    } else {
      toast.warning('Por favor sube un archivo .dat o .txt');
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const exportToCSV = () => {
    if (employees.length === 0) {
      toast.warning('No hay datos para exportar');
      return;
    }

    const headers = ['Nombre', 'Cédula', 'Cargo', 'Salario Base', 'Horas Extras', 'Bonificaciones', 'Deducciones', 'Salario Neto'];
    const csvContent = [
      headers.join(','),
      ...employees.map(e => [
        e.nombre,
        e.cedula,
        e.cargo,
        e.salarioBase.toFixed(2),
        e.horasExtras.toFixed(2),
        e.bonificaciones.toFixed(2),
        e.deducciones.toFixed(2),
        e.salarioNeto.toFixed(2)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nomina-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();

    toast.success('Nómina exportada exitosamente');
  };

  const clearData = () => {
    setEmployees([]);
    setSummary(null);
    toast.info('Datos de nómina limpiados');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl mb-2">Nómina</h2>
          <p className="text-xs text-muted-foreground">
            Sube archivos .dat para calcular automáticamente la nómina
          </p>
        </div>
        {employees.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 border border-border hover:border-foreground text-xs transition-colors"
            >
              <Download className="w-4 h-4" strokeWidth={1} />
              Exportar CSV
            </button>
            <button
              onClick={clearData}
              className="flex items-center gap-2 px-4 py-2 border border-border hover:border-red-500 hover:text-red-500 text-xs transition-colors"
            >
              <X className="w-4 h-4" strokeWidth={1} />
              Limpiar
            </button>
          </div>
        )}
      </div>

      {/* Upload Area */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed p-12 text-center transition-all
          ${isDragging ? 'border-foreground bg-secondary/30' : 'border-border'}
          ${processing ? 'opacity-50 pointer-events-none' : 'hover:border-foreground'}
        `}
      >
        <input
          type="file"
          id="payroll-file"
          accept=".dat,.txt"
          onChange={handleFileInput}
          className="hidden"
          disabled={processing}
        />

        <label htmlFor="payroll-file" className="cursor-pointer block">
          <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" strokeWidth={1} />
          <div className="text-sm mb-2">
            {processing ? 'Procesando archivo...' : 'Arrastra tu archivo .dat aquí'}
          </div>
          <div className="text-xs text-muted-foreground mb-4">
            o haz clic para seleccionar
          </div>
          <div className="inline-block px-4 py-2 bg-foreground text-background text-xs">
            SELECCIONAR ARCHIVO
          </div>
        </label>

        {/* Format Help */}
        <div className="mt-8 p-4 bg-secondary/30 border border-border text-left max-w-xl mx-auto">
          <div className="flex items-start gap-2 mb-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={1} />
            <div className="text-xs">
              <div className="font-medium mb-1">Formato esperado del archivo:</div>
              <code className="text-[10px] block bg-background p-2 border border-border">
                Nombre | Cédula | Cargo | Salario Base | Horas Extras | Bonificaciones | Deducciones
              </code>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <AnimatePresence>
        {summary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-2 md:grid-cols-5 gap-4"
          >
            {[
              { label: 'Empleados', value: summary.totalEmpleados.toString(), icon: FileText },
              { label: 'Salario Base', value: formatCurrency(summary.totalSalarioBase), icon: Calculator },
              { label: 'Bonificaciones', value: formatCurrency(summary.totalBonificaciones), icon: CheckCircle },
              { label: 'Deducciones', value: formatCurrency(summary.totalDeducciones), icon: AlertCircle },
              { label: 'Total Neto', value: formatCurrency(summary.totalNeto), icon: CheckCircle }
            ].map((stat, index) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-secondary/30 border border-border p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4 text-muted-foreground" strokeWidth={1} />
                    <div className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground">
                      {stat.label}
                    </div>
                  </div>
                  <div className="text-lg font-medium">
                    {stat.value}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Employees Table */}
      <AnimatePresence>
        {employees.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="border border-border overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left p-3 font-medium">Nombre</th>
                    <th className="text-left p-3 font-medium">Cédula</th>
                    <th className="text-left p-3 font-medium">Cargo</th>
                    <th className="text-right p-3 font-medium">Salario Base</th>
                    <th className="text-right p-3 font-medium">H. Extras</th>
                    <th className="text-right p-3 font-medium">Bonificaciones</th>
                    <th className="text-right p-3 font-medium">Deducciones</th>
                    <th className="text-right p-3 font-medium">Salario Neto</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp, index) => (
                    <motion.tr
                      key={emp.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.02 }}
                      className="border-b border-border hover:bg-secondary/20 transition-colors"
                    >
                      <td className="p-3">{emp.nombre}</td>
                      <td className="p-3 text-muted-foreground">{emp.cedula}</td>
                      <td className="p-3">{emp.cargo}</td>
                      <td className="p-3 text-right">{formatCurrency(emp.salarioBase)}</td>
                      <td className="p-3 text-right">{formatCurrency(emp.horasExtras)}</td>
                      <td className="p-3 text-right text-green-600">{formatCurrency(emp.bonificaciones)}</td>
                      <td className="p-3 text-right text-red-600">{formatCurrency(emp.deducciones)}</td>
                      <td className="p-3 text-right font-medium">{formatCurrency(emp.salarioNeto)}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
