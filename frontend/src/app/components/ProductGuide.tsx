import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export function ProductGuide() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const questions = [
    {
      id: 1,
      question: '¿Cómo es tu tipo de cabello?',
      options: ['Graso', 'Seco', 'Normal', 'Mixto']
    },
    {
      id: 2,
      question: '¿Cuál es tu principal preocupación?',
      options: ['Caída', 'Frizz', 'Falta de brillo', 'Sin volumen']
    }
  ];

  const handleAnswer = (questionId: number, answer: string) => {
    setAnswers({ ...answers, [questionId]: answer });
    if (questionId < questions.length) {
      setStep(step + 1);
    }
  };

  const getRecommendation = () => {
    return 'Aceite de Romero + Silicona de Lino';
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-xs tracking-wider uppercase border-b border-foreground pb-1 hover:opacity-50 transition-opacity"
      >
        ¿Qué producto necesito? →
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/90 z-50 flex items-center justify-center p-4"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-background p-8 max-w-2xl w-full"
            >
              {step <= questions.length ? (
                <>
                  <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-6">
                    Pregunta {step} de {questions.length}
                  </div>
                  <h3 className="text-2xl mb-8">
                    {questions[step - 1].question}
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {questions[step - 1].options.map((option) => (
                      <button
                        key={option}
                        onClick={() => handleAnswer(step, option)}
                        className="p-4 border border-border hover:border-foreground hover:bg-secondary transition-all text-left"
                      >
                        <div className="text-xs">{option}</div>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-6">
                    Tu recomendación
                  </div>
                  <h3 className="text-2xl mb-6">
                    {getRecommendation()}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-8">
                    Basado en tus respuestas, estos productos son ideales para ti.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setIsOpen(false)}
                      className="flex-1 py-3 bg-foreground text-background text-xs tracking-wider uppercase hover:opacity-90"
                    >
                      Ver productos
                    </button>
                    <button
                      onClick={() => { setStep(1); setAnswers({}); }}
                      className="px-5 py-3 border border-border text-xs tracking-wider uppercase hover:bg-secondary"
                    >
                      Reiniciar
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
