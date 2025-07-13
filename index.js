import makeWASocket from '@whiskeysockets/baileys';
import { useSingleFileAuthState } from '@whiskeysockets/baileys';
import express from 'express';
import axios from 'axios';

const { state, saveState } = useSingleFileAuthState('./auth.json');
const app = express();
const PORT = 3000;

app.use(express.json());

async function startBot() {
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on('creds.update', saveState);

  // ✅ Receive message and forward to n8n
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

    // 👉 Send message to n8n webhook
    await axios.post('https://your-n8n-domain/webhook/whatsapp', {
      sender: sender,
      message: text
    });
  });

  // ✅ Receive reply from n8n and send it
  app.post('/send', async (req, res) => {
    const { number, message } = req.body;
    try {
      await sock.sendMessage(`${number}@s.whatsapp.net`, { text: message });
      res.send('Message sent!');
    } catch (err) {
      console.error(err);
      res.status(500).send('Failed');
    }
  });

  app.get('/', (req, res) => res.send('WhatsApp bridge is running.'));
  app.listen(PORT, () => console.log(`HTTP Server on http://localhost:${PORT}`));
}

startBot();