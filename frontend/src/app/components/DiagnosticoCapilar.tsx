import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowRight, FlaskConical, Leaf, Heart, MapPin } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useToast } from '../contexts/ToastContext';
import { getProducts } from '../services/products.service';

const OLIVE = '#2D3A1F';
const CREAM = '#F7F5F1';

interface Question {
  id: number;
  question: string;
  options: { value: string; label: string }[];
}

export function DiagnosticoCapilar() {
  const { addItem } = useCart();
  const toast = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);

  const questions: Question[] = [
    {
      id: 0,
      question: "¿Cómo describes tu cabello?",
      options: [
        { value: "seco", label: "Seco y maltratado" },
        { value: "graso", label: "Graso en raíz" },
        { value: "normal", label: "Normal y balanceado" },
        { value: "mixto", label: "Mixto" }
      ]
    },
    {
      id: 1,
      question: "¿Cuál es tu mayor preocupación?",
      options: [
        { value: "caida", label: "Caída del cabello" },
        { value: "frizz", label: "Frizz incontrolable" },
        { value: "brillo", label: "Falta de brillo" },
        { value: "volumen", label: "Sin volumen" }
      ]
    },
    {
      id: 2,
      question: "¿Con qué frecuencia lavas tu cabello?",
      options: [
        { value: "diario", label: "Diario" },
        { value: "interdiario", label: "Interdiario" },
        { value: "2-3veces", label: "2-3 veces/semana" },
        { value: "semanal", label: "1 vez/semana" }
      ]
    }
  ];

  const handleAnswer = (value: string) => {
    setAnswers({ ...answers, [currentQuestion]: value });
    if (currentQuestion < questions.length - 1) {
      setTimeout(() => setCurrentQuestion(currentQuestion + 1), 300);
    } else {
      setTimeout(() => setShowResults(true), 300);
    }
  };

  const getRecommendation = () => {
    const hairType = answers[0];
    const concern = answers[1];

    if (concern === 'caida' || hairType === 'seco') {
      return {
        title: "Keratina Hidrolizada",
        subtitle: "Reconstrucción Profunda",
        benefit: "Repara. Sella. Ilumina.",
        description: "Proteína pura que penetra la fibra capilar para reparar daños desde el interior. Restaura la fuerza perdida por tratamientos químicos.",
        products: [
          { id: 'aceite-romero-120ml', name: 'Aceite de Romero', size: '120ml', price: 28900, image: 'https://images.unsplash.com/photo-1571875257727-256c39da42af?w=600&q=80' },
          { id: 'aceite-cebolla-120ml', name: 'Aceite de Cebolla', size: '120ml', price: 28900, image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&q=80' },
          { id: 'tratamiento-keratina', name: 'Tratamiento Keratina', size: '220gr', price: 38900, image: 'https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?w=600&q=80' }
        ],
        image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=1200&q=80'
      };
    } else if (concern === 'frizz' || concern === 'brillo') {
      return {
        title: "Aceite de Aguacate",
        subtitle: "Control y Brillo",
        benefit: "Nutre. Controla. Brilla.",
        description: "Vitaminas A, D, E que penetran profundamente para suavizar la cutícula y aportar brillo natural duradero.",
        products: [
          { id: 'silicona-lino-50ml', name: 'Silicona de Lino', size: '50ml', price: 24900, image: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=600&q=80' },
          { id: 'aceite-aguacate-90ml', name: 'Aceite de Aguacate', size: '90ml', price: 35900, image: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=600&q=80' },
          { id: 'tratamiento-keratina', name: 'Tratamiento Keratina', size: '220gr', price: 38900, image: 'https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?w=600&q=80' }
        ],
        image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=1200&q=80'
      };
    } else {
      return {
        title: "Aceite de Romero",
        subtitle: "Estimulación Natural",
        benefit: "Estimula. Fortalece. Protege.",
        description: "Extracto puro que activa la circulación del cuero cabelludo para reducir la caída y fortalecer desde la raíz.",
        products: [
          { id: 'aceite-romero-120ml', name: 'Aceite de Romero', size: '120ml', price: 28900, image: 'https://images.unsplash.com/photo-1571875257727-256c39da42af?w=600&q=80' },
          { id: 'silicona-lino-50ml', name: 'Silicona de Lino', size: '50ml', price: 24900, image: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=600&q=80' },
          { id: 'aceite-aguacate-90ml', name: 'Aceite de Aguacate', size: '90ml', price: 35900, image: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=600&q=80' }
        ],
        image: 'https://images.unsplash.com/photo-1596401885239-34d567b41b5e?w=1200&q=80'
      };
    }
  };

  const handleAddAllToCart = async () => {
    const recommendation = getRecommendation();
    try {
      const resolvedProducts = await Promise.all(
        recommendation.products.map(async product => {
          const result = await getProducts({
            search: product.name,
            active: true,
            limit: 10,
          });
          const catalogProduct =
            result.data.find(
              item => item.name.toLowerCase() === product.name.toLowerCase(),
            ) ?? result.data[0];
          const variant =
            catalogProduct?.variants.find(
              item => item.is_active && item.presentation === product.size,
            ) ?? catalogProduct?.variants.find(item => item.is_active);
          if (!catalogProduct || !variant) {
            throw new Error(`${product.name} no está disponible en el catálogo.`);
          }
          return { catalogProduct, variant, fallbackImage: product.image };
        }),
      );

      for (const { catalogProduct, variant, fallbackImage } of resolvedProducts) {
        const added = await addItem({
          variantId: variant.id,
          name: catalogProduct.name,
          category: catalogProduct.category_name,
          size: variant.presentation,
          price: variant.current_price ?? catalogProduct.price ?? 0,
          image: catalogProduct.primary_image ?? fallbackImage,
        });
        if (!added) return;
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'No fue posible agregar la recomendación.',
      );
      return;
    }
    setAddedToCart(true);
    setTimeout(() => {
      setAddedToCart(false);
      setIsModalOpen(false);
      resetQuiz();
    }, 1500);
  };

  const resetQuiz = () => {
    setCurrentQuestion(0);
    setAnswers({});
    setShowResults(false);
    setAddedToCart(false);
  };

  const progress = ((currentQuestion + 1) / questions.length) * 100;

  const benefitsStrip = [
    { icon: Leaf,         label: 'FÓRMULAS NATURALES',       sub: 'Ingredientes puros' },
    { icon: FlaskConical, label: 'SIN QUÍMICOS AGRESIVOS',   sub: 'Cero sulfatos y parabenos' },
    { icon: Heart,        label: 'CRUELTY FREE',             sub: 'No testado en animales' },
    { icon: MapPin,       label: 'HECHO EN COLOMBIA',        sub: 'Apoyamos lo local' },
  ];

  return (
    <>
      {/* ─── BANNER CTA ─────────────────────────────────────── */}
      <section className="py-16 overflow-hidden" style={{ backgroundColor: '#FAFAF8' }}>
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 lg:px-14">

          {/* Banner horizontal */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-3xl overflow-hidden grid md:grid-cols-[1fr_1.15fr]"
            style={{ backgroundColor: CREAM, minHeight: 420 }}
          >
            {/* Izquierda: foto producto */}
            <div className="relative min-h-[280px] md:min-h-0">
              <img
                src="https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=900&q=85"
                alt="Aceites naturales Juhnios Rold"
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* Overlay suave izquierda→transparente */}
              <div
                className="absolute inset-0 hidden md:block"
                style={{ background: `linear-gradient(to right, transparent 70%, ${CREAM})` }}
              />
            </div>

            {/* Derecha: contenido */}
            <div className="flex flex-col justify-center px-8 py-10 md:px-12 md:py-14 md:pl-6">
              {/* Eyebrow */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-5 h-px bg-stone-400" />
                <span className="text-[9px] tracking-[0.38em] uppercase text-stone-500 font-medium">
                  Diagnóstico personalizado
                </span>
              </div>

              {/* Título Playfair */}
              <h2
                className="text-3xl sm:text-4xl xl:text-5xl font-light text-stone-900 leading-snug mb-5"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Descubre qué necesita<br />
                <em
                  className="not-italic font-semibold"
                  style={{ fontStyle: 'italic', color: OLIVE }}
                >
                  tu cabello
                </em>
              </h2>

              <p className="text-sm text-stone-500 leading-relaxed mb-7 max-w-sm">
                Tres preguntas. Una recomendación profesional personalizada con
                concentraciones clínicamente efectivas, sin químicos agresivos.
              </p>

              {/* Mini beneficios */}
              <ul className="space-y-2.5 mb-8">
                {[
                  '100% personalizado para tu tipo de cabello',
                  'Fórmulas naturales y efectivas',
                  'Recomendación de expertos capilares',
                ].map(item => (
                  <li key={item} className="flex items-center gap-2.5">
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${OLIVE}18` }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: OLIVE }} />
                    </div>
                    <span className="text-xs text-stone-600">{item}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <motion.button
                  onClick={() => setIsModalOpen(true)}
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  className="inline-flex items-center gap-2.5 px-7 py-3.5 text-white text-[11px] tracking-[0.22em] uppercase font-semibold rounded-full transition-all"
                  style={{ backgroundColor: OLIVE }}
                >
                  Comenzar diagnóstico
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
                </motion.button>
               
              </div>
            </div>
          </motion.div>

          {/* ── Strip de beneficios ────────────────────────── */}
          <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {benefitsStrip.map(({ icon: Icon, label, sub }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="flex items-center gap-3.5 px-5 py-4 bg-white rounded-2xl border border-stone-100"
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${OLIVE}12` }}
                >
                  <Icon className="w-4 h-4" style={{ color: OLIVE }} strokeWidth={1.5} />
                </div>
                <div>
                  <div className="text-[9px] tracking-[0.18em] uppercase font-semibold text-stone-700 leading-snug">
                    {label}
                  </div>
                  <div className="text-[9px] text-stone-400 mt-0.5">{sub}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── MODAL QUIZ (lógica preservada íntegramente) ──── */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-background/95 z-50 flex items-center justify-center p-4"
            onClick={() => { setIsModalOpen(false); resetQuiz(); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              onClick={e => e.stopPropagation()}
              className="relative bg-background border border-border max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-3xl"
            >
              {/* Cerrar */}
              <button
                onClick={() => { setIsModalOpen(false); resetQuiz(); }}
                className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 hover:opacity-50 transition-opacity z-10"
              >
                <X className="w-5 h-5" strokeWidth={1} />
              </button>

              <div className="p-5 sm:p-8 md:p-12">
                <AnimatePresence mode="wait">
                  {!showResults ? (
                    <motion.div
                      key="quiz"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {/* Progreso */}
                      <div className="mb-12">
                        <div className="flex justify-between text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-3">
                          <span>Pregunta {currentQuestion + 1} de {questions.length}</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="h-px bg-border">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className="h-full"
                            style={{ backgroundColor: OLIVE }}
                          />
                        </div>
                      </div>

                      <AnimatePresence mode="wait">
                        <motion.div
                          key={currentQuestion}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                        >
                          <h3 className="text-2xl sm:text-3xl md:text-4xl mb-8 md:mb-12 leading-tight">
                            {questions[currentQuestion].question}
                          </h3>

                          <div className="space-y-3">
                            {questions[currentQuestion].options.map((option, idx) => (
                              <motion.button
                                key={option.value}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05, duration: 0.2 }}
                                onClick={() => handleAnswer(option.value)}
                                className={`w-full text-left py-4 px-6 border transition-all rounded-xl ${
                                  answers[currentQuestion] === option.value
                                    ? 'border-foreground bg-foreground text-background'
                                    : 'border-border hover:border-foreground'
                                }`}
                              >
                                <span className="text-sm">{option.label}</span>
                              </motion.button>
                            ))}
                          </div>
                        </motion.div>
                      </AnimatePresence>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="results"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="grid md:grid-cols-2 gap-8 md:gap-12"
                    >
                      {/* Imagen */}
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2, duration: 0.4 }}
                        className="relative aspect-[16/10] sm:aspect-[3/4] md:aspect-[3/4] bg-secondary rounded-2xl overflow-hidden"
                      >
                        <img
                          src={getRecommendation().image}
                          alt={getRecommendation().title}
                          className="w-full h-full object-cover"
                        />
                      </motion.div>

                      {/* Contenido */}
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3, duration: 0.4 }}
                        className="flex flex-col justify-center"
                      >
                        <div className="mb-2">
                          <span className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
                            {getRecommendation().subtitle}
                          </span>
                        </div>

                        <h3 className="text-4xl md:text-5xl mb-6 leading-tight font-serif">
                          {getRecommendation().title}
                        </h3>

                        <p className="text-lg mb-8 italic font-light">
                          {getRecommendation().benefit}
                        </p>

                        <p className="text-sm text-muted-foreground leading-relaxed mb-12">
                          {getRecommendation().description}
                        </p>

                        <motion.button
                          onClick={handleAddAllToCart}
                          disabled={addedToCart}
                          whileHover={{ opacity: 0.85 }}
                          className="w-full py-4 text-sm tracking-wide transition-all text-white rounded-full"
                          style={{ backgroundColor: addedToCart ? `${OLIVE}80` : OLIVE }}
                        >
                          {addedToCart ? 'Agregado al carrito' : 'Agregar al carrito'}
                        </motion.button>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
