// app.js

// Estado da AplicaÃƒÂ§ÃƒÂ£o
const AppState = {
    transactions: [],
    filteredTransactions: [],
    period: 'current_month', // current_month, last_month, last_3_months, year
    searchText: '',
    typeFilter: 'all',
    editingId: null,
    selectedTransactions: [],
    investments: []
};

// Categorias
const CATEGORIES = [
    "Moradia", "AlimentaÃƒÂ§ÃƒÂ£o", "Transporte", "Lazer", 
    "SaÃƒÂºde", "SalÃƒÂ¡rio", "Investimentos", "Outros"
];

// InstÃƒÂ¢ncias dos GrÃƒÂ¡ficos
let lineChartInstance = null;
let donutChartInstance = null;

// InicializaÃƒÂ§ÃƒÂ£o
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
    switchTab('dashboard');
    
    // Atualiza nome do perfil
    const session = DB.getSession();
    if (session && session.user) {
        const name = session.user.user_metadata?.name || session.user.email.split('@')[0];
        document.getElementById('profile-name').textContent = `OlÃƒÂ¡, ${name}`;
    }
    
    loadData();
    loadInvestments();
}

function showAuth() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app-header').classList.add('hidden');
    document.getElementById('app-main').classList.add('hidden');
    document.getElementById('investments-main').classList.add('hidden');
}

window.switchTab = (tab) => {
    const mainDashboard = document.getElementById('app-main');
    const mainInvestments = document.getElementById('investments-main');
    const navDashboard = document.getElementById('nav-dashboard');
    const navInvestments = document.getElementById('nav-investments');

    if (tab === 'dashboard') {
        mainDashboard.classList.remove('hidden');
        mainInvestments.classList.add('hidden');
        navDashboard.className = "px-3 py-1.5 text-sm font-medium rounded-md bg-zinc-800 text-zinc-100 shadow-sm transition-colors";
        navInvestments.className = "px-3 py-1.5 text-sm font-medium rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors";
    } else {
        mainDashboard.classList.add('hidden');
        mainInvestments.classList.remove('hidden');
        navInvestments.className = "px-3 py-1.5 text-sm font-medium rounded-md bg-zinc-800 text-zinc-100 shadow-sm transition-colors";
        navDashboard.className = "px-3 py-1.5 text-sm font-medium rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors";
    }
}

// Custom Toasts
window.toast = {
    show: (msg, type = 'success') => {
        const container = document.getElementById('toast-container');
        const t = document.createElement('div');
        const color = type === 'success' ? 'brand-emerald' : 'brand-carmine';
        const icon = type === 'success' ? 'check-circle-2' : 'alert-circle';
        
        t.className = `flex items-center gap-3 bg-zinc-900 border border-zinc-800 text-zinc-100 px-4 py-3 rounded-xl shadow-2xl pointer-events-auto transform transition-all duration-300 translate-x-full opacity-0`;
        t.innerHTML = `<i data-lucide="${icon}" class="w-5 h-5 text-${color}"></i><span class="text-sm font-medium">${msg}</span>`;
        
        container.appendChild(t);
        lucide.createIcons();
        
        requestAnimationFrame(() => {
            t.classList.remove('translate-x-full', 'opacity-0');
        });
        
        setTimeout(() => {
            t.classList.add('translate-x-full', 'opacity-0');
            setTimeout(() => t.remove(), 300);
        }, 4000);
    },
    success: (msg) => window.toast.show(msg, 'success'),
    error: (msg) => window.toast.show(msg, 'error')
};

// Custom Confirm
window.customConfirm = (msg) => {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-confirm-modal');
        const okBtn = document.getElementById('btn-confirm-ok');
        const cancelBtn = document.getElementById('btn-confirm-cancel');
        
        document.getElementById('custom-confirm-message').textContent = msg;
        modal.classList.remove('hidden');
        
        const cleanup = () => {
            modal.classList.add('hidden');
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
        };
        
        const onOk = () => { cleanup(); resolve(true); };
        const onCancel = () => { cleanup(); resolve(false); };
        
        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
    });
};

// Setup Inicial de UI
function initUI() {
    // Popula categorias no formulÃƒÂ¡rio
    const catSelect = document.getElementById('tx-category');
    CATEGORIES.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        catSelect.appendChild(opt);
    });

    // Configura data padrÃƒÂ£o
    document.getElementById('tx-date').valueAsDate = new Date();

    // Define saudaÃƒÂ§ÃƒÂ£o baseado na hora
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
        alert("Ocorreu um erro ao carregar as transaÃƒÂ§ÃƒÂµes.");
    }
}

