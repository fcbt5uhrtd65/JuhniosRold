import { useState, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'motion/react';
import { ChevronDown, MessageCircle, HelpCircle } from 'lucide-react';

const faqs = [
  {
    question: '¿Cuánto tarda el envío?',
    answer: 'Los envíos tardan entre 2-5 días hábiles dependiendo de tu ciudad. Bogotá y Medellín usualmente reciben en 2-3 días.',
    tag: 'Envíos',
  },
  {
    question: '¿Tienen garantía los productos?',
    answer: 'Sí, todos nuestros productos tienen garantía de satisfacción de 30 días. Si no estás satisfecha, devolvemos tu dinero completamente.',
    tag: 'Garantía',
  },
  {
    question: '¿Los productos son naturales?',
    answer: 'Nuestros productos contienen 98% ingredientes naturales. Son libres de sulfatos, parabenos y son cruelty-free. Certificados internacionalmente.',
    tag: 'Ingredientes',
  },
  {
    question: '¿Cómo sé qué producto comprar?',
    answer: 'Puedes usar nuestra guía de productos interactiva respondiendo 2 preguntas simples sobre tu tipo de cabello y necesidades específicas.',
    tag: 'Guía',
  },
  {
    question: '¿Tienen política de devoluciones?',
    answer: 'Aceptamos devoluciones dentro de los 30 días posteriores a la compra. El producto debe estar sin abrir o usado menos del 30%.',
    tag: 'Devoluciones',
  },
  {
    question: '¿Puedo pagar en cuotas?',
    answer: 'Sí, aceptamos cuotas sin interés con tarjetas de crédito de todos los bancos principales en Colombia. También PSE y efectivo.',
    tag: 'Pagos',
  },
];

const TAG_COLORS: Record<string, string> = {
  'Envíos':       'bg-blue-50 text-blue-700 border-blue-100',
  'Garantía':     'bg-emerald-50 text-emerald-700 border-emerald-100',
  'Ingredientes': 'bg-green-50 text-green-700 border-green-100',
  'Guía':         'bg-amber-50 text-amber-700 border-amber-100',
  'Devoluciones': 'bg-rose-50 text-rose-700 border-rose-100',
  'Pagos':        'bg-purple-50 text-purple-700 border-purple-100',
};

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-80px' });

  return (
    <section ref={sectionRef} className="py-24 bg-white overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 lg:px-14">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="mb-14"
        >
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-stone-50 border border-stone-100 rounded-full mb-5">
                <HelpCircle className="w-3 h-3 text-stone-500" strokeWidth={1.5} />
                <span className="text-[10px] tracking-[0.25em] uppercase text-stone-600">Preguntas frecuentes</span>
              </div>
              <h2
                className="text-4xl md:text-5xl lg:text-6xl font-light leading-none text-foreground"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                ¿Tienes dudas?
              </h2>
              <p className="text-sm text-muted-foreground mt-3 max-w-sm leading-relaxed">
                Aquí respondemos las preguntas más comunes de nuestra comunidad.
              </p>
            </div>

            <motion.a
              href="https://wa.me/573001234567"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="self-start md:self-auto inline-flex items-center gap-2.5 px-5 py-3 bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] tracking-wider uppercase rounded-xl hover:bg-emerald-100 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
              Preguntar por WhatsApp
            </motion.a>
          </div>
        </motion.div>

        {/* FAQ list — two columns on desktop */}
        <div className="grid md:grid-cols-2 gap-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 16 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.08 + index * 0.07, duration: 0.55 }}
              className={`border rounded-2xl overflow-hidden transition-all duration-200 ${
                openIndex === index
                  ? 'border-stone-200 bg-white shadow-sm'
                  : 'border-stone-100 bg-stone-50/60 hover:bg-stone-50 hover:border-stone-200'
              }`}
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-5 flex items-start justify-between text-left gap-4 group"
              >
                <div className="flex items-start gap-3 flex-1">
                  {/* Tag */}
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] tracking-[0.2em] uppercase border font-medium mt-0.5 flex-shrink-0 ${TAG_COLORS[faq.tag] ?? 'bg-stone-50 text-stone-600 border-stone-100'}`}>
                    {faq.tag}
                  </span>
                  <span className="text-sm font-medium text-foreground group-hover:text-foreground/80 transition-colors leading-snug">
                    {faq.question}
                  </span>
                </div>

                <motion.div
                  animate={{ rotate: openIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="flex-shrink-0 mt-0.5 p-1 rounded-full bg-white border border-stone-100 shadow-sm"
                >
                  <ChevronDown className="w-3.5 h-3.5 text-stone-500" strokeWidth={2} />
                </motion.div>
              </button>

              <AnimatePresence initial={false}>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-5 pt-0">
                      <div className="h-px bg-stone-100 mb-4" />
                      <p className="text-sm text-stone-600 leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.7 }}
          className="mt-12 p-7 bg-stone-50 rounded-2xl border border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-5"
        >
          <div>
            <p className="text-sm font-medium text-foreground mb-1">¿No encontraste tu respuesta?</p>
            <p className="text-xs text-muted-foreground">Nuestro equipo responde en menos de 24 horas.</p>
          </div>
          <motion.a
            href="https://wa.me/573001234567"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-foreground text-background text-[11px] tracking-wider uppercase rounded-xl hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
            Contactar ahora
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
}
