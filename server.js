require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;

// Supabase Client Admin (Service Role)
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SECRET_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseKey);

// Supabase Client Auth (Anon Key) - usado para login/cadastro via auth api
const supabaseAnonKey = process.env.SUPABASE_PUBLISHABLE_KEY || 'placeholder';
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

// Middlewares
app.use(cors());
app.use(express.json());

// Verifica se as variáveis de ambiente foram configuradas
app.use((req, res, next) => {
    if (supabaseUrl === 'https://placeholder.supabase.co') {
        return res.status(500).json({ 
            error: 'Servidor mal configurado: As chaves do Supabase não foram encontradas nas variáveis de ambiente do Vercel.' 
        });
    }
    next();
});

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, 'public')));

// Middleware de Autenticação
const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token não fornecido ou inválido' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Valida o token com Supabase
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error || !data.user) {
        return res.status(401).json({ error: 'Não autorizado' });
    }
    
    req.user = data.user;
    next();
};

// ------------------------------------
// ROTAS DE AUTENTICAÇÃO
// ------------------------------------

app.post('/api/auth/register', async (req, res) => {
    const { email, password, name } = req.body;
    const { data, error } = await supabaseAnon.auth.signUp({ 
        email, 
        password,
        options: { data: { name } }
    });
    
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ session: data.session, user: data.user });
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
    
    if (error) return res.status(401).json({ error: error.message });
    return res.json({ session: data.session, user: data.user });
});

// ------------------------------------
// ROTAS DE TRANSAÇÕES
// ------------------------------------

app.get('/api/transactions', authenticate, async (req, res) => {
    const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', req.user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
        
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
});

app.post('/api/transactions', authenticate, async (req, res) => {
    const transaction = req.body;
    
    if (!transaction.id) transaction.id = crypto.randomUUID();
    if (!transaction.created_at) transaction.created_at = new Date().toISOString();
    
    transaction.user_id = req.user.id;

    const { data, error } = await supabase
        .from('transactions')
        .insert([transaction])
        .select();
        
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data[0]);
});

app.post('/api/transactions/bulk', authenticate, async (req, res) => {
    const transactions = req.body;
    if (!Array.isArray(transactions)) return res.status(400).json({ error: 'Body deve ser um array' });

    const toInsert = transactions.map(t => {
        return {
            ...t,
            id: t.id || crypto.randomUUID(),
            created_at: t.created_at || new Date().toISOString(),
            user_id: req.user.id
        };
    });

    const { data, error } = await supabase
        .from('transactions')
        .insert(toInsert)
        .select();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
});

app.put('/api/transactions/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    
    const { data, error } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', id)
        .eq('user_id', req.user.id)
        .select();
        
    if (error) return res.status(500).json({ error: error.message });
    if (!data || data.length === 0) return res.status(404).json({ error: 'Transação não encontrada ou sem permissão' });
    return res.json(data[0]);
});

app.delete('/api/transactions/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    
    const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', req.user.id);
        
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).send();
});

// Exporta o app para o Vercel
module.exports = app;

// Inicia o servidor localmente (apenas se rodar via 'node server.js')
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Servidor rodando em http://localhost:${port}`);
    });
}
