import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, BookOpen, ExternalLink, Loader2 } from 'lucide-react';
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
    () => catalogs.find((catalog) => catalog.id === selectedCatalogId) ?? catalogs[0] ?? null,
    [catalogs, selectedCatalogId],
  );

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setErrorMessage(null);

    getFlipbookCatalogs(controller.signal)
      .then((items) => {
        setCatalogs(items);
        setSelectedCatalogId((currentId) => {
          if (currentId && items.some((item) => item.id === currentId)) {
            return currentId;
          }
          return items[0]?.id ?? null;
        });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setErrorMessage(error instanceof Error ? error.message : 'No se pudieron cargar los catalogos.');
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
      <main className="px-4 pb-12 pt-24 md:px-8 lg:px-14">
        <section className="mx-auto max-w-7xl">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => navigateBack('/')}
                className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500 transition-colors hover:text-stone-950"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Inicio
              </button>
              <div>
                <h1 className="text-2xl font-semibold leading-tight text-stone-950 md:text-3xl">
                  Catalogos
                </h1>
                <p className="mt-1 text-sm text-stone-600">
                  Elige uno y consultalo aqui.
                </p>
              </div>
            </div>

            {catalogs.length > 0 && (
              <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                <label className="sr-only" htmlFor="catalog-select">Catalogo</label>
                <select
                  id="catalog-select"
                  value={selectedCatalog?.id ?? ''}
                  onChange={(event) => setSelectedCatalogId(event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm font-medium text-stone-900 shadow-sm outline-none transition-colors focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 sm:min-w-[280px]"
                >
                  {catalogs.map((catalog) => (
                    <option key={catalog.id} value={catalog.id}>
                      {catalog.title}
                    </option>
                  ))}
                </select>
                {selectedCatalog && (
                  <a
                    href={selectedCatalog.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-stone-950 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-stone-800"
                  >
                    <ExternalLink className="h-4 w-4" strokeWidth={1.8} />
                    Abrir
                  </a>
                )}
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="flex min-h-[560px] items-center justify-center rounded-xl border border-stone-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-stone-500">
                <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.8} />
                Cargando catalogos...
              </div>
            </div>
          ) : errorMessage ? (
            <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
              <div>
                <p className="font-semibold">No pudimos cargar los catalogos.</p>
                <p className="mt-1 text-red-800">{errorMessage}</p>
              </div>
            </div>
          ) : catalogs.length === 0 ? (
            <div className="rounded-xl border border-stone-200 bg-white px-5 py-10 text-center shadow-sm">
              <BookOpen className="mx-auto mb-3 h-8 w-8 text-stone-300" strokeWidth={1.6} />
              <p className="text-sm font-semibold text-stone-900">No hay catalogos publicados.</p>
            </div>
          ) : selectedCatalog ? (
            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-4 py-3 md:px-5">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-stone-950 md:text-base">
                    {selectedCatalog.title}
                  </h2>
                  {selectedCatalog.label && (
                    <p className="mt-0.5 truncate text-xs text-stone-500">{selectedCatalog.label}</p>
                  )}
                </div>
                <a
                  href={selectedCatalog.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-stone-200 px-3.5 py-2 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-50"
                >
                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} />
                  Pantalla completa
                </a>
              </div>
              <iframe
                key={selectedCatalog.id}
                title={`${selectedCatalog.title} Juhnios Rold SAS`}
                src={selectedCatalog.url}
                className="h-[76vh] min-h-[520px] w-full"
                allowFullScreen
              />
            </div>
          ) : null}
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
