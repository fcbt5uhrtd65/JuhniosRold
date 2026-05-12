import { useState } from 'react';
import { motion, AnimatePresence, useInView } from 'motion/react';
import { Plus } from 'lucide-react';
import { useRef } from 'react';

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

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-80px' });

  return (
    <section ref={sectionRef} className="py-24 bg-background overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-5 sm:px-8 md:px-12">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="mb-16 grid md:grid-cols-12 gap-8 items-end"
        >
          <div className="md:col-span-5">
            <div className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground mb-4">
              PREGUNTAS FRECUENTES
            </div>
            <h2 className="text-5xl md:text-6xl leading-none mb-6">FAQ</h2>
            <div className="h-px w-12 bg-foreground mb-6" />
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
              ¿Tienes dudas? Aquí respondemos las preguntas más comunes de nuestras clientas.
            </p>
          </div>

          {/* Decorative number */}
          <div className="md:col-span-7 flex justify-end">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-[120px] md:text-[180px] font-light text-foreground/[0.04] leading-none select-none"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {String(faqs.length).padStart(2, '0')}
            </motion.div>
          </div>
        </motion.div>

        {/* FAQ accordion */}
        <div className="md:grid md:grid-cols-12 gap-12">
          <div className="md:col-span-8 md:col-start-5 space-y-0">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 16 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.1 + index * 0.07, duration: 0.6 }}
                className="border-b border-border"
              >
                <button
                  onClick={() => setOpenIndex(openIndex === index ? null : index)}
                  className="w-full py-6 flex items-start justify-between text-left gap-6 group"
                >
                  <div className="flex items-start gap-4 flex-1">
                    {/* Index */}
                    <span className="text-[10px] font-mono text-muted-foreground/30 pt-0.5 flex-shrink-0 group-hover:text-muted-foreground/60 transition-colors">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className="flex-1">
                      {/* Tag */}
                      <div className="text-[8px] tracking-[0.3em] uppercase text-muted-foreground/50 mb-1.5">
                        {faq.tag}
                      </div>
                      <span className="text-sm group-hover:opacity-70 transition-opacity">
                        {faq.question}
                      </span>
                    </div>
                  </div>

                  <motion.div
                    animate={{ rotate: openIndex === index ? 45 : 0 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="flex-shrink-0 mt-0.5"
                  >
                    <Plus className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                  </motion.div>
                </button>

                <AnimatePresence initial={false}>
                  {openIndex === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <motion.p
                        initial={{ y: 8 }}
                        animate={{ y: 0 }}
                        exit={{ y: 4 }}
                        className="pb-6 text-xs text-muted-foreground leading-relaxed pl-9"
                      >
                        {faq.answer}
                      </motion.p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.8 }}
          className="mt-16 pt-12 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6"
        >
          <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
            ¿No encontraste tu respuesta? Escríbenos directamente.
          </p>
          <motion.a
            href="https://wa.me/573001234567"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ x: 5 }}
            className="flex items-center gap-2 text-[10px] tracking-[0.3em] uppercase border-b border-foreground/30 pb-0.5 hover:border-foreground transition-colors"
          >
            Contactar por WhatsApp
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
}
