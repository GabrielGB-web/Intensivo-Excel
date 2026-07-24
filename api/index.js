const express = require('express');
const mercadopago = require('mercadopago');
require('dotenv').config();

// Configura o Mercado Pago
mercadopago.configure({
    access_token: process.env.MP_ACCESS_TOKEN
});

const app = express();
app.use(express.json());

// Suas rotas da API (exatamente como estavam no server.js)
app.post('/api/criar-pix', async (req, res) => {
    // ... lógica para criar o PIX
});

app.get('/api/verificar-pagamento/:id', async (req, res) => {
    // ... lógica para verificar o pagamento
});

app.post('/webhook/mercadopago', async (req, res) => {
    // ... lógica do webhook
});

// Exporte o app para a Vercel
module.exports = app;
