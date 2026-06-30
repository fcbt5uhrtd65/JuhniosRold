import express from 'express';
import { chatbotDetectIntent } from './dialogflowClient';
import { dialogflowWebhook, localRuleBasedChat } from './dialogflowWebhook';

const port = Number(process.env.CHATBOT_PORT || process.env.PORT || 8787);
const app = express();

app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'juhnios-rold-chatbot' });
});

app.post('/dialogflow/webhook', dialogflowWebhook);
app.post('/api/chatbot/message', chatbotDetectIntent);
app.post('/api/chatbot/local-message', localRuleBasedChat);

app.listen(port, () => {
  console.log(`Juhnios Rold chatbot server listening on http://localhost:${port}`);
  console.log('Dialogflow webhook: /dialogflow/webhook');
  console.log('Frontend chat endpoint: /api/chatbot/message');
});
