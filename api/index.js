const express = require('express');
const cors = require('cors');
const mercadopago = require('mercadopago');
require('dotenv').config();

const app = express();

// Configura o Mercado Pago
mercadopago.configure({
    access_token: process.env.MP_ACCESS_TOKEN || 'SEU_TOKEN_AQUI'
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================
// BANCO DE DADOS EM MEMÓRIA (substitua por um banco real depois)
// ============================================================
const pagamentos = new Map();

// ============================================================
// ROTAS DA API
// ============================================================

/**
 * Rota: Criar pagamento PIX
 * POST /api/criar-pix
 */
app.post('/api/criar-pix', async (req, res) => {
    try {
        const { email, valor, descricao } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'E-mail é obrigatório' });
        }

        // Cria o pagamento no Mercado Pago
        const paymentData = {
            transaction_amount: valor / 100,
            description: descricao || 'PDF Excel Intensivo',
            payment_method_id: 'pix',
            payer: {
                email: email,
                first_name: email.split('@')[0] || 'Cliente',
            },
            notification_url: `${process.env.BASE_URL || 'https://' + req.get('host')}/webhook/mercadopago`,
            metadata: {
                produto: 'excel_intensivo',
                email: email
            }
        };

        const payment = await mercadopago.payment.create(paymentData);
        
        // Salva no "banco de dados"
        pagamentos.set(payment.body.id, {
            email: email,
            status: payment.body.status,
            produto: 'excel_intensivo',
            data: new Date(),
            payment: payment.body
        });

        res.json({
            paymentId: payment.body.id,
            status: payment.body.status,
            qrCode: payment.body.point_of_interaction?.transaction_data?.qr_code_base64 || null,
            codigoCopiaCola: payment.body.point_of_interaction?.transaction_data?.qr_code || null,
            paymentLink: payment.body.init_point || null
        });

    } catch (error) {
        console.error('Erro ao criar PIX:', error);
        res.status(500).json({ 
            error: error.message || 'Erro ao criar pagamento' 
        });
    }
});

/**
 * Rota: Verificar status do pagamento
 * GET /api/verificar-pagamento/:id
 */
app.get('/api/verificar-pagamento/:id', async (req, res) => {
    try {
        const paymentId = req.params.id;
        
        if (pagamentos.has(paymentId)) {
            const localData = pagamentos.get(paymentId);
            return res.json({ 
                status: localData.status,
                email: localData.email,
                produto: localData.produto
            });
        }

        const payment = await mercadopago.payment.findById(paymentId);
        
        pagamentos.set(paymentId, {
            email: payment.body.payer.email,
            status: payment.body.status,
            produto: 'excel_intensivo',
            data: new Date(),
            payment: payment.body
        });

        res.json({
            status: payment.body.status,
            email: payment.body.payer.email
        });

    } catch (error) {
        console.error('Erro ao verificar pagamento:', error);
        res.status(500).json({ 
            error: error.message || 'Erro ao verificar pagamento' 
        });
    }
});

/**
 * Rota: Webhook do Mercado Pago
 * POST /webhook/mercadopago
 */
app.post('/webhook/mercadopago', async (req, res) => {
    try {
        const { type, data, id } = req.body;
        
        console.log('📩 Webhook recebido:', { type, id, data });

        if (type === 'payment' || (data && data.id)) {
            const paymentId = data.id || id;
            
            const payment = await mercadopago.payment.findById(paymentId);
            const status = payment.body.status;
            const email = payment.body.payer.email;

            pagamentos.set(paymentId, {
                email: email,
                status: status,
                produto: 'excel_intensivo',
                data: new Date(),
                payment: payment.body,
                webhook_recebido: true
            });

            console.log(`✅ Pagamento ${paymentId} atualizado: ${status} - ${email}`);

            if (status === 'approved') {
                console.log(`🎉 Acesso liberado para ${email} (pagamento ${paymentId})`);
            }
        }

        res.status(200).send('OK');

    } catch (error) {
        console.error('❌ Erro no webhook:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Rota: Verificar acesso por e-mail
 * GET /api/verificar-acesso/:email
 */
app.get('/api/verificar-acesso/:email', async (req, res) => {
    try {
        const email = req.params.email;
        let temAcesso = false;
        let pagamentoInfo = null;
        
        for (const [id, data] of pagamentos) {
            if (data.email === email && data.status === 'approved') {
                temAcesso = true;
                pagamentoInfo = { paymentId: id, data: data.data };
                break;
            }
        }

        res.json({ 
            email: email,
            temAcesso: temAcesso,
            pagamentoInfo: pagamentoInfo
        });

    } catch (error) {
        console.error('Erro ao verificar acesso:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Rota: Listar pagamentos (admin)
 * GET /api/pagamentos
 */
app.get('/api/pagamentos', (req, res) => {
    const lista = [];
    for (const [id, data] of pagamentos) {
        lista.push({
            paymentId: id,
            email: data.email,
            status: data.status,
            produto: data.produto,
            data: data.data
        });
    }
    res.json(lista);
});

// ============================================================
// EXPORTA O APP PARA A VERCEL
// ============================================================
module.exports = app;
