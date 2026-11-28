import { useEffect, useMemo, useState } from 'react';
import { AdminProvider, useAdmin } from './contexts/AdminContext';
import { useUser } from './contexts/UserContext';
import { CartProvider } from './contexts/CartContext';
import { SearchProvider } from './contexts/SearchContext';
import { UserProvider } from './contexts/UserContext';
import { ToastProvider } from './contexts/ToastContext';
import { NotificationsProvider } from './contexts/NotificationsContext';
import { Admin } from './components/admin/Admin';
import { Hero } from './components/Hero';
import { ShippingInfo } from './components/ShippingInfo';
import { PowerProducts } from './components/PowerProducts';
import { ProductCatalog } from './components/ProductCatalog';
import { BeforeAfter } from './components/BeforeAfter';
import { ProductReviews } from './components/ProductReviews';
import { Ingredients } from './components/Ingredients';
import { OilsSection } from './components/OilsSection';
import { WholesaleBuyers } from './components/WholesaleBuyers';
import { Comunidad } from './components/Comunidad';
import { ModoPro } from './components/ModoPro';
import { ReferralProgram } from './components/ReferralProgram';
import { DiagnosticoCapilar } from './components/DiagnosticoCapilar';
import { VideoRodillo } from './components/VideoRodillo';
import { PromoBanner } from './components/PromoBanner';
import { LocationMap } from './components/LocationMap';
import { Footer } from './components/Footer';
import { WhatsAppButton } from './components/WhatsAppButton';
import { FirstPurchasePopup } from './components/FirstPurchasePopup';
import { LoginModal } from './components/LoginModal';
import { GoogleOnboardingModal } from './components/GoogleOnboardingModal';
import { ScrollToTop } from './components/ScrollToTop';
import { PaymentResult } from './components/PaymentResult';
import { CatalogPage } from './components/CatalogPage';
import { RawMaterialsPage } from './components/RawMaterialsPage';
import { ProfilePage } from './components/ProfilePage';
import { ChatbotLauncher } from './components/ChatbotLauncher';
import { CookieConsentBar } from './components/CookieConsentBar';


function PublicSite({ onLoginClick }: { onLoginClick: () => void }) {
  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => {
      document.documentElement.style.scrollBehavior = 'auto';
    };
  }, []);

  useEffect(() => {
    const scrollToHash = () => {
      const hash = window.location.hash;
      if (!hash) return;
      requestAnimationFrame(() => {
        document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
      });
    };
    scrollToHash();
    window.addEventListener('app:navigate', scrollToHash);
    return () => window.removeEventListener('app:navigate', scrollToHash);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <main>
        {/* Hero con Navbar integrado adentro */}
        <Hero onLoginClick={onLoginClick} />

        {/* Trust bar */}
        <ShippingInfo />

        <VideoRodillo />

        {/* Featured products — card grid */}
        <PowerProducts onLoginRequired={onLoginClick} />

        {/* Promo banner */}
        <PromoBanner />

        {/* Full product catalog — right after promo */}
        <ProductCatalog onLoginRequired={onLoginClick} />

        {/* Before/After transformations */}
        <BeforeAfter />

        {/* Verified customer reviews */}
        <ProductReviews />

        {/* Hair diagnosis quiz */}
        <DiagnosticoCapilar />

        {/* Ingredients · Laboratorio · Rituales — unified section */}
        <Ingredients />

        {/* Natural Oils Section */}
        <section id="aceites">
          <OilsSection />
        </section>

        {/* Wholesale / Raw Materials Section — id="mayorista" ya está en el propio componente */}
        <WholesaleBuyers />

        {/* Community / Instagram wall */}
        <Comunidad />

        {/* Modo Pro */}
        <ModoPro onLoginRequired={onLoginClick} />

        {/* Referral program */}
        <ReferralProgram />

        {/* Colombia coverage map */}
        <LocationMap />
      </main>

      <Footer />
      <WhatsAppButton />
      <ScrollToTop />
      <ChatbotLauncher />
      <FirstPurchasePopup />
      <CookieConsentBar />
    </div>
  );
}

