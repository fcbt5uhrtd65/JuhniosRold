import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';

interface Transformation {
  name: string;
  before: string;
  after: string;
  story: string;
}

export function Transformaciones() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [sliderPosition, setSliderPosition] = useState(50);

  const transformations: Transformation[] = [
    {
      name: "María",
      before: "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=600",
      after: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600",
      story: "De cabello maltratado a radiante en 30 días"
    },
    {
      name: "Andrea",
      before: "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=600",
      after: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=600",
      story: "Recuperé el volumen que perdí"
    },
    {
      name: "Carolina",
      before: "https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=600",
      after: "https://images.unsplash.com/photo-1524502397800-2eeaad7c3fe5?w=600",
      story: "Mi cabello nunca brilló tanto"
    }
  ];

  const currentTransformation = transformations[selectedIndex];

  const handleSliderMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    setSliderPosition(Math.max(0, Math.min(100, percentage)));
  };

  return (
    <section id="transformaciones" className="py-32 bg-gradient-to-b from-background to-secondary">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <h2 className="text-5xl md:text-7xl mb-6">
            Transformaciones <span className="text-gold">reales</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Miles de mujeres ya transformaron su cabello. Tu cambio empieza hoy.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div
              className="relative aspect-[3/4] rounded-3xl overflow-hidden cursor-ew-resize border-2 border-gold/30"
              onMouseMove={handleSliderMove}
            >
              <div className="absolute inset-0">
                <img
                  src={currentTransformation.after}
                  alt="Después"
                  className="w-full h-full object-cover"
                />
              </div>

              <div
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
              >
                <img
                  src={currentTransformation.before}
                  alt="Antes"
                  className="w-full h-full object-cover"
                />
              </div>

              <div
                className="absolute top-0 bottom-0 w-1 bg-gold cursor-ew-resize"
                style={{ left: `${sliderPosition}%` }}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-gold rounded-full flex items-center justify-center shadow-lg shadow-gold/50">
                  <div className="flex gap-1">
                    <div className="w-0.5 h-4 bg-background"></div>
                    <div className="w-0.5 h-4 bg-background"></div>
                  </div>
                </div>
              </div>

              <div className="absolute top-4 left-4 px-4 py-2 bg-background/80 backdrop-blur-sm rounded-full text-sm">
                Antes
              </div>
              <div className="absolute top-4 right-4 px-4 py-2 bg-gold/80 backdrop-blur-sm rounded-full text-sm text-background">
                Después
              </div>
            </div>

            <div className="mt-8 text-center">
              <h3 className="text-2xl mb-2">{currentTransformation.name}</h3>
              <p className="text-muted-foreground">{currentTransformation.story}</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            {transformations.map((transformation, index) => (
              <motion.div
                key={index}
                whileHover={{ scale: 1.02 }}
                onClick={() => setSelectedIndex(index)}
                className={`p-6 rounded-2xl cursor-pointer transition-all ${
                  selectedIndex === index
                    ? 'bg-gold/10 border-2 border-gold'
                    : 'bg-muted/50 border-2 border-transparent hover:border-gold/50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex gap-2">
                    <img
                      src={transformation.before}
                      alt="Antes"
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                    <img
                      src={transformation.after}
                      alt="Después"
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <h4 className="mb-1">{transformation.name}</h4>
                    <p className="text-sm text-muted-foreground">{transformation.story}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gold" />
                </div>
              </motion.div>
            ))}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 bg-gradient-to-r from-gold to-gold-light text-background rounded-xl hover:shadow-xl hover:shadow-gold/50 transition-all"
            >
              Ver más transformaciones
            </motion.button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
