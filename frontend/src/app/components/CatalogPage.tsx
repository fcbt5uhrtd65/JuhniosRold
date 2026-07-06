import { ArrowLeft, BookOpen } from 'lucide-react';
import { NavigationBar } from './NavigationBar';
import { Footer } from './Footer';
import { WhatsAppButton } from './WhatsAppButton';
import { navigateBack } from '../services/navigate';

const FLIPBOOK_URL = 'https://heyzine.com/flip-book/a6b0e5b2d6.html';

export function CatalogPage({ onLoginClick }: { onLoginClick: () => void }) {
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

          <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#8B7355]">
                Productos Juhnios Rold SAS
              </p>
              <h1 className="max-w-2xl text-2xl font-semibold leading-tight text-stone-950 md:text-3xl">
                Catálogo de productos
              </h1>
            </div>
            <a
              href={FLIPBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 shadow-sm transition-colors hover:bg-stone-50"
            >
              <BookOpen className="w-3.5 h-3.5" strokeWidth={1.6} />
              Abrir en pantalla completa
            </a>
          </div>

          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            {FLIPBOOK_URL ? (
              <iframe
                title="Catálogo Productos Juhnios Rold SAS"
                src={FLIPBOOK_URL}
                className="h-[78vh] w-full min-h-[480px]"
                allowFullScreen
              />
            ) : (
              <div className="flex min-h-[520px] flex-col items-center justify-center px-6 text-center">
                <div className="mb-4 rounded-2xl bg-[#2D3A1F]/10 px-4 py-2 text-xs font-semibold text-[#2D3A1F]">
                  Campo listo para pegar el link del flipbook
                </div>
                <p className="max-w-lg text-sm leading-6 text-stone-500">
                  Pega el enlace en la constante <span className="font-mono text-stone-700">FLIPBOOK_URL</span> de esta página.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
