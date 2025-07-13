const express = require("express");
const axios = require("axios");
const { default: makeWASocket, useSingleFileAuthState } = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const { default: P } = require("pino");
const { join } = require("path");
const { existsSync, mkdirSync } = require("fs");

const app = express();
app.use(express.json());

// Auth session file
const sessionDir = "./auth";
if (!existsSync(sessionDir)) mkdirSync(sessionDir);
const { state, saveState } = useSingleFileAuthState(join(sessionDir, "session.json"));

const sock = makeWASocket({
  printQRInTerminal: true,
  auth: state,
  logger: P({ level: "silent" })
});

sock.ev.on("creds.update", saveState);

sock.ev.on("messages.upsert", async (msg) => {
  const m = msg.messages?.[0];
  if (!m?.message || m.key.fromMe) return;

  const from = m.key.remoteJid;
  const text = m.message?.conversation || m.message?.extendedTextMessage?.text;

  if (text) {
    console.log("📨 Received:", text);

    // Forward to your n8n webhook if needed
    // await axios.post("https://your-n8n-webhook-url", { from, text });

    await sock.sendMessage(from, { text: "✅ Received: " + text });
  }
});

// API to send message
app.post("/send", async (req, res) => {
  const { number, message } = req.body;
  const jid = number.includes("@s.whatsapp.net") ? number : number + "@s.whatsapp.net";
  try {
    await sock.sendMessage(jid, { text: message });
    res.json({ success: true });
  } catch (err) {
    console.error("Send error:", err);
    res.status(500).json({ success: false });
  }
});

app.get("/", (_, res) => {
  res.send("✅ WhatsApp bridge is live");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🌐 Server running on port", PORT));
