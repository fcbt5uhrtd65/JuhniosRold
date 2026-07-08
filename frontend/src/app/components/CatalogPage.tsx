import { useState } from 'react';
import { ArrowLeft, BookOpen, ExternalLink, Eye, Layers3 } from 'lucide-react';
import { NavigationBar } from './NavigationBar';
import { Footer } from './Footer';
import { WhatsAppButton } from './WhatsAppButton';
import { navigateBack } from '../services/navigate';

const CATALOGS = [
  {
    id: 'comercial',
    title: 'Catálogo comercial',
    label: 'Productos Juhnios Rold',
    description: 'Portafolio general para revisar referencias, presentaciones y novedades de la marca.',
    url: 'https://heyzine.com/flip-book/5bc27eccc9.html#page/10',
    accent: '#2D3A1F',
  },
  {
    id: 'profesional',
    title: 'Catálogo profesional',
    label: 'Línea para negocios',
    description: 'Una vista pensada para compradores, aliados y clientes que buscan ampliar su inventario.',
    url: 'https://heyzine.com/flip-book/8e41ab4a8b.html',
    accent: '#8B7355',
  },
  {
    id: 'complementario',
    title: 'Catálogo complementario',
    label: 'Selección destacada',
    description: 'Referencias adicionales para explorar opciones por categoría y completar tu pedido.',
    url: 'https://heyzine.com/flip-book/d249fca6ef.html',
    accent: '#7C2D12',
  },
];

export function CatalogPage({ onLoginClick }: { onLoginClick: () => void }) {
  const [selectedCatalogId, setSelectedCatalogId] = useState(CATALOGS[0].id);
  const selectedCatalog = CATALOGS.find(catalog => catalog.id === selectedCatalogId) ?? CATALOGS[0];

  return (
    <div className="min-h-screen bg-[#F7F5F1] text-stone-950">
      <NavigationBar variant="solid" onLoginClick={onLoginClick} />
      <main className="px-4 pb-16 pt-28 md:px-8 lg:px-14">
        <section className="mx-auto max-w-6xl">

          {/* Breadcrumb / back */}
          <button
            onClick={() => navigateBack('/')}
            className="mb-6 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-stone-400 transition-colors hover:text-stone-900"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver al inicio
          </button>

          <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#8B7355]">
                Productos Juhnios Rold SAS
              </p>
              <h1 className="max-w-2xl text-2xl font-semibold leading-tight text-stone-950 md:text-4xl">
                Catálogos de productos
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
                Explora nuestros flipbooks por colección y abre el que necesites en pantalla completa.
              </p>
            </div>
            <a
              href={selectedCatalog.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md border border-stone-200 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 shadow-sm transition-colors hover:bg-stone-50"
            >
              <BookOpen className="w-3.5 h-3.5" strokeWidth={1.6} />
              Abrir catálogo seleccionado
            </a>
          </div>

          <div className="mb-7 grid gap-3 md:grid-cols-3">
            {CATALOGS.map((catalog, index) => {
              const isSelected = catalog.id === selectedCatalog.id;
              return (
                <button
                  key={catalog.id}
                  type="button"
                  onClick={() => setSelectedCatalogId(catalog.id)}
                  className={`group flex h-full min-h-[176px] flex-col justify-between rounded-lg border bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                    isSelected ? 'border-stone-900 ring-2 ring-stone-900/10' : 'border-stone-200'
                  }`}
                >
                  <span
                    className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-md text-white shadow-sm"
                    style={{ backgroundColor: catalog.accent }}
                  >
                    <Layers3 className="h-4 w-4" strokeWidth={1.7} />
                  </span>
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-400">
                    Catálogo {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="mt-1 block text-lg font-semibold leading-tight text-stone-950">
                    {catalog.title}
                  </span>
                  <span className="mt-1 block text-xs font-medium text-[#8B7355]">
                    {catalog.label}
                  </span>
                  <span className="mt-3 block text-sm leading-6 text-stone-600">
                    {catalog.description}
                  </span>
                  <span className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-stone-900">
                    <Eye className="h-3.5 w-3.5" strokeWidth={1.8} />
                    {isSelected ? 'Visualizando ahora' : 'Visualizar'}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3 md:px-5">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-400">
                  Vista previa
                </p>
                <h2 className="mt-1 truncate text-sm font-semibold text-stone-950 md:text-base">
                  {selectedCatalog.title}
                </h2>
              </div>
              <a
                href={selectedCatalog.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-stone-950 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-stone-800"
              >
                <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} />
                Pantalla completa
              </a>
            </div>
            <iframe
              key={selectedCatalog.id}
              title={`${selectedCatalog.title} Juhnios Rold SAS`}
              src={selectedCatalog.url}
              className="h-[78vh] w-full min-h-[480px]"
              allowFullScreen
            />
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
