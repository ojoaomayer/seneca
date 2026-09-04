// app.js

// Estado da Aplicação
const AppState = {
    transactions: [],
    filteredTransactions: [],
    period: 'current_month', // current_month, last_month, last_3_months, year
    searchText: '',
    typeFilter: 'all',
    editingId: null,
    selectedTransactions: []
};

// Categorias
const CATEGORIES = [
    "Moradia", "Alimentação", "Transporte", "Lazer", 
    "Saúde", "Salário", "Investimentos", "Outros"
];

// Instâncias dos Gráficos
let lineChartInstance = null;
let donutChartInstance = null;

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    initUI();
    setupEventListeners();
    
    // Auth flow
    if (DB.getSession()) {
        showApp();
    } else {
        showAuth();
    }
});

function showApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-header').classList.remove('hidden');
    document.getElementById('app-main').classList.remove('hidden');
    
    // Atualiza nome do perfil
    const session = DB.getSession();
    if (session && session.user) {
        const name = session.user.user_metadata?.name || session.user.email.split('@')[0];
        document.getElementById('profile-name').textContent = `Olá, ${name}`;
    }
    
    loadData();
}

function showAuth() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app-header').classList.add('hidden');
    document.getElementById('app-main').classList.add('hidden');
}

// Setup Inicial de UI
function initUI() {
    // Popula categorias no formulário
    const catSelect = document.getElementById('tx-category');
    CATEGORIES.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        catSelect.appendChild(opt);
    });

    // Configura data padrão
    document.getElementById('tx-date').valueAsDate = new Date();

    // Define saudação baseado na hora
    const hour = new Date().getHours();
    let greeting = 'Boa noite!';
    if (hour >= 5 && hour < 12) greeting = 'Bom dia!';
    else if (hour >= 12 && hour < 18) greeting = 'Boa tarde!';
    document.getElementById('greeting').textContent = greeting;

    // Indicador de status Supabase/Local
    const statusText = document.getElementById('status-text');
    const statusIndicator = document.getElementById('status-indicator');
    if (DB.isConnected) {
        statusText.textContent = 'Conectado ao Supabase';
        statusIndicator.classList.replace('bg-yellow-500', 'bg-brand-emerald');
    } else {
        statusText.textContent = 'Modo Local (Offline)';
        statusIndicator.classList.replace('bg-yellow-500', 'bg-zinc-500');
    }
}

// Carrega os dados
async function loadData() {
    try {
        AppState.transactions = await DB.getTransactions();
        applyFilters();
    } catch (error) {
        console.error("Erro ao carregar dados", error);
        alert("Ocorreu um erro ao carregar as transações.");
    }
}

// Lógica de Filtros
function applyFilters() {
    const now = new Date();
    
    // Filtro de Data
    let startDate = new Date(0); // Padrão: tudo
    let endDate = new Date('2100-01-01');

    if (AppState.period === 'current_month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (AppState.period === 'last_month') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (AppState.period === 'last_3_months') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (AppState.period === 'year') {
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    }

    AppState.filteredTransactions = AppState.transactions.filter(t => {
        const txDate = new Date(t.date + 'T12:00:00'); // Evita timezone offset issues

        // Check date
        const matchDate = txDate >= startDate && txDate <= endDate;
        
        // Check text search
        const matchText = t.description.toLowerCase().includes(AppState.searchText) || 
                          t.category.toLowerCase().includes(AppState.searchText);
        
        // Check type
        const matchType = AppState.typeFilter === 'all' || t.type === AppState.typeFilter;

        return matchDate && matchText && matchType;
    });

    updateDashboard();
}

// Atualiza a Dashboard completa
function updateDashboard() {
    updateKPIs();
    renderTable();
    renderCharts();
}

// Utils de Formatação
const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDate = (dateString) => {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
};

