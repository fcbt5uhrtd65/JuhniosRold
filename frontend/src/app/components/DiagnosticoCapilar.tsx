import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowRight, FlaskConical, Leaf, Heart, MapPin, Sparkles, Droplet, Wind } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useToast } from '../contexts/ToastContext';
import { getProducts, type Product, type ProductVariant } from '../services/products.service';

const OLIVE = '#2D3A1F';
const CREAM = '#FFFFFF';

interface Question {
  id: number;
  question: string;
  options: { value: string; label: string; description: string; icon: typeof Leaf }[];
}

interface RecommendedProduct {
  product: Product;
  variant: ProductVariant;
}

interface Recommendation {
  title: string;
  subtitle: string;
  benefit: string;
  description: string;
  image: string;
  products: RecommendedProduct[];
}

/**
 * Perfil de resultado por combinación de respuestas (tipo de cabello + preocupación).
 * Las "keywords" se buscan contra nombre/descripción reales del catálogo (mismo
 * vocabulario que usa el chatbot en backend/apps/chatbot/application/services.py)
 * en vez de depender de nombres de producto fijos que podrían no existir.
 */
const RECOMMENDATION_PROFILES: Record<string, {
  title: string;
  subtitle: string;
  benefit: string;
  description: string;
  fallbackImage: string;
  keywords: string[];
}> = {
  reparacion: {
    title: 'Reparación Profunda',
    subtitle: 'Reconstrucción Profunda',
    benefit: 'Repara. Sella. Ilumina.',
    description: 'Fórmulas que penetran la fibra capilar para reparar el daño desde el interior y restaurar la fuerza perdida por tratamientos químicos o caída.',
    fallbackImage: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=1200&q=80',
    keywords: ['keratina', 'romero', 'caida', 'maltratado', 'reparacion'],
  },
  brillo: {
    title: 'Control y Brillo',
    subtitle: 'Nutrición y Luminosidad',
    benefit: 'Nutre. Controla. Brilla.',
    description: 'Ingredientes que suavizan la cutícula, controlan el frizz y aportan brillo natural duradero.',
    fallbackImage: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=1200&q=80',
    keywords: ['argan', 'brillo', 'frizz', 'aguacate', 'suavidad'],
  },
  estimulacion: {
    title: 'Estimulación Natural',
    subtitle: 'Fortalecimiento desde la raíz',
    benefit: 'Estimula. Fortalece. Protege.',
    description: 'Extractos naturales que activan la circulación del cuero cabelludo para reducir la caída y fortalecer desde la raíz.',
    fallbackImage: 'https://images.unsplash.com/photo-1596401885239-34d567b41b5e?w=1200&q=80',
    keywords: ['romero', 'cebolla', 'caida', 'fortalecer'],
  },
};

function pickProfile(hairType: string, concern: string): keyof typeof RECOMMENDATION_PROFILES {
  if (concern === 'caida' || hairType === 'seco') return 'reparacion';
  if (concern === 'frizz' || concern === 'brillo') return 'brillo';
  return 'estimulacion';
}

async function buildRecommendation(hairType: string, concern: string): Promise<Recommendation> {
  const profileKey = pickProfile(hairType, concern);
  const profile = RECOMMENDATION_PROFILES[profileKey];

  const seen = new Set<string>();
  const products: RecommendedProduct[] = [];

  for (const keyword of profile.keywords) {
    if (products.length >= 3) break;
    const result = await getProducts({ search: keyword, active: true, limit: 5 });
    for (const product of result.data) {
      if (products.length >= 3 || seen.has(product.id)) continue;
      const variant = product.variants.find(v => v.is_active);
      if (!variant) continue;
      seen.add(product.id);
      products.push({ product, variant });
    }
  }

  if (products.length === 0) {
    const featured = await getProducts({ featured: true, active: true, limit: 3 });
    for (const product of featured.data) {
      const variant = product.variants.find(v => v.is_active);
      if (!variant || seen.has(product.id)) continue;
      seen.add(product.id);
      products.push({ product, variant });
    }
  }

  const heroImage = products[0]?.product.primary_image ?? profile.fallbackImage;

  return {
    title: profile.title,
    subtitle: profile.subtitle,
    benefit: profile.benefit,
    description: profile.description,
    image: heroImage,
    products,
  };
}

