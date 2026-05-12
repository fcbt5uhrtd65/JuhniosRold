import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowRight } from 'lucide-react';
import { useCart } from '../contexts/CartContext';

interface Question {
  id: number;
  question: string;
  options: { value: string; label: string }[];
}

export function DiagnosticoCapilar() {
  const { addItem } = useCart();
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
      setTimeout(() => {
        setCurrentQuestion(currentQuestion + 1);
      }, 300);
    } else {
      setTimeout(() => {
        setShowResults(true);
      }, 300);
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

  const handleAddAllToCart = () => {
    const recommendation = getRecommendation();
    recommendation.products.forEach(product => {
      addItem({
        id: product.id,
        name: product.name,
        category: 'Aceites Capilares',
        size: product.size,
        price: product.price,
        image: product.image,
      });
    });
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

  return (
    <>
      {/* CTA Section */}
      <section className="py-20 bg-background">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="mb-3">
              <span className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
                Diagnóstico Personalizado
              </span>
            </div>

            <h2 className="text-4xl sm:text-5xl md:text-6xl mb-6 leading-tight">
              Descubre qué necesita<br />tu cabello
            </h2>

            <p className="text-muted-foreground mb-12 max-w-xl mx-auto">
              Tres preguntas. Una recomendación profesional.<br />
              Concentraciones clínicamente efectivas.
            </p>

            <motion.button
              onClick={() => setIsModalOpen(true)}
              whileHover={{ opacity: 0.8 }}
              className="inline-flex items-center gap-2 px-8 py-4 bg-foreground text-background text-sm tracking-wide"
            >
              Comenzar diagnóstico
              <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-background/95 z-50 flex items-center justify-center p-4"
            onClick={() => {
              setIsModalOpen(false);
              resetQuiz();
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-background border border-border max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  resetQuiz();
                }}
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
                      {/* Progress */}
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
                            className="h-full bg-foreground"
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
                          <h3 className="text-4xl mb-12 leading-tight">
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
                                className={`w-full text-left py-4 px-6 border transition-all ${
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
                      {/* Left: Image */}
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2, duration: 0.4 }}
                        className="relative aspect-[16/10] sm:aspect-[3/4] md:aspect-[3/4] bg-secondary"
                      >
                        <img
                          src={getRecommendation().image}
                          alt={getRecommendation().title}
                          className="w-full h-full object-cover"
                        />
                      </motion.div>

                      {/* Right: Content */}
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
                          whileHover={{ opacity: 0.8 }}
                          className={`w-full py-4 text-sm tracking-wide transition-all ${
                            addedToCart
                              ? 'bg-foreground/50 text-background'
                              : 'bg-foreground text-background'
                          }`}
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