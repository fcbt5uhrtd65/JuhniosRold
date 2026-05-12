import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { FileText, Upload, Download, Search, AlertCircle, CheckCircle, Clock, X } from 'lucide-react';
import { SearchBar } from './SearchBar';
import { useToast } from '../../contexts/ToastContext';

interface LegalDocument {
  id: string;
  titulo: string;
  tipo: 'Contrato' | 'Licencia' | 'Política' | 'Acuerdo' | 'Certificado' | 'Otro';
  estado: 'Vigente' | 'Por vencer' | 'Vencido' | 'En revisión';
  fechaCreacion: string;
  fechaVencimiento?: string;
  responsable: string;
  descripcion: string;
}

export function AdminLegal() {
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTipo, setFilterTipo] = useState<string>('all');
  const [filterEstado, setFilterEstado] = useState<string>('all');
  const [showUploadModal, setShowUploadModal] = useState(false);

  const [documents, setDocuments] = useState<LegalDocument[]>([
    {
      id: '1',
      titulo: 'Contrato de Arrendamiento Local',
      tipo: 'Contrato',
      estado: 'Vigente',
      fechaCreacion: '2024-01-15',
      fechaVencimiento: '2026-01-15',
      responsable: 'María González',
      descripcion: 'Contrato de arrendamiento del local comercial principal'
    },
    {
      id: '2',
      titulo: 'Licencia Sanitaria INVIMA',
      tipo: 'Licencia',
      estado: 'Vigente',
      fechaCreacion: '2025-03-10',
      fechaVencimiento: '2026-03-10',
      responsable: 'Carlos Ramírez',
      descripcion: 'Licencia sanitaria para fabricación y comercialización de productos cosméticos'
    },
    {
      id: '3',
      titulo: 'Política de Tratamiento de Datos',
      tipo: 'Política',
      estado: 'Vigente',
      fechaCreacion: '2025-01-20',
      responsable: 'Ana Martínez',
      descripcion: 'Política de tratamiento de datos personales conforme a Ley 1581 de 2012'
    },
    {
      id: '4',
      titulo: 'Acuerdo de Confidencialidad Proveedor',
      tipo: 'Acuerdo',
      estado: 'En revisión',
      fechaCreacion: '2026-04-15',
      responsable: 'Juan López',
      descripcion: 'NDA con proveedor de materias primas'
    },
    {
      id: '5',
      titulo: 'Certificado ISO 9001',
      tipo: 'Certificado',
      estado: 'Por vencer',
      fechaCreacion: '2024-06-01',
      fechaVencimiento: '2026-06-01',
      responsable: 'Laura Sánchez',
      descripcion: 'Certificación de calidad ISO 9001:2015'
    }
  ]);

  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      const matchesSearch = searchQuery === '' ||
        doc.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.tipo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.responsable.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesTipo = filterTipo === 'all' || doc.tipo === filterTipo;
      const matchesEstado = filterEstado === 'all' || doc.estado === filterEstado;

      return matchesSearch && matchesTipo && matchesEstado;
    });
  }, [documents, searchQuery, filterTipo, filterEstado]);

  const stats = useMemo(() => {
    return {
      total: documents.length,
      vigentes: documents.filter(d => d.estado === 'Vigente').length,
      porVencer: documents.filter(d => d.estado === 'Por vencer').length,
      revision: documents.filter(d => d.estado === 'En revisión').length
    };
  }, [documents]);

  const getEstadoBadge = (estado: string) => {
    const styles = {
      'Vigente': 'bg-green-50 text-green-700 border-green-200',
      'Por vencer': 'bg-orange-50 text-orange-700 border-orange-200',
      'Vencido': 'bg-red-50 text-red-700 border-red-200',
      'En revisión': 'bg-blue-50 text-blue-700 border-blue-200'
    };
    return styles[estado as keyof typeof styles] || '';
  };

  const getEstadoIcon = (estado: string) => {
    switch (estado) {
      case 'Vigente':
        return <CheckCircle className="w-4 h-4" strokeWidth={1} />;
      case 'Por vencer':
        return <Clock className="w-4 h-4" strokeWidth={1} />;
      case 'Vencido':
        return <AlertCircle className="w-4 h-4" strokeWidth={1} />;
      case 'En revisión':
        return <FileText className="w-4 h-4" strokeWidth={1} />;
      default:
        return null;
    }
  };

  const handleUpload = () => {
    toast.success('Documento cargado exitosamente');
    setShowUploadModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl mb-2">Gestión Legal</h2>
          <p className="text-xs text-muted-foreground">
            Documentos, contratos y certificaciones
          </p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-foreground text-background hover:bg-background hover:text-foreground border border-foreground transition-colors text-xs"
        >
          <Upload className="w-4 h-4" strokeWidth={1} />
          Cargar Documento
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Documentos', value: stats.total, icon: FileText },
          { label: 'Vigentes', value: stats.vigentes, icon: CheckCircle },
          { label: 'Por Vencer', value: stats.porVencer, icon: Clock },
          { label: 'En Revisión', value: stats.revision, icon: AlertCircle }
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-secondary/30 border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-muted-foreground" strokeWidth={1} />
                <div className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground">
                  {stat.label}
                </div>
              </div>
              <div className="text-2xl font-light">
                {stat.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Buscar documentos..."
          className="flex-1"
        />

        <select
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value)}
          className="px-4 py-2 border border-border bg-transparent text-xs focus:outline-none focus:border-foreground"
        >
          <option value="all">Todos los tipos</option>
          <option value="Contrato">Contrato</option>
          <option value="Licencia">Licencia</option>
          <option value="Política">Política</option>
          <option value="Acuerdo">Acuerdo</option>
          <option value="Certificado">Certificado</option>
          <option value="Otro">Otro</option>
        </select>

        <select
          value={filterEstado}
          onChange={(e) => setFilterEstado(e.target.value)}
          className="px-4 py-2 border border-border bg-transparent text-xs focus:outline-none focus:border-foreground"
        >
          <option value="all">Todos los estados</option>
          <option value="Vigente">Vigente</option>
          <option value="Por vencer">Por vencer</option>
          <option value="Vencido">Vencido</option>
          <option value="En revisión">En revisión</option>
        </select>
      </div>

      {/* Documents Table */}
      <div className="border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left p-3 font-medium">Documento</th>
                <th className="text-left p-3 font-medium">Tipo</th>
                <th className="text-left p-3 font-medium">Estado</th>
                <th className="text-left p-3 font-medium">Responsable</th>
                <th className="text-left p-3 font-medium">Vencimiento</th>
                <th className="text-center p-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocuments.map((doc) => (
                <tr key={doc.id} className="border-b border-border hover:bg-secondary/20 transition-colors">
                  <td className="p-3">
                    <div className="font-medium mb-1">{doc.titulo}</div>
                    <div className="text-muted-foreground text-[10px]">
                      {doc.descripcion}
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="inline-block px-2 py-1 bg-secondary border border-border text-[10px]">
                      {doc.tipo}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className={`inline-flex items-center gap-1.5 px-2 py-1 border text-[10px] ${getEstadoBadge(doc.estado)}`}>
                      {getEstadoIcon(doc.estado)}
                      {doc.estado}
                    </div>
                  </td>
                  <td className="p-3">{doc.responsable}</td>
                  <td className="p-3">
                    {doc.fechaVencimiento
                      ? new Date(doc.fechaVencimiento).toLocaleDateString('es-CO')
                      : 'N/A'
                    }
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => toast.info('Descargando documento...')}
                        className="p-1.5 hover:bg-secondary/50 transition-colors"
                        title="Descargar"
                      >
                        <Download className="w-3.5 h-3.5" strokeWidth={1} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredDocuments.length === 0 && (
          <div className="p-12 text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" strokeWidth={1} />
            <div className="text-sm">No se encontraron documentos</div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background border border-border max-w-md w-full"
          >
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="text-xl">Cargar Documento</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-2 hover:bg-secondary transition-colors"
              >
                <X className="w-4 h-4" strokeWidth={1} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs mb-2">Título del documento</label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 border border-border bg-transparent focus:outline-none focus:border-foreground text-sm"
                  placeholder="Ej: Contrato de Servicios 2026"
                />
              </div>

              <div>
                <label className="block text-xs mb-2">Tipo</label>
                <select className="w-full px-4 py-2.5 border border-border bg-background focus:outline-none focus:border-foreground text-sm">
                  <option value="">Selecciona un tipo</option>
                  <option value="Contrato">Contrato</option>
                  <option value="Licencia">Licencia</option>
                  <option value="Política">Política</option>
                  <option value="Acuerdo">Acuerdo</option>
                  <option value="Certificado">Certificado</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-xs mb-2">Archivo</label>
                <input
                  type="file"
                  className="w-full px-4 py-2.5 border border-border bg-transparent focus:outline-none focus:border-foreground text-sm"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="flex-1 px-6 py-3 border border-border hover:border-foreground transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpload}
                  className="flex-1 px-6 py-3 bg-foreground text-background hover:bg-background hover:text-foreground border border-foreground transition-colors text-sm"
                >
                  Cargar
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
