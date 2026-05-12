import { useEffect, useState } from 'react';
import { AdminProvider, useAdmin } from './contexts/AdminContext';
import { CartProvider } from './contexts/CartContext';
import { SearchProvider } from './contexts/SearchContext';
import { UserProvider } from './contexts/UserContext';
import { ToastProvider } from './contexts/ToastContext';
import { Admin } from './components/admin/Admin';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { ShippingInfo } from './components/ShippingInfo';
import { PowerProducts } from './components/PowerProducts';
import { ProductCatalog } from './components/ProductCatalog';
import { BeforeAfter } from './components/BeforeAfter';
import { Ingredients } from './components/Ingredients';
import { OilsSection } from './components/OilsSection';
import { BabyProducts } from './components/BabyProducts';
import { WholesaleBuyers } from './components/WholesaleBuyers';
import { Comunidad } from './components/Comunidad';
import { ModoPro } from './components/ModoPro';
import { FAQ } from './components/FAQ';
import { ReferralProgram } from './components/ReferralProgram';
import { DiagnosticoCapilar } from './components/DiagnosticoCapilar';
import { LocationMap } from './components/LocationMap';
import { Footer } from './components/Footer';
import { WhatsAppButton } from './components/WhatsAppButton';
import { FirstPurchasePopup } from './components/FirstPurchasePopup';
import { LoginModal } from './components/LoginModal';
import { ApiStatus } from './components/ApiStatus';
import { ScrollToTop } from './components/ScrollToTop';


function PublicSite({ onLoginClick }: { onLoginClick: () => void }) {
  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => {
      document.documentElement.style.scrollBehavior = 'auto';
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <Navbar onLoginClick={onLoginClick} />
      <main>
        {/* Hero */}
        <Hero />

        {/* Trust bar */}
        <ShippingInfo />

        {/* Featured products — editorial layout */}
        <PowerProducts />

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

        {/* Baby Products Section */}
        <section id="bebe">
          <BabyProducts />
        </section>

        {/* Wholesale / Raw Materials Section */}
        <section id="mayorista">
          <WholesaleBuyers />
        </section>

        {/* Full product catalog */}
        <ProductCatalog />

        {/* Community / Instagram wall */}
        <Comunidad />

        {/* Modo Pro */}
        <ModoPro />

        {/* FAQ */}
        <FAQ />

        {/* Referral program */}
        <ReferralProgram />

        {/* Colombia coverage map */}
        <LocationMap />
      </main>

      <Footer />
      <WhatsAppButton />
      <ScrollToTop />
      <FirstPurchasePopup />
      <ApiStatus />
    </div>
  );
}

function AppContent() {
  const { login, currentUser } = useAdmin();
  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleAdminAccess = async (email: string, password: string) => {
    const success = await login(email, password);
    if (success) {
      setShowLoginModal(false);
    }
  };

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
      />
    </>
  );
}

export default function App() {
  return (
    <AdminProvider>
      <UserProvider>
        <ToastProvider>
          <CartProvider>
            <SearchProvider>
              <AppContent />
            </SearchProvider>
          </CartProvider>
        </ToastProvider>
      </UserProvider>
    </AdminProvider>
  );
}