export function DiagnosticoCapilar() {
  const { addItem } = useCart();
  const toast = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [isLoadingResult, setIsLoadingResult] = useState(false);

  const questions: Question[] = [
    {
      id: 0,
      question: "¿Cómo describes tu cabello?",
      options: [
        { value: "seco", label: "Seco y maltratado", description: "Opaco, áspero y con tendencia al quiebre.", icon: Wind },
        { value: "graso", label: "Graso en raíz", description: "Raíz grasa y puntas normales o secas.", icon: Droplet },
        { value: "normal", label: "Normal y balanceado", description: "Brillante, suave y sin exceso de grasa.", icon: Sparkles },
        { value: "mixto", label: "Mixto", description: "Raíz grasa y puntas secas o maltratadas.", icon: Heart }
      ]
    },
    {
      id: 1,
      question: "¿Cuál es tu mayor preocupación?",
      options: [
        { value: "caida", label: "Caída del cabello", description: "Buscas fortalecer desde la raíz y reducir el quiebre.", icon: Leaf },
        { value: "frizz", label: "Frizz incontrolable", description: "Necesitas suavidad, control y mejor sellado.", icon: Wind },
        { value: "brillo", label: "Falta de brillo", description: "Quieres recuperar luminosidad y tacto sedoso.", icon: Sparkles },
        { value: "volumen", label: "Sin volumen", description: "Sientes el cabello pesado, plano o sin movimiento.", icon: Droplet }
      ]
    },
    {
      id: 2,
      question: "¿Con qué frecuencia lavas tu cabello?",
      options: [
        { value: "diario", label: "Diario", description: "Tu rutina necesita ligereza y protección diaria.", icon: Droplet },
        { value: "interdiario", label: "Interdiario", description: "Buscas equilibrio entre limpieza y nutrición.", icon: Sparkles },
        { value: "2-3veces", label: "2-3 veces/semana", description: "Prefieres tratamientos que mantengan efecto varios días.", icon: Leaf },
        { value: "semanal", label: "1 vez/semana", description: "Tu cabello necesita nutrición profunda y duradera.", icon: Heart }
      ]
    }
  ];

  const handleAnswer = (value: string) => {
    setAnswers({ ...answers, [currentQuestion]: value });
  };

  const handleNextQuestion = async () => {
    if (!answers[currentQuestion]) return;
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      return;
    }
    setIsLoadingResult(true);
    try {
      const result = await buildRecommendation(answers[0], answers[1]);
      setRecommendation(result);
      setShowResults(true);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'No fue posible calcular tu recomendación. Intenta de nuevo.',
      );
    } finally {
      setIsLoadingResult(false);
    }
  };

  const handleAddAllToCart = async () => {
    if (!recommendation || recommendation.products.length === 0) return;
    try {
      for (const { product, variant } of recommendation.products) {
        const added = await addItem({
          variantId: variant.id,
          name: product.name,
          category: product.category_name,
          size: variant.presentation,
          price: variant.current_price ?? product.price ?? 0,
          image: product.primary_image ?? variant.image_url ?? product.image_url,
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
    setRecommendation(null);
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
      <section className="py-16 overflow-hidden bg-white">
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

              {/* Chip flotante: 3 pasos del diagnóstico */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="absolute bottom-5 left-5 right-5 sm:right-auto sm:w-64 bg-white/95 backdrop-blur-sm rounded-2xl px-5 py-4 shadow-lg"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-3.5 h-3.5" style={{ color: OLIVE }} strokeWidth={1.5} />
                  <span className="text-[9px] tracking-[0.22em] uppercase text-stone-500 font-medium">
                    Tu ruta capilar
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {[
                    { icon: Droplet, label: 'Tipo' },
                    { icon: Wind, label: 'Reto' },
                    { icon: FlaskConical, label: 'Fórmula' },
                  ].map((step, i) => (
                    <div key={step.label} className="flex items-center gap-3">
                      <div className="flex flex-col items-center gap-1.5">
                        <motion.div
                          initial={{ scale: 0.6, opacity: 0 }}
                          whileInView={{ scale: 1, opacity: 1 }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.5 + i * 0.15, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: `${OLIVE}12` }}
                        >
                          <step.icon className="w-3.5 h-3.5" style={{ color: OLIVE }} strokeWidth={1.5} />
                        </motion.div>
                        <span className="text-[8px] tracking-wide uppercase text-stone-400">{step.label}</span>
                      </div>
                      {i < 2 && <div className="w-3 h-px bg-stone-200 -mt-4" />}
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Derecha: contenido */}
            <div className="flex flex-col justify-center px-8 py-10 md:px-12 md:py-14 md:pl-6">
              {/* Eyebrow */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-5 h-px bg-stone-400" />
                <span className="text-[9px] tracking-[0.38em] uppercase text-stone-500 font-medium">
                  Diagnóstico personalizado · 60 segundos
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#F4F1EA]/95 p-4"
            onClick={() => { setIsModalOpen(false); resetQuiz(); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              onClick={e => e.stopPropagation()}
              className="relative flex max-h-[92vh] w-full max-w-[980px] flex-col overflow-hidden rounded-[2rem] border border-stone-200/70 bg-[#FBFAF7] shadow-[0_30px_120px_rgba(45,58,31,0.18)]"
            >
              {/* Cerrar */}
              <button
                onClick={() => { setIsModalOpen(false); resetQuiz(); }}
                className="absolute right-6 top-6 z-20 p-2 text-[#5A673F] transition-opacity hover:opacity-50"
              >
                <X className="w-5 h-5" strokeWidth={1} />
              </button>

              <div className={!showResults ? 'overflow-y-auto' : 'overflow-y-auto p-5 sm:p-8 md:p-12'}>
                <AnimatePresence mode="wait">
                  {!showResults ? (
                    <motion.div
                      key="quiz"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex min-h-[680px] flex-col"
                    >
                      <div className="flex items-center justify-between border-b border-stone-200/70 px-8 py-6 sm:px-10">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-stone-200 bg-white text-[#667246] shadow-sm">
                            <Leaf className="h-5 w-5" strokeWidth={1.5} />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5A673F]">Diagnóstico capilar</p>
                            <p className="mt-1 text-sm text-stone-500">Conócenos para recomendarte lo mejor</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 px-8 py-8 sm:px-10">
                        <div className="mb-8">
                          <div className="mb-3 flex justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5A673F]">
                            <span>Pregunta {currentQuestion + 1} de {questions.length}</span>
                            <span>{Math.round(progress)}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-stone-200/80">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${progress}%` }}
                              transition={{ duration: 0.35, ease: 'easeOut' }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: '#667246' }}
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
                            <h3
                              className="mb-2 text-3xl font-light leading-tight text-stone-950 sm:text-4xl md:text-[2.65rem]"
                              style={{ fontFamily: "'Playfair Display', serif" }}
                            >
                              {questions[currentQuestion].question}
                            </h3>
                            <p className="mb-7 text-sm text-stone-500">Selecciona la opción que mejor se adapte a ti.</p>

                            <div className="space-y-3">
                              {questions[currentQuestion].options.map((option, idx) => {
                                const OptionIcon = option.icon;
                                const selected = answers[currentQuestion] === option.value;

                                return (
                                  <motion.button
                                    key={option.value}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05, duration: 0.2 }}
                                    onClick={() => handleAnswer(option.value)}
                                    className={`flex w-full items-center gap-5 rounded-2xl border bg-white px-5 py-4 text-left shadow-sm transition-all ${
                                      selected
                                        ? 'border-[#667246] ring-2 ring-[#667246]/15'
                                        : 'border-stone-200 hover:border-[#667246]/60 hover:shadow-md'
                                    }`}
                                  >
                                    <span className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full ${selected ? 'bg-[#EEF3DF] text-[#4D5E2E]' : 'bg-[#F4F1EA] text-[#7D7A61]'}`}>
                                      <OptionIcon className="h-6 w-6" strokeWidth={1.4} />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className="block text-base font-semibold text-stone-950">{option.label}</span>
                                      <span className="mt-1 block text-sm leading-relaxed text-stone-500">{option.description}</span>
                                    </span>
                                    <ArrowRight className="h-5 w-5 flex-shrink-0 text-stone-700" strokeWidth={1.5} />
                                  </motion.button>
                                );
                              })}
                            </div>
                          </motion.div>
                        </AnimatePresence>
                      </div>

                      <div className="flex items-center justify-between gap-4 border-t border-stone-200/70 bg-white/70 px-8 py-5 backdrop-blur sm:px-10">
                        <div className="flex items-center gap-3 text-sm text-stone-500">
                          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-[#667246]">
                            <Leaf className="h-4 w-4" strokeWidth={1.5} />
                          </span>
                          <span>Responde 3 preguntas y recibe tu recomendación personalizada</span>
                        </div>
                        <motion.button
                          whileHover={answers[currentQuestion] && !isLoadingResult ? { scale: 1.02 } : undefined}
                          whileTap={answers[currentQuestion] && !isLoadingResult ? { scale: 0.98 } : undefined}
                          onClick={() => void handleNextQuestion()}
                          disabled={!answers[currentQuestion] || isLoadingResult}
                          className="flex min-w-[170px] items-center justify-center gap-3 rounded-full px-7 py-4 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40"
                          style={{ backgroundColor: OLIVE }}
                        >
                          {isLoadingResult
                            ? 'Buscando...'
                            : currentQuestion === questions.length - 1 ? 'Ver resultado' : 'Siguiente'}
                          <ArrowRight className="h-4 w-4" strokeWidth={1.7} />
                        </motion.button>
                      </div>
                    </motion.div>
                  ) : recommendation ? (
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
                          src={recommendation.image}
                          alt={recommendation.title}
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
                            {recommendation.subtitle}
                          </span>
                        </div>

                        <h3 className="text-4xl md:text-5xl mb-6 leading-tight font-serif">
                          {recommendation.title}
                        </h3>

                        <p className="text-lg mb-8 italic font-light">
                          {recommendation.benefit}
                        </p>

                        <p className="text-sm text-muted-foreground leading-relaxed mb-8">
                          {recommendation.description}
                        </p>

                        {recommendation.products.length > 0 && (
                          <ul className="mb-8 space-y-2.5">
                            {recommendation.products.map(({ product, variant }) => (
                              <li key={product.id} className="flex items-center justify-between gap-3 text-sm text-stone-700">
                                <span className="flex items-center gap-2.5 min-w-0">
                                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: OLIVE }} />
                                  <span className="truncate">{product.name} · {variant.presentation}</span>
                                </span>
                                <span className="font-semibold text-stone-900 flex-shrink-0">
                                  ${(variant.current_price ?? product.price ?? 0).toLocaleString('es-CO')}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}

                        <motion.button
                          onClick={() => void handleAddAllToCart()}
                          disabled={addedToCart || recommendation.products.length === 0}
                          whileHover={{ opacity: 0.85 }}
                          className="w-full py-4 text-sm tracking-wide transition-all text-white rounded-full disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{ backgroundColor: addedToCart ? `${OLIVE}80` : OLIVE }}
                        >
                          {addedToCart
                            ? 'Agregado al carrito'
                            : recommendation.products.length === 0
                              ? 'Sin productos disponibles'
                              : 'Agregar al carrito'}
                        </motion.button>
                      </motion.div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="results-empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex min-h-[400px] items-center justify-center text-sm text-stone-400"
                    >
                      No fue posible calcular tu recomendación.
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