// LÃƒÂ³gica de Filtros
function applyFilters() {
    const now = new Date();
    
    // Filtro de Data
    let startDate = new Date(0); // PadrÃƒÂ£o: tudo
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

// Utils de FormataÃƒÂ§ÃƒÂ£o
const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDate = (dateString) => {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
};

// Atualiza CartÃƒÂµes de KPI
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

// Renderiza Tabela de TransaÃƒÂ§ÃƒÂµes
function renderTable() {
    const tbody = document.getElementById('transactions-table-body');
    tbody.innerHTML = '';

    const selectAllCheckbox = document.getElementById('selectAll');
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.onclick = toggleSelectAll;
    }

    if (AppState.filteredTransactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-8 text-center text-zinc-500">Nenhuma transaÃƒÂ§ÃƒÂ£o encontrada.</td></tr>`;
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

// LÃƒÂ³gica de GrÃƒÂ¡ficos (Chart.js)
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
    document.getElementById('modal-title').textContent = 'Nova TransaÃƒÂ§ÃƒÂ£o';
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
        alert("Erro ao salvar a transaÃƒÂ§ÃƒÂ£o.");
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
    document.getElementById('modal-title').textContent = 'Editar TransaÃƒÂ§ÃƒÂ£o';
    document.getElementById('transaction-modal').classList.remove('hidden');
};

// Delete
window.deleteTransaction = async (id) => {
    if (confirm("Tem certeza que deseja excluir esta transaÃƒÂ§ÃƒÂ£o?")) {
        try {
            await DB.deleteTransaction(id);
            await loadData();
        } catch (error) {
            toast.error("Erro ao excluir.");
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
        alert("NÃƒÂ£o hÃƒÂ¡ dados para exportar.");
        return;
    }

    const headers = ['Data', 'DescriÃƒÂ§ÃƒÂ£o', 'Categoria', 'MÃƒÂ©todo', 'Tipo', 'Status', 'Valor'];
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
            // Remove espaÃƒÂ§os, converte para minÃƒÂºsculo e remove BOM do Excel
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
                        alert(`O CSV nÃƒÂ£o possui as colunas corretas.\n\nEncontradas:\n${keys.join(', ')}\n\nNecessÃƒÂ¡rias:\n${requiredFields.join(', ')}`);
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
                alert(`ImportaÃƒÂ§ÃƒÂ£o concluÃƒÂ­da com sucesso! ${transactions.length} transaÃƒÂ§ÃƒÂµes adicionadas.`);
                e.target.value = ''; // reseta o input
            } catch (err) {
                console.error(err);
                toast.error("Erro ao importar CSV.");
            }
        },
        error: function(error) {
            toast.error("Erro ao ler arquivo CSV: " + error.message);
        }
    });
});

// =====================================
// AUTENTICAÃƒâ€¡ÃƒÆ’O E PERFIS
// =====================================

let isLoginMode = true;

window.toggleAuthMode = () => {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').textContent = isLoginMode ? 'Entrar' : 'Criar Conta';
    document.getElementById('btn-auth-submit').textContent = isLoginMode ? 'Entrar' : 'Cadastrar';
    document.getElementById('auth-toggle-text').textContent = isLoginMode ? 'NÃƒÂ£o tem uma conta?' : 'JÃƒÂ¡ tem uma conta?';
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
    const rememberMe = document.getElementById('auth-remember').checked;
    
    const btn = document.getElementById('btn-auth-submit');
    const originalText = btn.textContent;
    btn.textContent = 'Aguarde...';
    btn.disabled = true;

    try {
        if (isLoginMode) {
            await DB.login(email, password, rememberMe);
        } else {
            await DB.register(email, password, name);
            toast.success("Conta criada com sucesso!");
        }
        showApp();
    } catch (err) {
        toast.error(err.message);
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
    AppState.transactions = []; // Limpa os dados em memÃƒÂ³ria
};

// =====================================
// AÃƒâ€¡Ãƒâ€¢ES EM MASSA (BULK DELETE)
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
    if (!(await customConfirm(`Tem certeza que deseja apagar ${AppState.selectedTransactions.length} transaÃ§Ãµes?`))) return;
    
    try {
        await DB.bulkDeleteTransactions(AppState.selectedTransactions);
        AppState.selectedTransactions = [];
        updateBulkActionBar(); // Resolve o bug da barra continuar visÃ­vel
        await loadData();
        toast.success("TransaÃ§Ãµes apagadas com sucesso!");
    } catch (err) {
        console.error(err);
        toast.error("Erro ao excluir transaÃ§Ãµes em massa.");
    }
};

// =====================================
// EDIÃƒâ€¡ÃƒÆ’O MANUAL DE SALDOS (PROFILE)
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
        toast.error("Erro ao salvar ajustes manuais.");
    }
});

// =====================================
// INVESTIMENTOS
// =====================================

async function loadInvestments() {
    try {
        AppState.investments = await DB.getInvestments();
        updateInvestmentKPIs();
        renderInvestmentsTable();
    } catch (err) {
        toast.error("Erro ao carregar investimentos.");
    }
}

