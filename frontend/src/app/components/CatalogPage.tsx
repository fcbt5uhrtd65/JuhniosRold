import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { WhatsAppButton } from './WhatsAppButton';

const FLIPBOOK_URL = '';

export function CatalogPage({ onLoginClick }: { onLoginClick: () => void }) {
  return (
    <div className="min-h-screen bg-[#F7F5F1] text-stone-950">
      <Navbar onLoginClick={onLoginClick} />
      <main className="px-4 pb-16 pt-28 md:px-8 lg:px-14">
        <section className="mx-auto max-w-6xl">
          <div className="mb-6">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#8B7355]">
              Productos Juhnios Rold SAS
            </p>
            <h1 className="max-w-4xl text-2xl font-semibold leading-tight text-stone-950 md:text-4xl">
              Catálogo de aceites, body splash, relajación corporal y tono sobre tono
            </h1>
          </div>

          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            {FLIPBOOK_URL ? (
              <iframe
                title="Catálogo Productos Juhnios Rold SAS"
                src={FLIPBOOK_URL}
                className="h-[72vh] w-full"
                allowFullScreen
              />
            ) : (
              <div className="flex min-h-[520px] flex-col items-center justify-center px-6 text-center">
                <div className="mb-4 rounded-2xl bg-[#2D3A1F]/10 px-4 py-2 text-xs font-semibold text-[#2D3A1F]">
                  Campo listo para pegar el link del flipbook
                </div>
                <p className="max-w-lg text-sm leading-6 text-stone-500">
                  Pega el enlace en la constante <span className="font-mono text-stone-700">FLIPBOOK_URL</span> de esta página para embeber el catálogo.
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
