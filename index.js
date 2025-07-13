const express = require("express");
const { join } = require("path");
const { existsSync, mkdirSync } = require("fs");
const makeWASocket = require("@whiskeysockets/baileys").default;
const { useSingleFileAuthState } = require("@whiskeysockets/baileys");
const pino = require("pino");

const app = express();
app.use(express.json());

const sessionDir = "./auth";
if (!existsSync(sessionDir)) mkdirSync(sessionDir);
const { state, saveState } = useSingleFileAuthState(join(sessionDir, "session.json"));

const sock = makeWASocket({
  printQRInTerminal: true,
  auth: state,
  logger: pino({ level: "silent" }),
});

sock.ev.on("creds.update", saveState);

sock.ev.on("messages.upsert", async (msg) => {
  const m = msg.messages?.[0];
  if (!m?.message || m.key.fromMe) return;

  const from = m.key.remoteJid;
  const text =
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    m.message?.imageMessage?.caption;

  if (text) {
    console.log("📨 Received from", from, ":", text);
    await sock.sendMessage(from, { text: "✅ Reply from bot: " + text });
  }
});

app.post("/send", async (req, res) => {
  const { number, message } = req.body;
  if (!number || !message) return res.status(400).json({ error: "Missing number or message" });

  const jid = number.includes("@s.whatsapp.net") ? number : number + "@s.whatsapp.net";

  try {
    await sock.sendMessage(jid, { text: message });
    res.json({ success: true, to: number });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (_, res) => res.send("✅ WhatsApp bridge is running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌍 Server running on port ${PORT}`);
});