function updateInvestmentKPIs() {
    let total = 0, fixed = 0, variable = 0;
    
    AppState.investments.forEach(inv => {
        if (inv.status === 'active') {
            const amount = parseFloat(inv.amount);
            total += amount;
            if (inv.type === 'fixed') fixed += amount;
            if (inv.type === 'variable') variable += amount;
        }
    });
    
    document.getElementById('kpi-inv-total').textContent = formatCurrency(total);
    document.getElementById('kpi-inv-fixed').textContent = formatCurrency(fixed);
    document.getElementById('kpi-inv-variable').textContent = formatCurrency(variable);
}

function renderInvestmentsTable() {
    const tbody = document.getElementById('investments-table-body');
    tbody.innerHTML = '';

    if (AppState.investments.length === 0) {
        tbody.innerHTML = <tr><td colspan="6" class="px-4 py-8 text-center text-zinc-500">Nenhum investimento cadastrado.</td></tr>;
        return;
    }
    
    const typeMap = {
        'fixed': 'Renda Fixa',
        'variable': 'Renda VariÃ¡vel',
        'crypto': 'Criptomoeda',
        'other': 'Outros'
    };

    AppState.investments.forEach(inv => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-zinc-800/50 smooth-transition';
        
        const statusBadge = inv.status === 'active' 
            ? <span class="px-2.5 py-1 text-xs rounded-full bg-brand-emerald/10 text-brand-emerald font-medium border border-brand-emerald/20">Ativo</span>
            : <span class="px-2.5 py-1 text-xs rounded-full bg-zinc-800 text-zinc-400 font-medium border border-zinc-700">Vendido</span>;
            
        tr.innerHTML = 
            <td class="px-4 py-3 font-medium text-zinc-200"></td>
            <td class="px-4 py-3">
                <span class="px-2.5 py-1 text-xs rounded-lg bg-zinc-800 text-zinc-400"></span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-zinc-300"></td>
            <td class="px-4 py-3 text-right font-semibold text-zinc-100"></td>
            <td class="px-4 py-3 text-center"></td>
            <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-2">
                    <button onclick="editInvestment('')" class="p-1.5 text-zinc-400 hover:text-brand-emerald hover:bg-brand-emerald/10 rounded-md transition-colors" title="Editar">
                        <i data-lucide="edit-2" class="w-4 h-4"></i>
                    </button>
                    <button onclick="deleteInvestment('')" class="p-1.5 text-zinc-400 hover:text-brand-carmine hover:bg-brand-carmine/10 rounded-md transition-colors" title="Excluir">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </td>
        ;
        tbody.appendChild(tr);
    });
    
    lucide.createIcons();
}

window.openInvestmentModal = () => {
    AppState.editingId = null;
    document.getElementById('inv-modal-title').textContent = 'Novo Investimento';
    document.getElementById('investment-form').reset();
    document.getElementById('inv-id').value = '';
    
    // Default date to today
    const now = new Date();
    document.getElementById('inv-date').value = now.toISOString().split('T')[0];
    
    document.getElementById('investment-modal').classList.remove('hidden');
};

window.editInvestment = (id) => {
    const inv = AppState.investments.find(i => i.id === id);
    if (!inv) return;
    
    AppState.editingId = id;
    document.getElementById('inv-modal-title').textContent = 'Editar Investimento';
    
    document.getElementById('inv-id').value = inv.id;
    document.getElementById('inv-name').value = inv.name;
    document.getElementById('inv-amount').value = inv.amount;
    document.getElementById('inv-type').value = inv.type;
    document.getElementById('inv-date').value = inv.date;
    document.getElementById('inv-status').value = inv.status;
    
    document.getElementById('investment-modal').classList.remove('hidden');
};

window.closeInvestmentModal = () => {
    document.getElementById('investment-modal').classList.add('hidden');
    AppState.editingId = null;
};

document.getElementById('investment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('inv-id').value;
    const inv = {
        name: document.getElementById('inv-name').value,
        amount: parseFloat(document.getElementById('inv-amount').value),
        date: document.getElementById('inv-date').value,
        type: document.getElementById('inv-type').value,
        status: document.getElementById('inv-status').value
    };
    
    const btn = document.getElementById('btn-save-inv');
    const originalText = btn.textContent;
    btn.textContent = 'Salvando...';
    btn.disabled = true;
    
    try {
        if (id) {
            await DB.updateInvestment(id, inv);
            toast.success("Investimento atualizado!");
        } else {
            await DB.addInvestment(inv);
            toast.success("Investimento criado com sucesso!");
        }
        closeInvestmentModal();
        await loadInvestments();
    } catch (err) {
        toast.error("Erro ao salvar o investimento.");
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
});

window.deleteInvestment = async (id) => {
    if (await customConfirm("Tem certeza que deseja apagar este investimento?")) {
        try {
            await DB.deleteInvestment(id);
            toast.success("Investimento excluÃ­do.");
            await loadInvestments();
        } catch (err) {
            toast.error("Erro ao excluir.");
        }
    }
};
