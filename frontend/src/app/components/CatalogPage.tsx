import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, BookOpen, ExternalLink, Eye, Layers3, Loader2 } from 'lucide-react';
import { NavigationBar } from './NavigationBar';
import { Footer } from './Footer';
import { WhatsAppButton } from './WhatsAppButton';
import { navigateBack } from '../services/navigate';
import { getFlipbookCatalogs, type FlipbookCatalog } from '../services/products.service';

export function CatalogPage({ onLoginClick }: { onLoginClick: () => void }) {
  const [catalogs, setCatalogs] = useState<FlipbookCatalog[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedCatalog = useMemo(
    () => catalogs.find(catalog => catalog.id === selectedCatalogId) ?? catalogs[0] ?? null,
    [catalogs, selectedCatalogId],
  );

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setErrorMessage(null);

    getFlipbookCatalogs(controller.signal)
      .then((items) => {
        setCatalogs(items);
        setSelectedCatalogId(currentId => {
          if (currentId && items.some(item => item.id === currentId)) {
            return currentId;
          }
          return items[0]?.id ?? null;
        });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setErrorMessage(error instanceof Error ? error.message : 'No se pudieron cargar los catálogos.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

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
            {selectedCatalog && (
              <a
                href={selectedCatalog.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-md border border-stone-200 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 shadow-sm transition-colors hover:bg-stone-50"
              >
                <BookOpen className="w-3.5 h-3.5" strokeWidth={1.6} />
                Abrir catálogo seleccionado
              </a>
            )}
          </div>

          {isLoading ? (
            <div className="mb-7 grid gap-3 md:grid-cols-3">
              {[0, 1, 2].map(item => (
                <div key={item} className="min-h-[176px] rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
                  <div className="mb-5 h-10 w-10 animate-pulse rounded-md bg-stone-200" />
                  <div className="mb-3 h-3 w-24 animate-pulse rounded bg-stone-200" />
                  <div className="mb-3 h-5 w-40 animate-pulse rounded bg-stone-200" />
                  <div className="h-3 w-full animate-pulse rounded bg-stone-200" />
                  <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-stone-200" />
                </div>
              ))}
            </div>
          ) : errorMessage ? (
            <div className="mb-7 flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
              <div>
                <p className="font-semibold">No pudimos cargar los catálogos.</p>
                <p className="mt-1 text-red-800">{errorMessage}</p>
              </div>
            </div>
          ) : catalogs.length === 0 ? (
            <div className="mb-7 rounded-lg border border-stone-200 bg-white px-5 py-8 text-center shadow-sm">
              <Layers3 className="mx-auto mb-3 h-8 w-8 text-stone-300" strokeWidth={1.6} />
              <p className="text-sm font-semibold text-stone-900">Aún no hay catálogos publicados.</p>
              <p className="mt-1 text-sm text-stone-500">Cuando se active un registro en el backend aparecerá aquí automáticamente.</p>
            </div>
          ) : (
            <div className="mb-7 grid gap-3 md:grid-cols-3">
              {catalogs.map((catalog, index) => {
                const isSelected = catalog.id === selectedCatalog?.id;
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
                    style={{ backgroundColor: catalog.accent_color }}
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
          )}

          {selectedCatalog ? (
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
          ) : isLoading ? (
            <div className="flex min-h-[480px] items-center justify-center rounded-lg border border-stone-200 bg-white shadow-sm">
              <Loader2 className="h-6 w-6 animate-spin text-stone-400" strokeWidth={1.8} />
            </div>
          ) : null}
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
