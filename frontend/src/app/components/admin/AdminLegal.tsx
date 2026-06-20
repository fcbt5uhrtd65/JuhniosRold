import { useState, useMemo } from 'react';
import { FileText, Upload, Download, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { SearchBar } from './SearchBar';
import { useToast } from '../../contexts/ToastContext';
import { KpiCard, Table, Th, Td, Badge, type BadgeColor, Modal, EmptyState, inputCls, selectCls } from './AdminUI';

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

  const [documents] = useState<LegalDocument[]>([
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

  const getEstadoColor = (estado: string): BadgeColor => {
    const colors: Record<string, BadgeColor> = {
      'Vigente': 'green',
      'Por vencer': 'yellow',
      'Vencido': 'red',
      'En revisión': 'blue',
    };
    return colors[estado] ?? 'gray';
  };

  const getEstadoIcon = (estado: string) => {
    switch (estado) {
      case 'Vigente':
        return <CheckCircle size={12} />;
      case 'Por vencer':
        return <Clock size={12} />;
      case 'Vencido':
        return <AlertCircle size={12} />;
      case 'En revisión':
        return <FileText size={12} />;
      default:
        return null;
    }
  };

  const handleUpload = () => {
    toast.success('Documento cargado exitosamente');
    setShowUploadModal(false);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Gestión Legal</h2>
          <p className="text-xs text-gray-500 mt-0.5">Documentos, contratos y certificaciones</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#2a4038] text-white text-xs font-semibold rounded-xl hover:bg-[#3d5c4e] transition-colors"
        >
          <Upload size={14} />
          Cargar Documento
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total Documentos" value={String(stats.total)} icon={FileText} color="text-gray-600 bg-gray-100" />
        <KpiCard label="Vigentes" value={String(stats.vigentes)} icon={CheckCircle} color="text-emerald-600 bg-emerald-50" />
        <KpiCard label="Por Vencer" value={String(stats.porVencer)} icon={Clock} color="text-amber-600 bg-amber-50" />
        <KpiCard label="En Revisión" value={String(stats.revision)} icon={AlertCircle} color="text-blue-600 bg-blue-50" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Buscar documentos..."
          className="flex-1"
        />

        <select
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value)}
          className={selectCls + ' sm:w-48'}
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
          className={selectCls + ' sm:w-48'}
        >
          <option value="all">Todos los estados</option>
          <option value="Vigente">Vigente</option>
          <option value="Por vencer">Por vencer</option>
          <option value="Vencido">Vencido</option>
          <option value="En revisión">En revisión</option>
        </select>
      </div>

      {/* Documents Table */}
      <Table>
        <thead>
          <tr>
            <Th>Documento</Th>
            <Th>Tipo</Th>
            <Th>Estado</Th>
            <Th>Responsable</Th>
            <Th>Vencimiento</Th>
            <Th>Acciones</Th>
          </tr>
        </thead>
        <tbody>
          {filteredDocuments.map((doc) => (
            <tr key={doc.id} className="hover:bg-gray-50/50">
              <Td>
                <p className="font-medium text-gray-900 mb-0.5">{doc.titulo}</p>
                <p className="text-gray-400 text-[11px]">{doc.descripcion}</p>
              </Td>
              <Td><Badge label={doc.tipo} color="gray" /></Td>
              <Td>
                <Badge label={<span className="flex items-center gap-1">{getEstadoIcon(doc.estado)}{doc.estado}</span>} color={getEstadoColor(doc.estado)} />
              </Td>
              <Td>{doc.responsable}</Td>
              <Td>{doc.fechaVencimiento ? new Date(doc.fechaVencimiento).toLocaleDateString('es-CO') : 'N/A'}</Td>
              <Td>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => toast.info('Descargando documento...')}
                    className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Descargar"
                  >
                    <Download size={14} />
                  </button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      {filteredDocuments.length === 0 && (
        <EmptyState title="No se encontraron documentos" />
      )}

      {/* Upload Modal */}
      <Modal title="Cargar Documento" open={showUploadModal} onClose={() => setShowUploadModal(false)}>
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Título del documento</label>
            <input
              type="text"
              className={inputCls}
              placeholder="Ej: Contrato de Servicios 2026"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Tipo</label>
            <select className={selectCls}>
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
            <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Archivo</label>
            <input
              type="file"
              className={inputCls}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setShowUploadModal(false)}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleUpload}
              className="flex-1 py-2.5 bg-[#2a4038] text-white rounded-xl text-sm font-semibold hover:bg-[#3d5c4e] transition-colors"
            >
              Cargar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