// Atualiza Cartões de KPI
function updateKPIs() {
    let income = 0;
    let expense = 0;
    let pending = 0;

    AppState.filteredTransactions.forEach(t => {
        const amount = parseFloat(t.amount);
        if (t.status === 'pending') {
            pending += amount;
        } else {
            if (t.type === 'income') income += amount;
            if (t.type === 'expense') expense += amount;
        }
    });

    let balance = income - expense;

    // Aplica overrides manuais se existirem
    const session = DB.getSession();
    const meta = session?.user?.user_metadata || {};
    
    if (meta.manual_balance !== undefined && meta.manual_balance !== '') {
        balance = parseFloat(meta.manual_balance);
    }
    if (meta.manual_income !== undefined && meta.manual_income !== '') {
        income = parseFloat(meta.manual_income);
    }
    if (meta.manual_expense !== undefined && meta.manual_expense !== '') {
        expense = parseFloat(meta.manual_expense);
    }

    document.getElementById('kpi-balance').textContent = formatCurrency(balance);
    document.getElementById('kpi-income').textContent = formatCurrency(income);
    document.getElementById('kpi-expense').textContent = formatCurrency(expense);
    document.getElementById('kpi-pending').textContent = formatCurrency(pending);

    // Cor do saldo
    const balanceEl = document.getElementById('kpi-balance');
    if (balance >= 0) {
        balanceEl.classList.remove('text-brand-carmine');
        balanceEl.classList.add('text-zinc-100');
    } else {
        balanceEl.classList.remove('text-zinc-100');
        balanceEl.classList.add('text-brand-carmine');
    }
}

