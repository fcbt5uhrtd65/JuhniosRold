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
import { Ingredients } from './components/Ingredients';
import { OilsSection } from './components/OilsSection';
import { WholesaleBuyers } from './components/WholesaleBuyers';
import { Comunidad } from './components/Comunidad';
import { ModoPro } from './components/ModoPro';
import { ReferralProgram } from './components/ReferralProgram';
import { DiagnosticoCapilar } from './components/DiagnosticoCapilar';
import { PromoBanner } from './components/PromoBanner';
import { LocationMap } from './components/LocationMap';
import { Footer } from './components/Footer';
import { WhatsAppButton } from './components/WhatsAppButton';
import { FirstPurchasePopup } from './components/FirstPurchasePopup';
import { LoginModal } from './components/LoginModal';
import { GoogleOnboardingModal } from './components/GoogleOnboardingModal';
import { ApiStatus } from './components/ApiStatus';
import { ScrollToTop } from './components/ScrollToTop';
import { PaymentResult } from './components/PaymentResult';
import { CatalogPage } from './components/CatalogPage';
import { ProfilePage } from './components/ProfilePage';
import { ChatbotLauncher } from './components/ChatbotLauncher';


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

        {/* Featured products — card grid */}
        <PowerProducts />

        {/* Promo banner */}
        <PromoBanner />

        {/* Full product catalog — right after promo */}
        <ProductCatalog onLoginRequired={onLoginClick} />

        {/* Before/After transformations */}
        <BeforeAfter />

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
        <ModoPro />

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
      <ApiStatus />
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
    const success = await login(email, password);
    if (success) {
      setShowLoginModal(false);
    }
    return success;
  };

  if (isPaymentResult) {
    return (
      <PaymentResult
        onReturnToStore={() => {
          window.history.replaceState({}, '', '/#catalogo');
          setCurrentPath('/');
        }}
      />
    );
  }

  if (isCatalogPage) {
    return (
      <>
        <CatalogPage onLoginClick={() => setShowLoginModal(true)} />
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

  if (isLoading && !currentUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-xs tracking-wider uppercase">
        Validando sesión...
      </div>
    );
  }

  if (currentUser) {
    return <Admin />;
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
              </SearchProvider>
            </CartProvider>
          </NotificationsProvider>
        </ToastProvider>
      </UserProvider>
    </AdminProvider>
  );
}
