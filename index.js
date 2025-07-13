const express = require("express");
const axios = require("axios");
const baileys = require("@whiskeysockets/baileys");
const makeWASocket = baileys.default;
const useSingleFileAuthState = baileys.useSingleFileAuthState;
const { default: P } = require("pino");
const { join } = require("path");
const { existsSync, mkdirSync } = require("fs");

const app = express();
app.use(express.json());

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
    console.log("📩", from, ":", text);
    await sock.sendMessage(from, { text: "✅ Received: " + text });
  }
});

app.post("/send", async (req, res) => {
  const { number, message } = req.body;
  const jid = number.includes("@s.whatsapp.net") ? number : number + "@s.whatsapp.net";

  try {
    await sock.sendMessage(jid, { text: message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (_, res) => res.send("✅ WhatsApp Bridge is running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🌐 Server on port", PORT));
