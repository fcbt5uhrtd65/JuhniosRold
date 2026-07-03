import { FormEvent, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bot, Loader2, MessageCircle, Send, Sparkles, X } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  whatsappUrl?: string;
  catalogUrl?: string;
}

interface ChatbotResponse {
  fulfillmentText?: string;
  message?: string;
  payload?: {
    whatsappUrl?: string;
    catalogUrl?: string;
  };
}

const fallbackWelcome =
  'Hola, soy el asistente de Juhnios Rold. Te ayudo con productos, envios, catalogo o asesor por WhatsApp.';

function createMessage(role: ChatMessage['role'], text: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    text,
  };
}

function getChatbotEndpoint() {
  return import.meta.env.VITE_CHATBOT_API_URL || '/api/chatbot/message/';
}

export function ChatbotLauncher() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    createMessage('assistant', fallbackWelcome),
  ]);
  const inputRef = useRef<HTMLInputElement>(null);
  const endpoint = useMemo(getChatbotEndpoint, []);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setMessages((current) => [...current, createMessage('user', text)]);
    setLoading(true);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          sessionId,
        }),
      });

      const data = (await response.json()) as ChatbotResponse;

      if (!response.ok) {
        throw new Error(data.message || 'No se pudo responder el mensaje.');
      }

      setMessages((current) => [
        ...current,
        {
          ...createMessage(
            'assistant',
            data.fulfillmentText ||
              'No tengo esa informacion exacta. Te puedo pasar con un asesor.'
          ),
          whatsappUrl: data.payload?.whatsappUrl,
          catalogUrl: data.payload?.catalogUrl,
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          ...createMessage(
            'assistant',
            'No pude conectar con el asistente en este momento. Te dejo WhatsApp para atencion directa.'
          ),
          whatsappUrl:
            'https://wa.me/573000000000?text=Hola%2C%20necesito%20ayuda%20con%20Productos%20Juhnios%20Rold',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <motion.button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          window.setTimeout(() => inputRef.current?.focus(), 120);
        }}
        className="fixed bottom-8 right-24 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#2D3A1F] text-white shadow-[0_16px_42px_rgba(45,58,31,0.28)] transition hover:bg-[#253118]"
        whileTap={{ scale: 0.96 }}
        aria-label={open ? 'Cerrar chat' : 'Abrir chat'}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.section
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-28 right-5 z-50 flex h-[560px] max-h-[calc(100vh-9rem)] w-[calc(100vw-2.5rem)] max-w-[380px] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_22px_70px_rgba(45,58,31,0.20)]"
          >
            <header className="flex items-center gap-3 border-b border-stone-100 bg-[#F7F5F1] px-4 py-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2D3A1F] text-white">
                <Bot className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-stone-950">
                  Asistente Juhnios Rold
                </span>
                <span className="flex items-center gap-1 text-[11px] text-stone-500">
                  <Sparkles className="h-3 w-3 text-[#B8873B]" />
                  Productos, envios y asesoria
                </span>
              </span>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto bg-[#FBFAF8] px-4 py-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`min-w-0 max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed break-words ${
                      message.role === 'user'
                        ? 'bg-[#2D3A1F] text-white'
                        : 'border border-stone-100 bg-white text-stone-700'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.text}</p>
                    {(message.catalogUrl || message.whatsappUrl) && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {message.catalogUrl && (
                          <a
                            href={message.catalogUrl}
                            className="rounded-full bg-[#B8873B]/10 px-3 py-1 text-[11px] font-semibold text-[#B8873B]"
                          >
                            Ver catalogo
                          </a>
                        )}
                        {message.whatsappUrl && (
                          <a
                            href={message.whatsappUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full bg-[#2D3A1F]/10 px-3 py-1 text-[11px] font-semibold text-[#2D3A1F]"
                          >
                            WhatsApp
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl border border-stone-100 bg-white px-3.5 py-2.5 text-sm text-stone-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Escribiendo...
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={sendMessage} className="flex gap-2 border-t border-stone-100 p-3">
              <input
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Escribe tu pregunta..."
                className="min-w-0 flex-1 rounded-full border border-stone-200 px-4 py-2.5 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-[#B8873B]"
              />
              <button
                type="submit"
                disabled={loading || input.trim() === ''}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#2D3A1F] text-white transition disabled:cursor-not-allowed disabled:opacity-45"
                aria-label="Enviar mensaje"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}

export default ChatbotLauncher;