function AppContent() {
  const { login, currentUser, isLoading } = useAdmin();
  const { currentUser: customerUser } = useUser();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  const onboardingInitialStep = useMemo((): 'identity' | 'location' | 'wholesale' => {
    if (!customerUser) return 'identity';
    const missingDoc = !customerUser.numeroDocumento || customerUser.tipoDocumento === 'PENDING';
    if (missingDoc) return 'identity';
    if (!customerUser.latitud) return 'location';
    return 'wholesale';
  }, [customerUser]);
  const isPaymentResult = currentPath === '/pago/resultado';
  const isCatalogPage = currentPath === '/catalogo';
  const isRawMaterialsPage = currentPath === '/materias-primas';
  const isProfilePage = currentPath === '/perfil';

  const syncPath = () => setCurrentPath(window.location.pathname);

  useEffect(() => {
    window.addEventListener('popstate', syncPath);
    return () => window.removeEventListener('popstate', syncPath);
  }, []);

  // Central navigate helper used by sub-pages via window events
  useEffect(() => {
    const handler = () => syncPath();
    window.addEventListener('app:navigate', handler);
    return () => window.removeEventListener('app:navigate', handler);
  }, []);

  const handleAdminAccess = async (email: string, password: string) => {
    const result = await login(email, password);
    const success = result === true;
    if (success) {
      setShowLoginModal(false);
    }
    return success;
  };

  if (isPaymentResult) {
    return (
      <PaymentResult
        onReturnToStore={() => {
          // Esta pantalla vive en la pestaña emergente que abrió Wompi. La pestaña
          // original ya se actualiza sola (BroadcastChannel en usePaymentStatusPolling),
          // así que cerramos este popup en vez de navegarlo; si el navegador no deja
          // cerrarlo (no fue abierto por script), caemos de vuelta al catálogo aquí mismo.
          window.close();
          window.history.replaceState({}, '', '/#catalogo');
          setCurrentPath('/');
        }}
      />
    );
  }

  if (isLoading && !currentUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-xs tracking-wider uppercase">
        Validando sesión...
      </div>
    );
  }

  if (currentUser && !isStorePreview()) {
    return <Admin />;
  }

  if (isCatalogPage) {
    return (
      <>
        <CatalogPage onLoginClick={() => setShowLoginModal(true)} />
        <CookieConsentBar />
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onAdminAccess={handleAdminAccess}
          onGoogleNewUser={() => setShowOnboarding(true)}
        />
        <GoogleOnboardingModal isOpen={showOnboarding} initialStep={onboardingInitialStep} onClose={() => setShowOnboarding(false)} />
        <ChatbotLauncher />
      </>
    );
  }

  if (isRawMaterialsPage) {
    return (
      <>
        <RawMaterialsPage onLoginClick={() => setShowLoginModal(true)} />
        <CookieConsentBar />
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onAdminAccess={handleAdminAccess}
          onGoogleNewUser={() => setShowOnboarding(true)}
        />
        <GoogleOnboardingModal isOpen={showOnboarding} initialStep={onboardingInitialStep} onClose={() => setShowOnboarding(false)} />
        <ChatbotLauncher />
      </>
    );
  }

  if (isProfilePage) {
    return (
      <>
        <ProfilePage onLoginClick={() => setShowLoginModal(true)} />
        <CookieConsentBar />
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onAdminAccess={handleAdminAccess}
          onGoogleNewUser={() => setShowOnboarding(true)}
        />
        <GoogleOnboardingModal isOpen={showOnboarding} initialStep={onboardingInitialStep} onClose={() => setShowOnboarding(false)} />
        <ChatbotLauncher />
      </>
    );
  }

  return (
    <>
      <PublicSite onLoginClick={() => setShowLoginModal(true)} />
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onAdminAccess={handleAdminAccess}
        onGoogleNewUser={() => setShowOnboarding(true)}
      />
      <GoogleOnboardingModal isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />
    </>
  );
}

/* ── "Ver tienda" desde el panel admin ──
   El panel abre la tienda en una pestaña nueva con ?vista=tienda. Esa pestaña
   (y solo esa: sessionStorage es por pestaña) muestra la tienda aunque haya una
   sesión de admin, para no tener que salir del panel. */
const STORE_PREVIEW_KEY = 'juhnios:store-preview';

function isStorePreview(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get('vista') === 'tienda') {
      sessionStorage.setItem(STORE_PREVIEW_KEY, '1');
      return true;
    }
    return sessionStorage.getItem(STORE_PREVIEW_KEY) === '1';
  } catch {
    return false;
  }
}

function StorePreviewBar() {
  const { currentUser } = useAdmin();
  if (!currentUser || !isStorePreview()) return null;
  return (
    <div className="fixed bottom-4 left-4 z-[200] flex items-center gap-3 rounded-full bg-[#1A1C16] px-4 py-2.5 text-white shadow-xl">
      <span className="text-[11px] font-semibold">Vista de tienda</span>
      <button
        type="button"
        onClick={() => {
          try { sessionStorage.removeItem(STORE_PREVIEW_KEY); } catch { /* sin almacenamiento */ }
          window.close();
          // Si el navegador no deja cerrar la pestaña, volvemos al panel aquí mismo.
          window.location.href = '/';
        }}
        className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold hover:bg-white/25"
      >
        Volver al panel
      </button>
    </div>
  );
}

function useCaptureReferralCode() {
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) sessionStorage.setItem('jr_referral_code', ref.trim().toUpperCase());
  }, []);
}

export default function App() {
  useCaptureReferralCode();
  return (
    <AdminProvider>
      <UserProvider>
        <ToastProvider>
          <NotificationsProvider>
            <CartProvider>
              <SearchProvider>
                <AppContent />
                <StorePreviewBar />
              </SearchProvider>
            </CartProvider>
          </NotificationsProvider>
        </ToastProvider>
      </UserProvider>
    </AdminProvider>
  );
}
