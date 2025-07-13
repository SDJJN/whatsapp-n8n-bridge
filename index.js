const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const express = require('express');

// Environment variables
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
const PORT = process.env.PORT || 3000;

if (!N8N_WEBHOOK_URL) {
    console.error("FATAL: N8N_WEBHOOK_URL environment variable is not set.");
    process.exit(1);
}

// 1. Set up Express for health checks
const app = express();
app.get('/health', (req, res) => {
    // Check if the client is ready
    const status = client.info ? 200 : 503;
    const message = status === 200 ? 'WhatsApp client is ready.' : 'WhatsApp client is not ready.';
    res.status(status).json({ status: message });
});

app.listen(PORT, () => console.log(`Health check server running on port ${PORT}`));


// 2. Configure the WhatsApp Client
const client = new Client({
    // IMPORTANT: Save session to a persistent directory
    // On Railway, this will be a mounted Volume. On Render, a Persistent Disk.
    // The path '/data/session' assumes you mount your volume/disk to '/data'
    authStrategy: new LocalAuth({ dataPath: '/data/session' }),
    puppeteer: {
        headless: true,
        // IMPORTANT: Arguments required for running in a container
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // <- this one doesn't works in Windows
            '--disable-gpu'
        ],
    }
});

// 3. Handle QR code generation for the first login
client.on('qr', qr => {
    console.log("QR Code received, please scan:");
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('WhatsApp client is ready!');
});

// 4. Forward incoming messages to your n8n webhook
client.on('message', async (message) => {
    console.log(`Received message from ${message.from}: ${message.body}`);
    try {
        await axios.post(N8N_WEBHOOK_URL, message);
        console.log(`Successfully forwarded message to n8n.`);
    } catch (error) {
        console.error('Error forwarding message to n8n:', error.message);
    }
});

client.initialize();
