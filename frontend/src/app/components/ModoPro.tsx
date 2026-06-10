import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, X, Check, Loader2 } from "lucide-react";
import proVideo from "../../imports/51905-467131986.mp4";

export function ModoPro() {
  const [showModal, setShowModal] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', salon: '', phone: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate API call
    await new Promise(r => setTimeout(r, 1200));
    setLoading(false);
    setSubmitted(true);
  };

  return (
    <>
      <section
        id="pro"
        className="relative h-screen overflow-hidden"
      >
        {/* Video Background */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src={proVideo} type="video/mp4" />
        </video>

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent"></div>

        {/* Content */}
        <div className="relative z-10 h-full flex items-center md:items-end">
          <div className="w-full max-w-[1400px] mx-auto px-5 sm:px-8 md:px-12 py-12 md:pb-16">
            <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center md:items-end">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <div className="text-[9px] tracking-[0.4em] uppercase text-white/50 mb-4">
                  Programa Profesional
                </div>

                <h2 className="text-white leading-tight mb-6">
                  <span className="block text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold">
                    Modo PRO
                  </span>
                  <span className="block text-lg sm:text-xl md:text-2xl font-light opacity-80 mt-2">
                    Para salones que buscan la excelencia
                  </span>
                </h2>

                <p className="text-sm text-white/70 max-w-md mb-6 leading-relaxed">
                  Más de 500 profesionales confían en nosotros
                </p>

                <motion.button
                  whileHover={{ x: 5 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowModal(true)}
                  className="group inline-flex items-center gap-3 px-6 py-3 bg-white text-black text-xs tracking-[0.2em] uppercase hover:bg-white/90 transition-all"
                >
                  <span>Solicitar acceso</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
                </motion.button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-2 gap-3"
              >
                {[
                  { label: 'Descuento', value: 'Hasta 40%' },
                  { label: 'Profesionales', value: '500+' },
                  { label: 'Stock', value: 'Prioritario' },
                  { label: 'Capacitación', value: 'Exclusiva' },
                ].map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + idx * 0.05 }}
                    className="bg-white/5 backdrop-blur-sm border border-white/10 p-4 hover:bg-white/10 transition-colors"
                  >
                    <div className="text-[9px] tracking-[0.3em] uppercase text-white/50 mb-2">
                      {item.label}
                    </div>
                    <div className="text-lg md:text-xl text-white font-medium">
                      {item.value}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Pro Access Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4"
            onClick={() => { if (!loading) setShowModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 40 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="bg-background border border-border max-w-3xl w-full relative overflow-hidden"
            >
              {!submitted ? (
                <div className="grid md:grid-cols-5">
                  {/* Left Panel - Benefits */}
                  <div className="md:col-span-2 bg-foreground text-background p-8 md:p-10">
                    <div className="text-[9px] tracking-[0.4em] uppercase opacity-60 mb-6">
                      Juhnios Rold PRO
                    </div>

                    <h3 className="text-2xl md:text-3xl mb-6 leading-tight">
                      Beneficios<br />Exclusivos
                    </h3>

                    <div className="space-y-6 mb-8">
                      <div>
                        <div className="flex items-baseline gap-2 mb-1">
                          <div className="text-3xl font-bold">40%</div>
                          <div className="text-sm opacity-80">descuento</div>
                        </div>
                        <p className="text-xs opacity-70 leading-relaxed">
                          En todos nuestros productos profesionales
                        </p>
                      </div>

                      <div>
                        <div className="flex items-baseline gap-2 mb-1">
                          <div className="text-3xl font-bold">500+</div>
                          <div className="text-sm opacity-80">salones</div>
                        </div>
                        <p className="text-xs opacity-70 leading-relaxed">
                          Profesionales que ya confían en nosotros
                        </p>
                      </div>

                      <div>
                        <div className="text-lg font-medium mb-1">Stock Prioritario</div>
                        <p className="text-xs opacity-70 leading-relaxed">
                          Garantizamos disponibilidad para tu salón
                        </p>
                      </div>

                      <div>
                        <div className="text-lg font-medium mb-1">Capacitación Gratis</div>
                        <p className="text-xs opacity-70 leading-relaxed">
                          Talleres y formación continua incluida
                        </p>
                      </div>

                      <div>
                        <div className="text-lg font-medium mb-1">Soporte Dedicado</div>
                        <p className="text-xs opacity-70 leading-relaxed">
                          Asesor personal para tu negocio
                        </p>
                      </div>
                    </div>

                    <div className="text-[10px] opacity-50 leading-relaxed">
                      * Beneficios aplicables después de la aprobación de tu cuenta profesional
                    </div>
                  </div>

                  {/* Right Panel - Form */}
                  <div className="md:col-span-3 p-8 md:p-10 relative">
                    <button
                      onClick={() => setShowModal(false)}
                      disabled={loading}
                      className="absolute top-6 right-6 p-2 hover:bg-secondary transition-colors disabled:opacity-30 rounded-full"
                    >
                      <X className="w-5 h-5" strokeWidth={1.5} />
                    </button>

                    <div className="mb-8">
                      <h3 className="text-2xl md:text-3xl mb-3 leading-tight">
                        Únete al Programa PRO
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Completa tus datos y un asesor especializado te contactará en <strong>menos de 24 horas</strong> para activar tu cuenta profesional.
                      </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div className="grid md:grid-cols-2 gap-5">
                        <div>
                          <label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2 block">
                            Tu nombre completo
                          </label>
                          <input
                            type="text"
                            required
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full px-4 py-3 bg-secondary border border-border text-sm focus:outline-none focus:border-foreground focus:bg-background transition-all"
                            placeholder="Ej: María González"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2 block">
                            Teléfono de contacto
                          </label>
                          <input
                            type="tel"
                            required
                            value={form.phone}
                            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                            className="w-full px-4 py-3 bg-secondary border border-border text-sm focus:outline-none focus:border-foreground focus:bg-background transition-all"
                            placeholder="Ej: +57 300 123 4567"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2 block">
                          Email profesional
                        </label>
                        <input
                          type="email"
                          required
                          value={form.email}
                          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                          className="w-full px-4 py-3 bg-secondary border border-border text-sm focus:outline-none focus:border-foreground focus:bg-background transition-all"
                          placeholder="Ej: maria@misalon.com"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2 block">
                          Nombre de tu salón o negocio
                        </label>
                        <input
                          type="text"
                          required
                          value={form.salon}
                          onChange={e => setForm(f => ({ ...f, salon: e.target.value }))}
                          className="w-full px-4 py-3 bg-secondary border border-border text-sm focus:outline-none focus:border-foreground focus:bg-background transition-all"
                          placeholder="Ej: Salón Belleza & Estilo"
                        />
                      </div>

                      <div className="pt-4">
                        <motion.button
                          type="submit"
                          disabled={loading}
                          whileHover={{ scale: loading ? 1 : 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="w-full py-4 bg-foreground text-background text-xs tracking-[0.25em] uppercase flex items-center justify-center gap-3 disabled:opacity-60 transition-all shadow-lg"
                        >
                          {loading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Enviando solicitud...</span>
                            </>
                          ) : (
                            <>
                              <span>Solicitar acceso PRO</span>
                              <ArrowRight className="w-4 h-4" strokeWidth={2} />
                            </>
                          )}
                        </motion.button>
                      </div>

                      <p className="text-[10px] text-muted-foreground text-center leading-relaxed pt-2">
                        Al enviar este formulario, aceptas que un asesor de Juhnios Rold se comunique contigo para validar tu información y activar los beneficios profesionales.
                      </p>
                    </form>
                  </div>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-12 md:p-16 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring', duration: 0.6 }}
                    className="w-20 h-20 bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-8 rounded-full"
                  >
                    <Check className="w-10 h-10" strokeWidth={2} />
                  </motion.div>

                  <h3 className="text-3xl mb-4">¡Solicitud Recibida!</h3>

                  <div className="max-w-md mx-auto mb-8">
                    <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                      Gracias por tu interés en el <strong>Programa PRO de Juhnios Rold</strong>.
                    </p>

                    <div className="bg-secondary p-6 border border-border text-left mb-6">
                      <div className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-3">
                        Próximos pasos
                      </div>
                      <ul className="space-y-3 text-sm">
                        <li className="flex gap-3">
                          <span className="text-foreground font-bold">1.</span>
                          <span>Un asesor revisará tu información en las próximas horas</span>
                        </li>
                        <li className="flex gap-3">
                          <span className="text-foreground font-bold">2.</span>
                          <span>Te contactaremos al <strong>{form.phone}</strong> en menos de 24h</span>
                        </li>
                        <li className="flex gap-3">
                          <span className="text-foreground font-bold">3.</span>
                          <span>Activaremos tus beneficios PRO inmediatamente</span>
                        </li>
                      </ul>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Revisa tu email <strong>{form.email}</strong> para confirmar la recepción de tu solicitud.
                    </p>
                  </div>

                  <button
                    onClick={() => { setShowModal(false); setSubmitted(false); setForm({ name: '', email: '', salon: '', phone: '' }); }}
                    className="px-8 py-3 bg-foreground text-background text-xs tracking-[0.2em] uppercase hover:opacity-90 transition-opacity"
                  >
                    Entendido
                  </button>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}