// Renderiza Tabela de Transações
function renderTable() {
    const tbody = document.getElementById('transactions-table-body');
    tbody.innerHTML = '';

    const selectAllCheckbox = document.getElementById('selectAll');
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.onclick = toggleSelectAll;
    }

    if (AppState.filteredTransactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-8 text-center text-zinc-500">Nenhuma transação encontrada.</td></tr>`;
        return;
    }

    AppState.filteredTransactions.forEach(t => {
        const isIncome = t.type === 'income';
        const amountColor = isIncome ? 'text-brand-emerald' : 'text-brand-carmine';
        const sign = isIncome ? '+' : '-';
        
        const statusBadge = t.status === 'paid' 
            ? `<span class="px-2.5 py-1 text-xs rounded-full bg-brand-emerald/10 text-brand-emerald font-medium border border-brand-emerald/20">Pago</span>`
            : `<span class="px-2.5 py-1 text-xs rounded-full bg-amber-500/10 text-amber-500 font-medium border border-amber-500/20">Pendente</span>`;

        const isChecked = AppState.selectedTransactions.includes(t.id);

        const tr = document.createElement('tr');
        tr.className = `smooth-transition ${isChecked ? 'bg-zinc-800/80' : 'hover:bg-zinc-800/50'}`;
        tr.innerHTML = `
            <td class="px-4 py-3">
                <input type="checkbox" value="${t.id}" class="tx-checkbox rounded border-zinc-700 bg-zinc-900 text-brand-emerald focus:ring-brand-emerald" ${isChecked ? 'checked' : ''} onchange="toggleSelection('${t.id}')">
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-zinc-300">${formatDate(t.date)}</td>
            <td class="px-4 py-3 font-medium text-zinc-200">${t.description}</td>
            <td class="px-4 py-3">
                <span class="px-2.5 py-1 text-xs rounded-lg bg-zinc-800 text-zinc-400">${t.category}</span>
            </td>
            <td class="px-4 py-3 text-zinc-400">${t.payment_method}</td>
            <td class="px-4 py-3 text-right font-semibold ${amountColor}">${sign} ${formatCurrency(t.amount).replace('R$', '').trim()}</td>
            <td class="px-4 py-3 text-center">${statusBadge}</td>
            <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-2">
                    <button onclick="editTransaction('${t.id}')" class="p-1.5 text-zinc-400 hover:text-brand-emerald hover:bg-brand-emerald/10 rounded-md transition-colors" title="Editar">
                        <i data-lucide="edit-2" class="w-4 h-4"></i>
                    </button>
                    <button onclick="deleteTransaction('${t.id}')" class="p-1.5 text-zinc-400 hover:text-brand-carmine hover:bg-brand-carmine/10 rounded-md transition-colors" title="Excluir">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    lucide.createIcons();
    updateBulkActionBar();
}

// Lógica de Gráficos (Chart.js)
function renderCharts() {
    renderLineChart();
    renderDonutChart();
}

function renderLineChart() {
    const ctx = document.getElementById('lineChart').getContext('2d');
    
    // Agrupa dados por data
    const dailyData = {};
    
    // Inicializa datas (pega do array filtrado)
    const dates = [...new Set(AppState.filteredTransactions.map(t => t.date))].sort();
    
    dates.forEach(d => {
        dailyData[d] = { income: 0, expense: 0 };
    });

    AppState.filteredTransactions.forEach(t => {
        if (t.status === 'paid') {
            if (t.type === 'income') dailyData[t.date].income += parseFloat(t.amount);
            if (t.type === 'expense') dailyData[t.date].expense += parseFloat(t.amount);
        }
    });

    const labels = dates.map(d => {
        const dt = new Date(d + 'T12:00:00');
        return `${dt.getDate()}/${dt.getMonth()+1}`;
    });
    const incomeData = dates.map(d => dailyData[d].income);
    const expenseData = dates.map(d => dailyData[d].expense);

    if (lineChartInstance) lineChartInstance.destroy();

    Chart.defaults.color = '#a1a1aa';
    Chart.defaults.font.family = 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif';

    lineChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Receitas',
                    data: incomeData,
                    borderColor: '#10b981', // emerald
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Despesas',
                    data: expenseData,
                    borderColor: '#e11d48', // carmine
                    backgroundColor: 'rgba(225, 29, 72, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    backgroundColor: '#18181b', // zinc-900
                    titleColor: '#f4f4f5',
                    bodyColor: '#a1a1aa',
                    borderColor: '#27272a',
                    borderWidth: 1,
                    padding: 12
                }
            },
            scales: {
                x: { grid: { color: '#27272a', display: false } },
                y: { grid: { color: '#27272a' } }
            }
        }
    });
}

function renderDonutChart() {
    const ctx = document.getElementById('donutChart').getContext('2d');
    
    // Agrupa despesas por categoria
    const categoryTotals = {};
    let totalExpense = 0;

    AppState.filteredTransactions.forEach(t => {
        if (t.type === 'expense' && t.status === 'paid') {
            const amount = parseFloat(t.amount);
            categoryTotals[t.category] = (categoryTotals[t.category] || 0) + amount;
            totalExpense += amount;
        }
    });

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);

    // Cores para as categorias (Paleta Dark refinada)
    const colors = [
        '#e11d48', '#f59e0b', '#3b82f6', '#8b5cf6', 
        '#ec4899', '#14b8a6', '#f97316', '#64748b'
    ];

    if (donutChartInstance) donutChartInstance.destroy();

    donutChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels.length > 0 ? labels : ['Sem despesas'],
            datasets: [{
                data: data.length > 0 ? data : [1],
                backgroundColor: data.length > 0 ? colors.slice(0, labels.length) : ['#27272a'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (data.length === 0) return ' Sem despesas';
                            const value = context.raw;
                            const percentage = ((value / totalExpense) * 100).toFixed(1);
                            return ` ${context.label}: ${formatCurrency(value)} (${percentage}%)`;
                        }
                    },
                    backgroundColor: '#18181b',
                    titleColor: '#f4f4f5',
                    bodyColor: '#a1a1aa',
                    borderColor: '#27272a',
                    borderWidth: 1,
                    padding: 12
                }
            }
        }
    });
}

// CRUD & UI Actions
function setTxType(type) {
    document.getElementById('tx-type').value = type;
    const btnExpense = document.getElementById('btn-type-expense');
    const btnIncome = document.getElementById('btn-type-income');
    
    if (type === 'expense') {
        btnExpense.className = "flex-1 py-1.5 text-sm font-medium rounded-md transition-colors bg-zinc-800 text-white shadow-sm";
        btnIncome.className = "flex-1 py-1.5 text-sm font-medium rounded-md transition-colors text-zinc-400 hover:text-white";
    } else {
        btnIncome.className = "flex-1 py-1.5 text-sm font-medium rounded-md transition-colors bg-zinc-800 text-white shadow-sm";
        btnExpense.className = "flex-1 py-1.5 text-sm font-medium rounded-md transition-colors text-zinc-400 hover:text-white";
    }
}

function closeModal() {
    document.getElementById('transaction-modal').classList.add('hidden');
    document.getElementById('transaction-form').reset();
    document.getElementById('tx-id').value = '';
    document.getElementById('modal-title').textContent = 'Nova Transação';
    setTxType('expense');
    document.getElementById('tx-date').valueAsDate = new Date();
    AppState.editingId = null;
}

// Form Submit
document.getElementById('transaction-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('tx-id').value;
    const transaction = {
        description: document.getElementById('tx-description').value,
        amount: parseFloat(document.getElementById('tx-amount').value),
        type: document.getElementById('tx-type').value,
        category: document.getElementById('tx-category').value,
        date: document.getElementById('tx-date').value,
        payment_method: document.getElementById('tx-payment').value,
        status: document.getElementById('tx-status').value
    };

    try {
        const btn = document.getElementById('btn-save-tx');
        const originalText = btn.textContent;
        btn.textContent = 'Salvando...';
        btn.disabled = true;

        if (id) {
            await DB.updateTransaction(id, transaction);
        } else {
            await DB.addTransaction(transaction);
        }
        
        await loadData();
        closeModal();
    } catch (error) {
        alert("Erro ao salvar a transação.");
    } finally {
        const btn = document.getElementById('btn-save-tx');
        btn.textContent = 'Salvar';
        btn.disabled = false;
    }
});

// Edit
window.editTransaction = (id) => {
    const tx = AppState.transactions.find(t => t.id === id);
    if (!tx) return;
    
    AppState.editingId = id;
    document.getElementById('tx-id').value = tx.id;
    document.getElementById('tx-description').value = tx.description;
    document.getElementById('tx-amount').value = tx.amount;
    document.getElementById('tx-category').value = tx.category;
    document.getElementById('tx-date').value = tx.date;
    document.getElementById('tx-payment').value = tx.payment_method;
    document.getElementById('tx-status').value = tx.status;
    
    setTxType(tx.type);
    document.getElementById('modal-title').textContent = 'Editar Transação';
    document.getElementById('transaction-modal').classList.remove('hidden');
};

// Delete
window.deleteTransaction = async (id) => {
    if (confirm("Tem certeza que deseja excluir esta transação?")) {
        try {
            await DB.deleteTransaction(id);
            await loadData();
        } catch (error) {
            alert("Erro ao excluir.");
        }
    }
};

// Listeners
function setupEventListeners() {
    document.getElementById('period-selector').addEventListener('change', (e) => {
        AppState.period = e.target.value;
        applyFilters();
    });

    document.getElementById('filter-search').addEventListener('input', (e) => {
        AppState.searchText = e.target.value.toLowerCase();
        applyFilters();
    });

    document.getElementById('filter-type').addEventListener('change', (e) => {
        AppState.typeFilter = e.target.value;
        applyFilters();
    });

    document.getElementById('btn-export').addEventListener('click', () => {
        exportCSV();
    });
}

// Exportar CSV
function exportCSV() {
    if (AppState.filteredTransactions.length === 0) {
        alert("Não há dados para exportar.");
        return;
    }

    const headers = ['Data', 'Descrição', 'Categoria', 'Método', 'Tipo', 'Status', 'Valor'];
    const rows = AppState.filteredTransactions.map(t => [
        t.date,
        `"${t.description}"`,
        t.category,
        t.payment_method,
        t.type === 'income' ? 'Receita' : 'Despesa',
        t.status === 'paid' ? 'Pago' : 'Pendente',
        t.amount
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'transacoes.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Importar CSV
document.getElementById('csv-upload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: function(h) {
            // Remove espaços, converte para minúsculo e remove BOM do Excel
            return h.trim().toLowerCase().replace(/^\uFEFF/, '');
        },
        complete: async function(results) {
            try {
                const requiredFields = ['description', 'amount', 'type', 'category', 'date', 'payment_method', 'status'];
                const data = results.data;
                
                if (data.length > 0) {
                    const keys = Object.keys(data[0]);
                    const hasAll = requiredFields.every(f => keys.includes(f));
                    if (!hasAll) {
                        alert(`O CSV não possui as colunas corretas.\n\nEncontradas:\n${keys.join(', ')}\n\nNecessárias:\n${requiredFields.join(', ')}`);
                        return;
                    }
                } else {
                    return; // arquivo vazio
                }

                const transactions = data.map(row => {
                    let parsedDate = row.date;
                    // Fix para datas no formato DD/MM/AAAA ou DD/MM/AA
                    if (parsedDate && parsedDate.includes('/')) {
                        const parts = parsedDate.split('/');
                        if (parts.length === 3) {
                            let [d, m, y] = parts;
                            if (y.length === 2) y = '20' + y;
                            parsedDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                        }
                    }

                    return {
                        description: row.description,
                        amount: parseFloat(row.amount),
                        type: row.type,
                        category: row.category,
                        date: parsedDate,
                        payment_method: row.payment_method,
                        status: row.status
                    };
                });

                await DB.importTransactions(transactions);
                await loadData();
                alert(`Importação concluída com sucesso! ${transactions.length} transações adicionadas.`);
                e.target.value = ''; // reseta o input
            } catch (err) {
                console.error(err);
                alert("Erro ao importar CSV.");
            }
        },
        error: function(error) {
            alert("Erro ao ler arquivo CSV: " + error.message);
        }
    });
});

// =====================================
// AUTENTICAÇÃO E PERFIS
// =====================================

let isLoginMode = true;

window.toggleAuthMode = () => {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').textContent = isLoginMode ? 'Entrar' : 'Criar Conta';
    document.getElementById('btn-auth-submit').textContent = isLoginMode ? 'Entrar' : 'Cadastrar';
    document.getElementById('auth-toggle-text').textContent = isLoginMode ? 'Não tem uma conta?' : 'Já tem uma conta?';
    document.getElementById('btn-auth-toggle').textContent = isLoginMode ? 'Criar conta' : 'Entrar';
    
    // Mostrar/Esconder campo de nome
    if (isLoginMode) {
        document.getElementById('auth-name-group').classList.add('hidden');
        document.getElementById('auth-name').required = false;
    } else {
        document.getElementById('auth-name-group').classList.remove('hidden');
        document.getElementById('auth-name').required = true;
    }
};

document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const name = document.getElementById('auth-name').value;
    const btn = document.getElementById('btn-auth-submit');
    const originalText = btn.textContent;
    btn.textContent = 'Aguarde...';
    btn.disabled = true;

    try {
        if (isLoginMode) {
            await DB.login(email, password);
        } else {
            await DB.register(email, password, name);
            alert("Conta criada com sucesso!");
        }
        showApp();
    } catch (err) {
        alert(err.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
});

window.logout = () => {
    DB.logout();
    showAuth();
    document.getElementById('auth-email').value = '';
    document.getElementById('auth-password').value = '';
    AppState.transactions = []; // Limpa os dados em memória
};

// =====================================
// AÇÕES EM MASSA (BULK DELETE)
// =====================================

window.toggleSelection = (id) => {
    const idx = AppState.selectedTransactions.indexOf(id);
    if (idx === -1) {
        AppState.selectedTransactions.push(id);
    } else {
        AppState.selectedTransactions.splice(idx, 1);
    }
    updateBulkActionBar();
    // Update individual row style without re-rendering everything
    renderTable(); // Re-render is safer to ensure style consistency
};

window.toggleSelectAll = (e) => {
    if (e.target.checked) {
        AppState.selectedTransactions = AppState.filteredTransactions.map(t => t.id);
    } else {
        AppState.selectedTransactions = [];
    }
    renderTable();
};

window.clearSelection = () => {
    AppState.selectedTransactions = [];
    renderTable();
};

window.updateBulkActionBar = () => {
    const bar = document.getElementById('bulk-action-bar');
    const countSpan = document.getElementById('bulk-count');
    
    if (AppState.selectedTransactions.length > 0) {
        countSpan.textContent = AppState.selectedTransactions.length;
        bar.classList.remove('translate-y-24');
    } else {
        bar.classList.add('translate-y-24');
    }
};

window.bulkDelete = async () => {
    if (!confirm(`Tem certeza que deseja apagar ${AppState.selectedTransactions.length} transações?`)) return;
    
    try {
        await DB.bulkDeleteTransactions(AppState.selectedTransactions);
        AppState.selectedTransactions = [];
        await loadData();
    } catch (err) {
        console.error(err);
        alert("Erro ao excluir transações em massa.");
    }
};

// =====================================
// EDIÇÃO MANUAL DE SALDOS (PROFILE)
// =====================================

window.openProfileModal = () => {
    const session = DB.getSession();
    const meta = session?.user?.user_metadata || {};
    
    document.getElementById('prof-balance').value = meta.manual_balance || '';
    document.getElementById('prof-income').value = meta.manual_income || '';
    document.getElementById('prof-expense').value = meta.manual_expense || '';
    
    document.getElementById('profile-modal').classList.remove('hidden');
};

window.closeProfileModal = () => {
    document.getElementById('profile-modal').classList.add('hidden');
};

document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const balance = document.getElementById('prof-balance').value;
    const income = document.getElementById('prof-income').value;
    const expense = document.getElementById('prof-expense').value;
    
    const overrides = {
        manual_balance: balance === '' ? null : balance,
        manual_income: income === '' ? null : income,
        manual_expense: expense === '' ? null : expense
    };
    
    try {
        await DB.updateProfile(overrides);
        closeProfileModal();
        updateDashboard(); // Reflete os novos valores na UI instantaneamente
    } catch (err) {
        console.error(err);
        alert("Erro ao salvar ajustes manuais.");
    }
});
