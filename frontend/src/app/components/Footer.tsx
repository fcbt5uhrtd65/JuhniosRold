import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, MapPin, Phone, Instagram, Facebook, Send, ShieldCheck, CreditCard, Truck, Lock, X, Music2 } from 'lucide-react';

type LegalModal = 'terms' | 'privacy' | 'cookies' | 'faq' | 'shipping' | 'returns' | 'warranty' | null;

export function Footer() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState('');
  const [activeModal, setActiveModal] = useState<LegalModal>(null);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Email requerido');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Email inválido');
      return;
    }

    // Simulate subscription
    setSubscribed(true);
    setEmail('');

    // Reset after 3 seconds
    setTimeout(() => setSubscribed(false), 3000);
  };

  return (
    <footer className="bg-background border-t border-border">
      <div className="max-w-[1400px] mx-auto px-5 sm:px-8 md:px-12 py-14 md:py-16">
        {/* Main Content */}
        <div className="grid sm:grid-cols-2 md:grid-cols-12 gap-8 md:gap-12 mb-12">
          <div className="md:col-span-4">
            <div className="text-xs tracking-[0.2em] uppercase mb-6">
              JUHNIOS ROLD
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mb-6">
              Productos capilares premium para mujeres colombianas que no piden permiso para brillar.
            </p>

            {/* Contact Info */}
            <div className="space-y-3">
              <a
                href="mailto:hola@juhniosrold.com"
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors group"
              >
                <Mail className="w-4 h-4 group-hover:scale-110 transition-transform" strokeWidth={1} />
                hola@juhniosrold.com
              </a>
              <a
                href="tel:+573001234567"
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors group"
              >
                <Phone className="w-4 h-4 group-hover:scale-110 transition-transform" strokeWidth={1} />
                +57 300 123 4567
              </a>
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={1} />
                <span>Bogotá, Colombia</span>
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="text-[10px] tracking-[0.2em] uppercase mb-4 text-muted-foreground">
              Productos
            </div>
            <ul className="space-y-2 text-xs">
              <li><a href="#" className="hover:opacity-50 transition-opacity">Capilar</a></li>
              <li><a href="#" className="hover:opacity-50 transition-opacity">Corporal</a></li>
              <li><a href="#" className="hover:opacity-50 transition-opacity">Baby</a></li>
              <li><a href="#" className="hover:opacity-50 transition-opacity">Personal</a></li>
            </ul>
          </div>

          <div className="md:col-span-2">
            <div className="text-[10px] tracking-[0.2em] uppercase mb-4 text-muted-foreground">
              Ayuda
            </div>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => setActiveModal('faq')}
                  className="hover:opacity-50 transition-opacity text-left"
                >
                  Preguntas frecuentes
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveModal('shipping')}
                  className="hover:opacity-50 transition-opacity text-left"
                >
                  Política de envíos
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveModal('returns')}
                  className="hover:opacity-50 transition-opacity text-left"
                >
                  Devoluciones
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveModal('warranty')}
                  className="hover:opacity-50 transition-opacity text-left"
                >
                  Garantía
                </button>
              </li>
            </ul>
          </div>

          <div className="md:col-span-2">
            <div className="text-[10px] tracking-[0.2em] uppercase mb-4 text-muted-foreground">
              Legal
            </div>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => setActiveModal('terms')}
                  className="hover:opacity-50 transition-opacity text-left"
                >
                  Términos y condiciones
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveModal('privacy')}
                  className="hover:opacity-50 transition-opacity text-left"
                >
                  Política de privacidad
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveModal('cookies')}
                  className="hover:opacity-50 transition-opacity text-left"
                >
                  Cookies
                </button>
              </li>
            </ul>
          </div>

          <div className="md:col-span-4">
            <div className="text-[10px] tracking-[0.2em] uppercase mb-4 text-muted-foreground">
              Newsletter
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Recibe novedades y ofertas exclusivas
            </p>
            <form onSubmit={handleSubscribe} className="space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={subscribed}
                  className="flex-1 px-3 py-2 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground transition-colors disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={subscribed}
                  className="px-4 py-2 bg-foreground text-background text-[10px] tracking-wider uppercase hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap"
                >
                  {subscribed ? '✓ Suscrito' : 'Suscribir'}
                </button>
              </div>
              {error && <div className="text-xs text-red-500">{error}</div>}
              {subscribed && <div className="text-xs text-green-600">¡Gracias por suscribirte!</div>}
            </form>
          </div>
        </div>

        {/* Trust Badges */}
        

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4 md:gap-6">
          <div className="text-[10px] text-muted-foreground">
            © 2026 Juhnios Rold. Todos los derechos reservados.
          </div>

          {/* Social Media */}
          <div className="flex items-center gap-4">
            <div className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground">
              Síguenos
            </div>
            <div className="flex gap-3">
              <motion.a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.1, y: -2 }}
                className="p-2 border border-border hover:border-foreground hover:bg-foreground hover:text-background transition-all"
                aria-label="Instagram"
              >
                <Instagram className="w-4 h-4" strokeWidth={1.5} />
              </motion.a>
              <motion.a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.1, y: -2 }}
                className="p-2 border border-border hover:border-foreground hover:bg-foreground hover:text-background transition-all"
                aria-label="Facebook"
              >
                <Facebook className="w-4 h-4" strokeWidth={1.5} />
              </motion.a>
              <motion.a
                href="https://tiktok.com"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.1, y: -2 }}
                className="p-2 border border-border hover:border-foreground hover:bg-foreground hover:text-background transition-all"
                aria-label="TikTok"
              >
                <Music2 className="w-4 h-4" strokeWidth={1.5} />
              </motion.a>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="flex items-center gap-2 text-[9px] text-muted-foreground flex-wrap justify-center md:justify-end">
            <span className="tracking-wider uppercase">Aceptamos:</span>
            <div className="flex gap-1.5">
              <div className="px-2 py-1 border border-border text-[8px]">PSE</div>
              <div className="px-2 py-1 border border-border text-[8px]">NEQUI</div>
              <div className="px-2 py-1 border border-border text-[8px]">VISA</div>
              <div className="px-2 py-1 border border-border text-[8px]">MC</div>
            </div>
          </div>
        </div>
      </div>

      {/* Legal Modals */}
      <AnimatePresence>
        {activeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => setActiveModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-background max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h2 className="text-xl font-bold">
                  {activeModal === 'terms' && 'Términos y Condiciones'}
                  {activeModal === 'privacy' && 'Política de Privacidad'}
                  {activeModal === 'cookies' && 'Política de Cookies'}
                  {activeModal === 'faq' && 'Preguntas Frecuentes'}
                  {activeModal === 'shipping' && 'Política de Envíos'}
                  {activeModal === 'returns' && 'Política de Devoluciones'}
                  {activeModal === 'warranty' && 'Garantía'}
                </h2>
                <button
                  onClick={() => setActiveModal(null)}
                  className="p-2 hover:opacity-50 transition-opacity"
                  aria-label="Cerrar"
                >
                  <X className="w-5 h-5" strokeWidth={1} />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto flex-1">
                {activeModal === 'terms' && (
                  <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                    <p className="text-xs text-muted-foreground mb-4">
                      Última actualización: Mayo 2026
                    </p>

                    <h3 className="text-base font-bold text-foreground">1. Aceptación de los Términos</h3>
                    <p>
                      Al acceder y utilizar el sitio web de Juhnios Rold, aceptas estar sujeto a estos términos y condiciones de uso, todas las leyes y regulaciones aplicables, y aceptas que eres responsable del cumplimiento de todas las leyes locales aplicables.
                    </p>

                    <h3 className="text-base font-bold text-foreground">2. Uso de Productos</h3>
                    <p>
                      Los productos ofrecidos en Juhnios Rold son para uso personal y no están destinados para la reventa. Nos reservamos el derecho de rechazar el servicio, cerrar cuentas, eliminar o editar contenido, o cancelar pedidos a nuestra sola discreción.
                    </p>

                    <h3 className="text-base font-bold text-foreground">3. Precios y Disponibilidad</h3>
                    <p>
                      Nos reservamos el derecho de modificar precios sin previo aviso. Los precios están sujetos a cambios y la disponibilidad de productos puede variar. No garantizamos que todos los productos estarán disponibles en todo momento.
                    </p>

                    <h3 className="text-base font-bold text-foreground">4. Pagos</h3>
                    <p>
                      Aceptamos múltiples formas de pago incluyendo PSE, Nequi, y tarjetas de crédito. Todos los pagos se procesan de forma segura a través de nuestros proveedores de pago certificados.
                    </p>

                    <h3 className="text-base font-bold text-foreground">5. Envíos y Entregas</h3>
                    <p>
                      Los tiempos de entrega estimados son de 2-5 días hábiles para las principales ciudades de Colombia. Los envíos son gratuitos para compras superiores a $80.000 COP. No nos hacemos responsables por retrasos ocasionados por la empresa de mensajería.
                    </p>

                    <h3 className="text-base font-bold text-foreground">6. Devoluciones y Garantía</h3>
                    <p>
                      Ofrecemos una garantía de satisfacción de 30 días. Los productos deben estar sin abrir o usados en menos del 30% para ser elegibles para devolución. Los gastos de envío de devolución corren por cuenta del cliente.
                    </p>

                    <h3 className="text-base font-bold text-foreground">7. Propiedad Intelectual</h3>
                    <p>
                      Todo el contenido incluido en este sitio, como texto, gráficos, logos, imágenes, es propiedad de Juhnios Rold y está protegido por las leyes de derechos de autor de Colombia.
                    </p>

                    <h3 className="text-base font-bold text-foreground">8. Limitación de Responsabilidad</h3>
                    <p>
                      Juhnios Rold no será responsable de ningún daño directo, indirecto, incidental o consecuente que resulte del uso o la imposibilidad de usar nuestros productos o servicios.
                    </p>
                  </div>
                )}

                {activeModal === 'privacy' && (
                  <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                    <p className="text-xs text-muted-foreground mb-4">
                      Última actualización: Mayo 2026
                    </p>

                    <h3 className="text-base font-bold text-foreground">1. Información que Recopilamos</h3>
                    <p>
                      Recopilamos información personal que nos proporcionas directamente, como tu nombre, dirección de correo electrónico, número de teléfono, dirección de envío y información de pago cuando realizas una compra o te registras en nuestro sitio.
                    </p>

                    <h3 className="text-base font-bold text-foreground">2. Cómo Usamos tu Información</h3>
                    <p>
                      Utilizamos la información que recopilamos para:
                    </p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>Procesar y completar tus pedidos</li>
                      <li>Enviarte confirmaciones de pedidos y actualizaciones de envío</li>
                      <li>Comunicarnos contigo sobre promociones, ofertas especiales y noticias</li>
                      <li>Mejorar nuestros productos y servicios</li>
                      <li>Prevenir fraudes y mantener la seguridad</li>
                    </ul>

                    <h3 className="text-base font-bold text-foreground">3. Compartir Información</h3>
                    <p>
                      No vendemos, comercializamos ni transferimos tu información personal a terceros, excepto a proveedores de servicios de confianza que nos ayudan a operar nuestro sitio web y procesar pagos, siempre que acepten mantener esta información confidencial.
                    </p>

                    <h3 className="text-base font-bold text-foreground">4. Cookies y Tecnologías Similares</h3>
                    <p>
                      Utilizamos cookies y tecnologías similares para mejorar tu experiencia en nuestro sitio web, analizar tendencias, administrar el sitio y recopilar información demográfica sobre nuestra base de usuarios en general.
                    </p>

                    <h3 className="text-base font-bold text-foreground">5. Seguridad de Datos</h3>
                    <p>
                      Implementamos medidas de seguridad diseñadas para proteger tu información personal. Sin embargo, ningún método de transmisión por Internet o almacenamiento electrónico es 100% seguro.
                    </p>

                    <h3 className="text-base font-bold text-foreground">6. Tus Derechos</h3>
                    <p>
                      Tienes derecho a acceder, corregir o eliminar tu información personal. También puedes optar por no recibir comunicaciones de marketing en cualquier momento haciendo clic en el enlace de cancelación de suscripción en nuestros correos electrónicos.
                    </p>

                    <h3 className="text-base font-bold text-foreground">7. Cambios a esta Política</h3>
                    <p>
                      Podemos actualizar esta política de privacidad ocasionalmente. Te notificaremos sobre cualquier cambio publicando la nueva política en esta página y actualizando la fecha de "última actualización".
                    </p>

                    <h3 className="text-base font-bold text-foreground">8. Contacto</h3>
                    <p>
                      Si tienes preguntas sobre esta Política de Privacidad, contáctanos en hola@juhniosrold.com
                    </p>
                  </div>
                )}

                {activeModal === 'cookies' && (
                  <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                    <p className="text-xs text-muted-foreground mb-4">
                      Última actualización: Mayo 2026
                    </p>

                    <h3 className="text-base font-bold text-foreground">¿Qué son las Cookies?</h3>
                    <p>
                      Las cookies son pequeños archivos de texto que se almacenan en tu dispositivo cuando visitas nuestro sitio web. Nos ayudan a mejorar tu experiencia de navegación y nos permiten analizar cómo se utiliza nuestro sitio.
                    </p>

                    <h3 className="text-base font-bold text-foreground">Tipos de Cookies que Utilizamos</h3>

                    <div className="pl-4 space-y-3">
                      <div>
                        <h4 className="font-bold text-foreground">Cookies Esenciales</h4>
                        <p>
                          Estas cookies son necesarias para el funcionamiento básico del sitio web. Incluyen cookies que te permiten acceder a áreas seguras de nuestro sitio o utilizar el carrito de compras.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-bold text-foreground">Cookies de Rendimiento</h4>
                        <p>
                          Estas cookies recopilan información sobre cómo los visitantes utilizan nuestro sitio web, como qué páginas son las más visitadas. Toda la información recopilada es anónima.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-bold text-foreground">Cookies de Funcionalidad</h4>
                        <p>
                          Estas cookies permiten que el sitio web recuerde las elecciones que haces (como tu idioma preferido) y proporcionan características mejoradas y más personales.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-bold text-foreground">Cookies de Marketing</h4>
                        <p>
                          Estas cookies se utilizan para rastrear a los visitantes en los sitios web. La intención es mostrar anuncios que sean relevantes e interesantes para el usuario individual.
                        </p>
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-foreground">Gestión de Cookies</h3>
                    <p>
                      Puedes configurar tu navegador para rechazar todas o algunas cookies, o para alertarte cuando los sitios web establezcan o accedan a las cookies. Si desactivas o rechazas las cookies, ten en cuenta que algunas partes de este sitio web pueden volverse inaccesibles o no funcionar correctamente.
                    </p>

                    <h3 className="text-base font-bold text-foreground">Cookies de Terceros</h3>
                    <p>
                      Utilizamos servicios de terceros como Google Analytics para ayudarnos a analizar cómo los usuarios utilizan el sitio. Estos servicios pueden utilizar cookies para recopilar información de forma anónima.
                    </p>

                    <h3 className="text-base font-bold text-foreground">Más Información</h3>
                    <p>
                      Si tienes preguntas sobre nuestra política de cookies, contáctanos en hola@juhniosrold.com
                    </p>
                  </div>
                )}

                {activeModal === 'faq' && (
                  <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                    <div>
                      <h3 className="text-base font-bold text-foreground mb-2">¿Cuánto tarda el envío?</h3>
                      <p>Los envíos tardan entre 2-5 días hábiles dependiendo de tu ciudad. Bogotá y Medellín usualmente reciben en 2-3 días.</p>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-foreground mb-2">¿Tienen garantía los productos?</h3>
                      <p>Sí, todos nuestros productos tienen garantía de satisfacción de 30 días. Si no estás satisfecha, devolvemos tu dinero.</p>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-foreground mb-2">¿Los productos son naturales?</h3>
                      <p>Nuestros productos contienen 98% ingredientes naturales. Son libres de sulfatos, parabenos y son cruelty-free.</p>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-foreground mb-2">¿Cómo sé qué producto comprar?</h3>
                      <p>Puedes usar nuestra guía de productos interactiva respondiendo 2 preguntas simples sobre tu tipo de cabello y necesidades.</p>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-foreground mb-2">¿Tienen política de devoluciones?</h3>
                      <p>Aceptamos devoluciones dentro de los 30 días posteriores a la compra. El producto debe estar sin abrir o usado menos del 30%.</p>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-foreground mb-2">¿Puedo pagar en cuotas?</h3>
                      <p>Sí, aceptamos cuotas sin interés con tarjetas de crédito de todos los bancos principales en Colombia.</p>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-foreground mb-2">¿Dónde puedo rastrear mi pedido?</h3>
                      <p>Una vez que tu pedido sea enviado, recibirás un correo electrónico con el número de seguimiento y un enlace para rastrearlo en tiempo real.</p>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-foreground mb-2">¿Hacen envíos internacionales?</h3>
                      <p>Actualmente solo realizamos envíos dentro de Colombia. Estamos trabajando para expandir nuestros servicios internacionalmente pronto.</p>
                    </div>
                  </div>
                )}

                {activeModal === 'shipping' && (
                  <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                    <h3 className="text-base font-bold text-foreground">Tiempos de Entrega</h3>
                    <p>
                      Los tiempos de entrega varían según tu ubicación:
                    </p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li><strong>Bogotá y Medellín:</strong> 2-3 días hábiles</li>
                      <li><strong>Cali, Barranquilla, Cartagena:</strong> 3-4 días hábiles</li>
                      <li><strong>Otras ciudades principales:</strong> 4-5 días hábiles</li>
                      <li><strong>Zonas rurales:</strong> 5-7 días hábiles</li>
                    </ul>

                    <h3 className="text-base font-bold text-foreground">Costos de Envío</h3>
                    <p>
                      <strong>Envío gratis</strong> en compras superiores a $80.000 COP a cualquier parte de Colombia.
                    </p>
                    <p>
                      Para compras menores a $80.000 COP, el costo de envío es de $10.000 COP.
                    </p>

                    <h3 className="text-base font-bold text-foreground">Procesamiento de Pedidos</h3>
                    <p>
                      Los pedidos se procesan de lunes a viernes de 8:00 AM a 5:00 PM. Los pedidos realizados después de las 2:00 PM o durante fines de semana/festivos se procesarán el siguiente día hábil.
                    </p>

                    <h3 className="text-base font-bold text-foreground">Rastreo</h3>
                    <p>
                      Una vez que tu pedido sea despachado, recibirás un correo electrónico con el número de seguimiento para que puedas rastrear tu paquete en tiempo real.
                    </p>

                    <h3 className="text-base font-bold text-foreground">Problemas con la Entrega</h3>
                    <p>
                      Si tu pedido no llega dentro del tiempo estimado o si hay algún problema con la entrega, contáctanos inmediatamente a hola@juhniosrold.com o al +57 300 123 4567.
                    </p>
                  </div>
                )}

                {activeModal === 'returns' && (
                  <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                    <h3 className="text-base font-bold text-foreground">Política de Devoluciones de 30 Días</h3>
                    <p>
                      En Juhnios Rold queremos que estés 100% satisfecha con tu compra. Si por alguna razón no estás contenta con tu pedido, aceptamos devoluciones dentro de los 30 días posteriores a la fecha de compra.
                    </p>

                    <h3 className="text-base font-bold text-foreground">Condiciones para Devoluciones</h3>
                    <p>
                      Para ser elegible para una devolución, tu artículo debe cumplir con las siguientes condiciones:
                    </p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>El producto debe estar sin abrir, o usado menos del 30%</li>
                      <li>Debe estar en su empaque original</li>
                      <li>Debe incluir todos los componentes y accesorios originales</li>
                      <li>Debes presentar el recibo o comprobante de compra</li>
                    </ul>

                    <h3 className="text-base font-bold text-foreground">Cómo Iniciar una Devolución</h3>
                    <p>
                      Para iniciar una devolución:
                    </p>
                    <ol className="list-decimal pl-6 space-y-1">
                      <li>Contáctanos por correo a hola@juhniosrold.com con tu número de pedido</li>
                      <li>Recibirás instrucciones sobre cómo y dónde enviar tu devolución</li>
                      <li>Empaca el producto de forma segura en su empaque original</li>
                      <li>Envía el paquete a la dirección proporcionada</li>
                    </ol>

                    <h3 className="text-base font-bold text-foreground">Reembolsos</h3>
                    <p>
                      Una vez que recibamos tu devolución, inspeccionaremos el artículo y te notificaremos sobre el estado de tu reembolso. Si tu devolución es aprobada, procesaremos el reembolso al método de pago original dentro de 5-7 días hábiles.
                    </p>

                    <h3 className="text-base font-bold text-foreground">Costos de Envío de Devolución</h3>
                    <p>
                      Los gastos de envío de devolución corren por cuenta del cliente, a menos que el producto esté defectuoso o hayamos cometido un error en tu pedido.
                    </p>

                    <h3 className="text-base font-bold text-foreground">Intercambios</h3>
                    <p>
                      Si deseas intercambiar un producto por otro, contáctanos y con gusto te ayudaremos a procesar el intercambio.
                    </p>
                  </div>
                )}

                {activeModal === 'warranty' && (
                  <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                    <h3 className="text-base font-bold text-foreground">Garantía de Satisfacción de 30 Días</h3>
                    <p>
                      Todos los productos de Juhnios Rold vienen con nuestra Garantía de Satisfacción de 30 días. Si no estás completamente satisfecha con los resultados, te devolvemos tu dinero. Sin preguntas.
                    </p>

                    <h3 className="text-base font-bold text-foreground">¿Qué Cubre Nuestra Garantía?</h3>
                    <p>
                      Nuestra garantía cubre:
                    </p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>Productos que no cumplan con las expectativas descritas</li>
                      <li>Defectos de fabricación o materiales</li>
                      <li>Productos que causen reacciones adversas no especificadas</li>
                      <li>Cualquier insatisfacción con los resultados del producto</li>
                    </ul>

                    <h3 className="text-base font-bold text-foreground">Garantía de Calidad</h3>
                    <p>
                      Todos nuestros productos son formulados con ingredientes de la más alta calidad y pasan por rigurosos controles de calidad antes de llegar a ti. Garantizamos que:
                    </p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>Nuestros productos contienen 98% ingredientes naturales certificados</li>
                      <li>Son libres de sulfatos, parabenos y crueldad animal</li>
                      <li>Están fabricados bajo estándares internacionales de calidad</li>
                      <li>Tienen fecha de vencimiento claramente indicada</li>
                    </ul>

                    <h3 className="text-base font-bold text-foreground">Cómo Hacer Válida la Garantía</h3>
                    <p>
                      Para hacer válida tu garantía:
                    </p>
                    <ol className="list-decimal pl-6 space-y-1">
                      <li>Contáctanos dentro de los 30 días de tu compra</li>
                      <li>Proporciona tu número de pedido y una breve descripción del problema</li>
                      <li>Envía fotos del producto si es relevante</li>
                      <li>Procesaremos tu solicitud en un máximo de 48 horas</li>
                    </ol>

                    <h3 className="text-base font-bold text-foreground">Exclusiones</h3>
                    <p>
                      Nuestra garantía no cubre:
                    </p>
                    <ul className="list-disc pl-6 space-y-1">
                      <li>Daños causados por uso inadecuado del producto</li>
                      <li>Productos comprados a través de terceros no autorizados</li>
                      <li>Reacciones alérgicas a ingredientes listados en la etiqueta</li>
                      <li>Productos vencidos o almacenados incorrectamente</li>
                    </ul>

                    <h3 className="text-base font-bold text-foreground">Compromiso con la Calidad</h3>
                    <p>
                      En Juhnios Rold, nuestra prioridad es tu satisfacción. Si tienes alguna pregunta o inquietud sobre nuestros productos, no dudes en contactarnos. Estamos aquí para ayudarte a lograr los mejores resultados para tu cabello.
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-border">
                <button
                  onClick={() => setActiveModal(null)}
                  className="w-full py-3 bg-foreground text-background text-xs tracking-wider uppercase hover:opacity-90 transition-opacity"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </footer>
  );
}