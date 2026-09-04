// supabaseClient.js (Usando API Backend Local com Auth)

const SESSION_KEY = 'seneca_session';
let currentSession = null;

try {
    const s = localStorage.getItem(SESSION_KEY);
    if (s) currentSession = JSON.parse(s);
} catch(e) {}

const getHeaders = () => {
    const headers = { 'Content-Type': 'application/json' };
    if (currentSession && currentSession.session && currentSession.session.access_token) {
        headers['Authorization'] = `Bearer ${currentSession.session.access_token}`;
    }
    return headers;
};

const DB = {
    isConnected: true, // App.js confia nisso

    // ==========================================
    // AUTHENTICATION
    // ==========================================
    async login(email, password) {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        if (!res.ok) throw new Error((await res.json()).error || "Erro ao entrar");
        
        const data = await res.json();
        currentSession = data;
        localStorage.setItem(SESSION_KEY, JSON.stringify(data));
        return data;
    },

    async register(email, password, name) {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name })
        });
        if (!res.ok) throw new Error((await res.json()).error || "Erro ao cadastrar");
        
        const data = await res.json();
        currentSession = data;
        localStorage.setItem(SESSION_KEY, JSON.stringify(data));
        return data;
    },

    logout() {
        currentSession = null;
        localStorage.removeItem(SESSION_KEY);
    },

    getSession() {
        return currentSession;
    },

    // ==========================================
    // TRANSACTIONS
    // ==========================================
    async getTransactions() {
        try {
            const res = await fetch('/api/transactions', { headers: getHeaders() });
            if (!res.ok) throw new Error(await res.text());
            return await res.json();
        } catch (err) {
            console.error("Erro ao buscar transações:", err);
            return [];
        }
    },

    async addTransaction(transaction) {
        const res = await fetch('/api/transactions', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(transaction)
        });
        if (!res.ok) throw new Error(await res.text());
        return await res.json();
    },

    async importTransactions(transactions) {
        const res = await fetch('/api/transactions/bulk', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(transactions)
        });
        if (!res.ok) throw new Error(await res.text());
        return await res.json();
    },

    async updateTransaction(id, updates) {
        const res = await fetch(`/api/transactions/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error(await res.text());
        return await res.json();
    },

    async deleteTransaction(id) {
        const res = await fetch(`/api/transactions/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error(await res.text());
        return true;
    }
};
