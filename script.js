(function() {
    // ========== 1. MASTER DATA DEFAULT (25 Varietas Bunga) ==========
    const DEFAULT_FLOWERS = [
        { id:1, name:'Mawar Merah', cost:8000, price:15000, stock:40 }, 
        { id:2, name:'Mawar Putih', cost:8500, price:16000, stock:33 },
        { id:3, name:'Mawar Pink', cost:8000, price:15500, stock:49 }, 
        { id:4, name:'Tulip Merah', cost:12000, price:22000, stock:30 },
        { id:5, name:'Tulip Putih', cost:12500, price:23000, stock:24 }, 
        { id:6, name:'Tulip Kuning', cost:13000, price:24000, stock:27 },
        { id:7, name:'Anggrek Ungu', cost:20000, price:35000, stock:15 }, 
        { id:8, name:'Anggrek Putih', cost:21000, price:36000, stock:12 },
        { id:9, name:'Lily Putih', cost:15000, price:28000, stock:19 }, 
        { id:10, name:'Lily Orange', cost:15500, price:29000, stock:18 },
        { id:11, name:'Bunga Matahari', cost:9000, price:18000, stock:40 }, 
        { id:12, name:'Gerbera Orange', cost:8500, price:17000, stock:33 },
        { id:13, name:'Gerbera Pink', cost:9000, price:17500, stock:35 }, 
        { id:14, name:'Krisan Putih', cost:6000, price:12000, stock:55 },
        { id:15, name:'Krisan Kuning', cost:6500, price:12500, stock:52 }, 
        { id:16, name:'Baby\'s Breath', cost:5000, price:10000, stock:60 },
        { id:17, name:'Lavender', cost:10000, price:20000, stock:22 }, 
        { id:18, name:'Peony Pink', cost:18000, price:32000, stock:10 },
        { id:19, name:'Peony Putih', cost:19000, price:33000, stock:8 }, 
        { id:20, name:'Hydrangea Biru', cost:22000, price:38000, stock:6 },
        { id:21, name:'Hydrangea Putih', cost:23000, price:39000, stock:7 }, 
        { id:22, name:'Carnation Merah', cost:5500, price:11000, stock:48 },
        { id:23, name:'Carnation Pink', cost:6000, price:11500, stock:44 }, 
        { id:24, name:'Daisy Putih', cost:4500, price:9000, stock:70 },
        { id:25, name:'Bunga Kamboja', cost:7000, price:14000, stock:36 }
    ];

    const DEFAULT_CUSTOMERS = [
        { id:1, name:'Ahmad Riva’i', phone:'081234567890', points:120 },
        { id:2, name:'Siti Aminah', phone:'085711223344', points:450 },
        { id:3, name:'Dewi Lestari', phone:'081988776655', points:25 }
    ];

    const DEFAULT_SUPPLIERS = [
        { id:1, company:'Mitra Flora Lembang', contact:'Budi Santoso', phone:'0811223344', product:'Mawar & Krisan' },
        { id:2, company:'Java Bulb Orchid', contact:'Dr. Ammar', phone:'0852998877', product:'Anggrek & Tulip' }
    ];

    const DEFAULT_SETTINGS = { 
        storeName: 'Bloom & Petal Indonesia', 
        storeAddress: 'CBD Menteng No. 88, Jakarta Pusat', 
        taxRate: 11, 
        adminPassword: 'admin123' 
    };

    // ========== 2. UTILITY & DB HANDLERS ==========
    const getDB = (key, fallback) => JSON.parse(localStorage.getItem(key)) || fallback;
    const saveDB = (key, data) => localStorage.setItem(key, JSON.stringify(data));
    const getSettings = () => getDB('bloom_settings', DEFAULT_SETTINGS);
    const saveSettings = (data) => saveDB('bloom_settings', data);
    const $ = id => document.getElementById(id);

    // MIGRATION SCRIPT 
    let existingFlowers = getDB('bloom_flowers', DEFAULT_FLOWERS);
    let needsUpdate = false;
    existingFlowers = existingFlowers.map(f => {
        if(f.cost === undefined) { f.cost = Math.floor(f.price * 0.6); needsUpdate = true; }
        return f;
    });
    if(existingFlowers.length < 25) { existingFlowers = DEFAULT_FLOWERS; needsUpdate = true; }
    if(needsUpdate) saveDB('bloom_flowers', existingFlowers);

    // ========== 3. STATE MANAJEMEN APLIKASI ==========
    let currentUser = null;
    let cart = [];
    let heldCarts = [];
    let currentPage = 'dashboard';
    let sortColumn = 'name', sortDirection = 'asc';
    let chartRevenueInstance = null;
    let chartProductInstance = null;

    // --- STATE PAGINASI GUDANG ---
    let inventoryCurrentPage = 1;
    const inventoryItemsPerPage = 8; 

    // ========== 4. CORE ENGINE & UI HELPERS ==========
    function showToast(message, type = 'success') {
        const container = $('toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        let icon = '<i class="fa-solid fa-circle-check text-emerald"></i>';
        if (type === 'danger') icon = '<i class="fa-solid fa-triangle-exclamation text-red"></i>';
        if (type === 'warning') icon = '<i class="fa-solid fa-circle-exclamation text-gold"></i>';
        toast.innerHTML = `${icon} <span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
    }

    function showLoading() { $('loadingOverlay').classList.add('show'); }
    function hideLoading() { $('loadingOverlay').classList.remove('show'); }
    function closeAllModals() { document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('show')); }
    function escapeHTML(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

    setInterval(() => {
        if ($('liveClock') && currentPage === 'dashboard') {
            $('liveClock').textContent = new Date().toLocaleTimeString('id-ID', { hour12: false });
        }
    }, 1000);

    // ========== 5. NAVIGATION & PERMISSION ==========
    function setupSidebar() {
        const nav = $('sidebarNav');
        if (!nav) return;
        nav.innerHTML = '';
        
        if (currentUser.role === 'admin') {
            nav.innerHTML = `
                <li><a class="active" data-page="dashboard"><i class="fa-solid fa-chart-pie icon-margin"></i> <span>Dashboard Hub</span></a></li>
                <li><a data-page="inventory"><i class="fa-solid fa-boxes-stacked icon-margin"></i> <span>Inventaris Gudang</span></a></li>
                <li><a data-page="crm"><i class="fa-solid fa-users-gear icon-margin"></i> <span>Manajemen CRM</span></a></li>
                <li><a data-page="suppliers"><i class="fa-solid fa-truck-ramp-box icon-margin"></i> <span>Jaringan Supplier</span></a></li>
                <li><a data-page="reports"><i class="fa-solid fa-file-invoice-dollar icon-margin"></i> <span>Jurnal Laporan</span></a></li>
                <li><a data-page="settings"><i class="fa-solid fa-gears icon-margin"></i> <span>Pengaturan Sistem</span></a></li>`;
        } else {
            nav.innerHTML = `<li><a class="active" data-page="cashier"><i class="fa-solid fa-cash-register icon-margin"></i> <span>Terminal POS Kasir</span></a></li>`;
        }
        
        document.querySelectorAll('.sidebar-nav a').forEach(link => {
            link.onclick = function(e) { e.preventDefault(); navigateTo(this.dataset.page); };
        });
    }

    function navigateTo(page) {
        currentPage = page;
        document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
        const targetId = page.toUpperCase() === 'CRM' ? 'pageCRM' : `page${page.charAt(0).toUpperCase() + page.slice(1)}`;
        if ($(targetId)) $(targetId).classList.add('active');
        document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
        document.querySelector(`.sidebar-nav a[data-page="${page}"]`)?.classList.add('active');
        closeAllModals();

        if (page === 'dashboard') renderDashboardAnalytics();
        else if (page === 'inventory') renderInventoryTable();
        else if (page === 'reports') renderReports();
        else if (page === 'crm') renderCRMTable();
        else if (page === 'suppliers') renderSuppliersTable();
        else if (page === 'settings') loadSettings();
        else if (page === 'cashier') { populateCashierCustomers(); renderProductGrid(); updateCartDisplay(); $('taxRateDisplay').textContent = getSettings().taxRate; }
    }

    // ========== 6. DASHBOARD ANALYTICS ==========
    function renderDashboardAnalytics() {
        if (currentUser.role !== 'admin') return;
        const sales = getDB('bloom_sales', []);
        const flowers = getDB('bloom_flowers', DEFAULT_FLOWERS);
        const customers = getDB('bloom_crm', DEFAULT_CUSTOMERS);

        const totalRevenue = sales.reduce((s, x) => s + x.total, 0);
        const totalCost = sales.reduce((s, x) => s + x.items.reduce((si, i) => {
            const fl = flowers.find(f => f.id === i.flowerId);
            return si + ((fl ? fl.cost : i.price * 0.5) * i.qty);
        }, 0), 0);
        
        const netProfit = totalRevenue - totalCost;
        const lowStockCount = flowers.filter(f => f.stock <= 5).length;

        $('kpiRevenue').textContent = 'Rp ' + totalRevenue.toLocaleString('id-ID');
        $('kpiNetProfit').textContent = 'Rp ' + netProfit.toLocaleString('id-ID');
        $('kpiCRMCount').textContent = `${customers.length} Anggota`;
        $('kpiStockCount').textContent = `${lowStockCount} Kritis`;
        $('kpiStockAlertCard').className = lowStockCount > 0 ? 'kpi-card bg-light-red text-red' : 'kpi-card';

        const lineSlice = sales.slice(-7);
        const ctxLine = $('lineChartRevenue').getContext('2d');
        if (chartRevenueInstance) chartRevenueInstance.destroy();
        chartRevenueInstance = new Chart(ctxLine, {
            type: 'line',
            data: { 
                labels: lineSlice.length ? lineSlice.map(s => s.date.split(' ')[0]) : ['Belum Ada Penjualan'], 
                datasets: [{ data: lineSlice.length ? lineSlice.map(s => s.total) : [0], borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.3 }] 
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });

        const productMap = {};
        sales.forEach(s => s.items.forEach(i => productMap[i.name] = (productMap[i.name] || 0) + i.qty));
        const ctxBar = $('barChartTopProducts').getContext('2d');
        if (chartProductInstance) chartProductInstance.destroy();
        chartProductInstance = new Chart(ctxBar, {
            type: 'bar',
            data: { 
                labels: Object.keys(productMap).length ? Object.keys(productMap) : ['Kosong'], 
                datasets: [{ data: Object.values(productMap).length ? Object.values(productMap) : [0], backgroundColor: '#10b981', borderRadius: 4 }] 
            },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }

    // ========== 7. INVENTARIS LOGISTIK & PAGINASI GUDANG ==========
    function renderInventoryPagination(totalItems, totalPages) {
        const container = $('inventoryPagination');
        if (!container) return;
        
        let html = '';
        
        html += `<button class="page-btn" ${inventoryCurrentPage === 1 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''} id="btnPrevInv"><i class="fa-solid fa-chevron-left"></i></button>`;
        
        const pagesToShow = Math.max(1, totalPages);
        for (let i = 1; i <= pagesToShow; i++) {
            html += `<button class="page-btn ${inventoryCurrentPage === i ? 'active' : ''} page-num-btn-inv" data-page="${i}">Hal ${i}</button>`;
        }
        
        html += `<button class="page-btn" ${(inventoryCurrentPage === totalPages || totalPages === 0) ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''} id="btnNextInv"><i class="fa-solid fa-chevron-right"></i></button>`;
        
        html += `<span class="page-info">Total Gudang: ${totalItems} Varietas</span>`;

        container.innerHTML = html;

        if($('btnPrevInv')) {
            $('btnPrevInv').onclick = () => {
                if (inventoryCurrentPage > 1) { inventoryCurrentPage--; renderInventoryTable(); }
            };
        }
        
        if($('btnNextInv')) {
            $('btnNextInv').onclick = () => {
                if (inventoryCurrentPage < totalPages) { inventoryCurrentPage++; renderInventoryTable(); }
            };
        }

        document.querySelectorAll('.page-num-btn-inv').forEach(btn => {
            btn.onclick = function() {
                inventoryCurrentPage = parseInt(this.dataset.page);
                renderInventoryTable();
            };
        });
    }

    function renderInventoryTable() {
        const flowers = getDB('bloom_flowers', DEFAULT_FLOWERS);
        const search = $('searchInventory').value.toLowerCase();
        let filtered = flowers.filter(f => f.name.toLowerCase().includes(search));

        filtered.sort((a, b) => {
            let valA = a[sortColumn], valB = b[sortColumn];
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            return sortDirection === 'asc' ? (valA < valB ? -1 : 1) : (valA > valB ? -1 : 1);
        });

        $('totalFlowers').textContent = filtered.length;
        const tbody = $('inventoryTableBody');

        if (!filtered.length) { 
            tbody.innerHTML = '<tr><td colspan="6" class="empty-table">Data logistik bunga tidak ditemukan.</td></tr>'; 
            renderInventoryPagination(0, 0);
            return; 
        }

        const totalPages = Math.ceil(filtered.length / inventoryItemsPerPage);
        
        if (inventoryCurrentPage > totalPages && totalPages > 0) inventoryCurrentPage = totalPages;
        if (inventoryCurrentPage < 1) inventoryCurrentPage = 1;
        
        const startIdx = (inventoryCurrentPage - 1) * inventoryItemsPerPage;
        const endIdx = startIdx + inventoryItemsPerPage;
        const paginatedItems = filtered.slice(startIdx, endIdx);

        tbody.innerHTML = paginatedItems.map(f => {
            let badge = f.stock <= 5 ? 'badge-low' : f.stock <= 15 ? 'badge-ok' : 'badge-good';
            let status = f.stock <= 5 ? 'Kritis' : f.stock <= 15 ? 'Terbatas' : 'Aman';
            return `<tr>
                <td class="font-w600">${escapeHTML(f.name)}</td>
                <td>Rp ${(f.cost || 0).toLocaleString('id-ID')}</td>
                <td class="text-blue font-w600">Rp ${(f.price || 0).toLocaleString('id-ID')}</td>
                <td><strong>${f.stock}</strong></td>
                <td><span class="badge ${badge}">${status}</span></td>
                <td>
                    <button class="btn btn-outline btn-sm edit-flower" data-id="${f.id}"><i class="fa-solid fa-pen text-blue"></i></button>
                    <button class="btn btn-outline btn-sm delete-btn" data-id="${f.id}" data-type="flower"><i class="fa-solid fa-trash text-red"></i></button>
                </td>
            </tr>`;
        }).join('');

        renderInventoryPagination(filtered.length, totalPages);

        document.querySelectorAll('.edit-flower').forEach(b => b.onclick = () => openFlowerModal(+b.dataset.id));
        document.querySelectorAll('.delete-btn').forEach(b => b.onclick = () => openDeleteConfirmModal(+b.dataset.id, b.dataset.type));
    }

    $('searchInventory').oninput = function() {
        inventoryCurrentPage = 1; 
        renderInventoryTable();
    };

    document.querySelectorAll('table th[data-sort]').forEach(th => {
        th.onclick = function() {
            const col = this.dataset.sort;
            if (sortColumn === col) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else { 
                sortColumn = col; 
                sortDirection = 'asc'; 
            }
            if (currentPage === 'inventory') {
                inventoryCurrentPage = 1;
                renderInventoryTable();
            }
        };
    });

    function openFlowerModal(id = null) {
        const flowers = getDB('bloom_flowers', DEFAULT_FLOWERS);
        $('flowerEditId').value = ''; $('flowerName').value = ''; $('flowerCost').value = ''; $('flowerPrice').value = ''; $('flowerStock').value = '';
        if (id) {
            const f = flowers.find(fl => fl.id === id);
            if (f) {
                $('flowerEditId').value = f.id; $('flowerName').value = f.name;
                $('flowerCost').value = f.cost; $('flowerPrice').value = f.price; $('flowerStock').value = f.stock;
                $('flowerModalTitle').textContent = 'Ubah Detail Komoditas';
            }
        } else {
            $('flowerModalTitle').textContent = 'Pendaftaran Bunga Baru';
        }
        $('flowerModal').classList.add('show');
    }

    // INI DIA PERBAIKANNYA (Klik Tambah Bunga)
    $('btnAddFlower').onclick = () => openFlowerModal();

    $('btnSaveFlower').onclick = function() {
        const flowers = getDB('bloom_flowers', DEFAULT_FLOWERS);
        const editId = $('flowerEditId').value;
        const name = $('flowerName').value.trim();
        const cost = parseInt($('flowerCost').value) || 0;
        const price = parseInt($('flowerPrice').value) || 0;
        const stock = parseInt($('flowerStock').value) || 0;

        if (!name || price <= cost) return showToast('Form Ditolak: Nama wajib ada, dan Harga Jual harus lebih tinggi dari Modal.', 'danger');

        if (editId) {
            const idx = flowers.findIndex(f => f.id === +editId);
            if (idx !== -1) { Object.assign(flowers[idx], { name, cost, price, stock }); showToast('Informasi varietas berhasil diperbarui.'); }
        } else {
            flowers.push({ id: Math.max(0, ...flowers.map(f => f.id)) + 1, name, cost, price, stock });
            showToast('Satu varietas bunga baru berhasil diregistrasi.');
        }
        
        saveDB('bloom_flowers', flowers);
        $('flowerModal').classList.remove('show');
        renderInventoryTable();
    };

    // ========== 8. SISTEM POINT OF SALE (POS KASIR TANPA PAGINASI) ==========
    function populateCashierCustomers() {
        const customers = getDB('bloom_crm', DEFAULT_CUSTOMERS);
        const select = $('cartCustomerSelect');
        if (!select) return;
        select.innerHTML = '<option value="">-- Pelanggan Umum (Tanpa Poin) --</option>' + customers.map(c => `<option value="${c.id}">${escapeHTML(c.name)} [Poin: ${c.points}]</option>`).join('');
    }

    function renderProductGrid() {
        const flowers = getDB('bloom_flowers', DEFAULT_FLOWERS);
        const search = $('searchProduct').value.toLowerCase();
        const filtered = flowers.filter(f => f.name.toLowerCase().includes(search));
        const grid = $('productGrid');
        if (!grid) return;

        if (!filtered.length) { 
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:50px;color:var(--alert-red);font-weight:bold;">Hasil pencarian produk kosong.</div>'; 
            return; 
        }

        grid.innerHTML = filtered.map(f => `
            <div class="product-card ${f.stock <= 0 ? 'out-of-stock' : ''}" data-id="${f.id}">
                <div class="p-name">${escapeHTML(f.name)}</div>
                <div class="p-price">Rp ${(f.price || 0).toLocaleString('id-ID')}</div>
                <div class="p-stock">Sisa Gudang: ${f.stock}</div>
            </div>
        `).join('');

        document.querySelectorAll('.product-card:not(.out-of-stock)').forEach(card => {
            card.onclick = () => {
                const id = +card.dataset.id;
                const fl = flowers.find(f => f.id === id);
                const existing = cart.find(i => i.flowerId === id);
                
                if (existing && existing.qty >= fl.stock) {
                    return showToast(`Maksimal! Sisa stok ${fl.name} hanya ${fl.stock}.`, 'warning');
                }
                
                if (existing) {
                    existing.qty++;
                } else {
                    cart.push({ flowerId: fl.id, name: fl.name, price: fl.price, qty: 1 });
                }
                updateCartDisplay();
            };
        });
    }

    $('searchProduct').oninput = renderProductGrid;

    function updateCartDisplay() {
        const container = $('cartItems');
        if (!container) return;
        
        if (!cart.length) {
            container.innerHTML = '<div class="empty-cart"><i class="fa-solid fa-basket-shopping" style="font-size:32px;color:#cbd5e1;display:block;margin-bottom:15px;"></i>Keranjang Belanja Kosong. Silakan pilih produk.</div>';
            $('btnPay').disabled = true;
            $('cartSubtotal').textContent = 'Rp0'; $('cartTax').textContent = 'Rp0'; $('cartTotal').textContent = 'Rp0';
            return;
        }

        $('btnPay').disabled = false;
        container.innerHTML = cart.map((item, idx) => `
            <div class="cart-item-row">
                <span class="item-name">${escapeHTML(item.name)}</span>
                <input type="number" class="item-qty" value="${item.qty}" min="1" data-idx="${idx}">
                <span class="item-subtotal">Rp ${(item.price * item.qty).toLocaleString('id-ID')}</span>
                <span class="item-remove" data-idx="${idx}">&times;</span>
            </div>
        `).join('');

        document.querySelectorAll('.item-qty').forEach(inp => inp.onchange = function() {
            const idx = +this.dataset.idx;
            const qty = parseInt(this.value) || 1;
            const fl = getDB('bloom_flowers', []).find(f => f.id === cart[idx].flowerId);
            
            if (qty > fl.stock) { 
                showToast(`Limit stok tersisa hanya ${fl.stock} unit.`, 'warning'); 
                cart[idx].qty = fl.stock; 
            } else {
                cart[idx].qty = Math.max(1, qty);
            }
            updateCartDisplay();
        });

        document.querySelectorAll('.item-remove').forEach(b => b.onclick = function() {
            cart.splice(+this.dataset.idx, 1);
            updateCartDisplay();
        });

        const subtotal = cart.reduce((s, i) => s + (i.price * i.qty), 0);
        const discount = parseFloat($('discountPercent').value) || 0;
        const discounted = subtotal * (1 - (discount / 100));
        const taxRate = getSettings().taxRate;
        const tax = Math.round(discounted * taxRate / 100);
        const total = discounted + tax;

        $('cartSubtotal').textContent = 'Rp ' + subtotal.toLocaleString('id-ID');
        $('cartTax').textContent = 'Rp ' + tax.toLocaleString('id-ID');
        $('cartTotal').textContent = 'Rp ' + Math.round(total).toLocaleString('id-ID');
    }

    $('discountPercent').oninput = updateCartDisplay;
    $('btnClearCart').onclick = () => { cart = []; updateCartDisplay(); showToast('Keranjang telah dikosongkan.', 'warning'); };

    // --- FITUR HOLD / ANTREAN KARTU KASIR ---
    $('btnHoldCart').onclick = function() {
        if (!cart.length) return showToast('Gagal menahan: Keranjang Anda saat ini kosong.', 'warning');
        heldCarts.push({ id: Date.now(), timestamp: new Date().toLocaleTimeString('id-ID'), items: [...cart] });
        cart = []; updateCartDisplay();
        $('holdCount').textContent = heldCarts.length;
        showToast('Transaksi disimpan sementara di rak antrean.');
    };

    $('btnRecallCart').onclick = function() {
        if (!heldCarts.length) return showToast('Belum ada antrean yang disimpan.', 'warning');
        const tbody = $('holdCartTableBody');
        tbody.innerHTML = heldCarts.map((hc, idx) => `
            <tr>
                <td style="font-weight:bold;">${hc.timestamp}</td>
                <td>${hc.items.map(i => `${i.name} (x${i.qty})`).join(', ')}</td>
                <td>
                    <button class="btn btn-primary btn-sm recall-action" data-idx="${idx}">Tarik Ulang</button>
                    <button class="btn btn-danger btn-sm drop-held-action" data-idx="${idx}"><i class="fa-solid fa-xmark"></i></button>
                </td>
            </tr>
        `).join('');
        
        document.querySelectorAll('.recall-action').forEach(b => b.onclick = function() {
            const idx = +this.dataset.idx;
            cart = heldCarts[idx].items;
            heldCarts.splice(idx, 1);
            $('holdCount').textContent = heldCarts.length;
            closeAllModals(); 
            updateCartDisplay();
            showToast('Antrean berhasil ditarik masuk ke keranjang kasir.');
        });

        document.querySelectorAll('.drop-held-action').forEach(b => b.onclick = function() {
            heldCarts.splice(+this.dataset.idx, 1);
            $('holdCount').textContent = heldCarts.length;
            if (heldCarts.length === 0) closeAllModals(); else $('btnRecallCart').click();
            showToast('Salah satu data antrean berhasil dibatalkan.', 'danger');
        });

        $('holdCartModal').classList.add('show');
    };

    // --- PROSES PEMBAYARAN FINAL ---
    $('btnPay').onclick = function() {
        const total = parseInt($('cartTotal').textContent.replace(/[^\d]/g, '')) || 0;
        $('paymentTotalDisplay').textContent = 'Rp ' + total.toLocaleString('id-ID');
        $('paymentMethod').value = 'tunai';
        $('cashReceived').value = '';
        $('changeDisplay').style.display = 'none';
        $('cashInputGroup').style.display = 'block';
        $('paymentModal').classList.add('show');
    };

    $('btnProcessPayment').onclick = function() {
        const flowers = getDB('bloom_flowers', DEFAULT_FLOWERS);
        const customers = getDB('bloom_crm', DEFAULT_CUSTOMERS);
        
        const subtotal = cart.reduce((s, i) => s + (i.price * i.qty), 0);
        const discount = parseFloat($('discountPercent').value) || 0;
        const discounted = subtotal * (1 - (discount / 100));
        const taxRate = getSettings().taxRate;
        const tax = Math.round(discounted * taxRate / 100);
        const total = Math.round(discounted + tax);
        const method = $('paymentMethod').value;
        const customerId = $('cartCustomerSelect').value;

        if (method === 'tunai' && (parseInt($('cashReceived').value) || 0) < total) {
            return showToast('Transaksi Dibatalkan: Uang tunai yang dibayar kurang dari nilai tagihan.', 'danger');
        }

        for (const i of cart) {
            const f = flowers.find(fl => fl.id === i.flowerId);
            if (!f || f.stock < i.qty) return showToast(`Gagal: Stok untuk ${i.name} ternyata sudah habis.`, 'danger');
        }
        cart.forEach(i => flowers.find(fl => fl.id === i.flowerId).stock -= i.qty);
        saveDB('bloom_flowers', flowers);

        let memberLabel = 'Pembeli Umum (Non-Member)';
        if (customerId) {
            const m = customers.find(c => c.id === +customerId);
            if (m) {
                const rewardPoints = Math.floor(total / 10000); 
                m.points += rewardPoints;
                memberLabel = `${m.name} [Reward +${rewardPoints} Poin]`;
                saveDB('bloom_crm', customers);
            }
        }

        const sales = getDB('bloom_sales', []);
        const saleId = Math.max(0, ...sales.map(s => s.id)) + 1;
        const dateStr = new Date().toLocaleTimeString('id-ID') + ' ' + new Date().toLocaleDateString('id-ID');
        
        const currentInvoice = { id: saleId, date: dateStr, items: [...cart], subtotal, discount, tax, total, paymentMethod: method.toUpperCase(), cashierName: currentUser.name };
        sales.push(currentInvoice);
        saveDB('bloom_sales', sales);

        const received = method === 'tunai' ? (parseInt($('cashReceived').value) || 0) : total;
        const change = received - total;
        const settings = getSettings();

        $('receiptContent').innerHTML = `
            <div class="rc-store">${settings.storeName}</div>
            <div style="text-align:center; font-size:10px;">${settings.storeAddress}</div>
            <div class="rc-line"></div>
            <div>NO INVOICE: #INV-${String(saleId).padStart(4,'0')}</div>
            <div>WAKTU     : ${dateStr}</div>
            <div>KASIR     : ${escapeHTML(currentUser.name)}</div>
            <div>PELANGGAN : ${escapeHTML(memberLabel)}</div>
            <div class="rc-line"></div>
            <table>
                <tr><th>Item Barang</th><th style="text-align:center">Qty</th><th style="text-align:right">Subtotal</th></tr>
                ${cart.map(i => `<tr><td>${escapeHTML(i.name)}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">Rp ${(i.price*i.qty).toLocaleString('id-ID')}</td></tr>`).join('')}
            </table>
            <div class="rc-line"></div>
            <div style="display:flex;justify-content:space-between;"><span>Subtotal Belanja</span><span>Rp ${subtotal.toLocaleString('id-ID')}</span></div>
            ${discount ? `<div style="display:flex;justify-content:space-between;"><span>Promo Diskon (${discount}%)</span><span>-Rp ${(subtotal-discounted).toLocaleString('id-ID')}</span></div>` : ''}
            <div style="display:flex;justify-content:space-between;"><span>Pajak PPN (${taxRate}%)</span><span>Rp ${tax.toLocaleString('id-ID')}</span></div>
            <div style="display:flex;justify-content:space-between;font-weight:700;font-size:14px;margin-top:6px;"><span>GRAND TOTAL</span><span>Rp ${total.toLocaleString('id-ID')}</span></div>
            <div class="rc-line"></div>
            <div style="display:flex;justify-content:space-between;"><span>Kanal Bayar</span><span>${method.toUpperCase()}</span></div>
            <div style="display:flex;justify-content:space-between;"><span>Uang Diserahkan</span><span>Rp ${received.toLocaleString('id-ID')}</span></div>
            <div style="display:flex;justify-content:space-between;font-weight:700;"><span>KEMBALIAN TUNAI</span><span>Rp ${change.toLocaleString('id-ID')}</span></div>
            <div class="rc-line"></div>
            <div style="text-align:center;font-weight:bold;font-size:11px;">TERIMA KASIH ATAS KUNJUNGAN ANDA</div>
            <div style="text-align:center;font-size:10px;margin-top:4px;">Struk elektronik adalah dokumen sah.</div>`;
            
        $('paymentModal').classList.remove('show');
        $('receiptModal').classList.add('show');
        
        cart = []; 
        updateCartDisplay(); 
        $('discountPercent').value = 0; 
        renderProductGrid();
    };

    $('btnPrintReceipt').onclick = function() {
        const content = $('receiptContent').innerHTML;
        const win = window.open('', '', 'width=420,height=650');
        win.document.write(`<html><head><title>Struk POS</title><style>body{font-family:'Courier New',monospace;font-size:12px;padding:10px;color:#000;} .rc-store{font-weight:bold;text-align:center;font-size:16px;} table{width:100%;font-size:12px;margin:8px 0;} .rc-line{border-top:1px dashed #000;margin:8px 0;}</style></head><body>${content}</body></html>`);
        win.document.close(); 
        win.focus();
        setTimeout(() => { win.print(); win.close(); }, 500); 
    };

    // ========== 9. CRM & SUPPLIER MANAGEMENT ==========
    function renderCRMTable() {
        const customers = getDB('bloom_crm', DEFAULT_CUSTOMERS);
        const tbody = $('crmTableBody');
        if (!tbody) return;
        tbody.innerHTML = customers.map(c => {
            let tier = c.points >= 400 ? '<span class="badge badge-good">Gold Priority</span>' : c.points >= 100 ? '<span class="badge badge-ok">Silver Member</span>' : '<span class="badge" style="background:#e2e8f0;">Bronze Basic</span>';
            return `<tr>
                <td class="font-w600">${escapeHTML(c.name)}</td>
                <td>${escapeHTML(c.phone)}</td>
                <td><strong>${c.points}</strong> pts</td>
                <td>${tier}</td>
                <td>
                    <button class="btn btn-outline btn-sm edit-crm" data-id="${c.id}"><i class="fa-solid fa-user-pen text-blue"></i></button>
                    <button class="btn btn-outline btn-sm delete-btn" data-id="${c.id}" data-type="crm"><i class="fa-solid fa-trash text-red"></i></button>
                </td>
            </tr>`;
        }).join('');
        document.querySelectorAll('.edit-crm').forEach(b => b.onclick = () => openCRMModal(+b.dataset.id));
        document.querySelectorAll('.delete-btn').forEach(b => b.onclick = () => openDeleteConfirmModal(+b.dataset.id, b.dataset.type));
    }

    function openCRMModal(id = null) {
        const customers = getDB('bloom_crm', DEFAULT_CUSTOMERS);
        $('customerEditId').value = ''; $('customerName').value = ''; $('customerPhone').value = ''; $('customerPoints').value = '0';
        if (id) {
            const c = customers.find(x => x.id === id);
            if (c) { $('customerEditId').value = c.id; $('customerName').value = c.name; $('customerPhone').value = c.phone; $('customerPoints').value = c.points; }
        }
        $('customerModal').classList.add('show');
    }

    $('btnAddCustomer').onclick = () => openCRMModal();
    $('btnSaveCustomer').onclick = function() {
        const customers = getDB('bloom_crm', DEFAULT_CUSTOMERS);
        const editId = $('customerEditId').value;
        const name = $('customerName').value.trim();
        const phone = $('customerPhone').value.trim();
        const points = parseInt($('customerPoints').value) || 0;

        if (!name || !phone) return showToast('Penolakan: Pastikan nama dan telepon pelanggan sudah diisi.', 'danger');
        if (editId) { const c = customers.find(x => x.id === +editId); if (c) Object.assign(c, { name, phone, points }); } 
        else { customers.push({ id: Date.now(), name, phone, points }); }

        saveDB('bloom_crm', customers); showToast('Pangkalan data CRM sukses diperbarui.');
        $('customerModal').classList.remove('show'); renderCRMTable();
    };

    function renderSuppliersTable() {
        const suppliers = getDB('bloom_suppliers', DEFAULT_SUPPLIERS);
        const tbody = $('suppliersTableBody');
        if (!tbody) return;
        tbody.innerHTML = suppliers.map(s => `<tr>
            <td class="font-w600 text-blue">${escapeHTML(s.company)}</td>
            <td>${escapeHTML(s.contact)}</td>
            <td>${escapeHTML(s.phone)}</td>
            <td><span class="badge badge-good">${escapeHTML(s.product)}</span></td>
            <td>
                <button class="btn btn-outline btn-sm edit-sup" data-id="${s.id}"><i class="fa-solid fa-pen text-blue"></i></button>
                <button class="btn btn-outline btn-sm delete-btn" data-id="${s.id}" data-type="supplier"><i class="fa-solid fa-trash text-red"></i></button>
            </td>
        </tr>`).join('');
        document.querySelectorAll('.edit-sup').forEach(b => b.onclick = () => openSupplierModal(+b.dataset.id));
        document.querySelectorAll('.delete-btn').forEach(b => b.onclick = () => openDeleteConfirmModal(+b.dataset.id, b.dataset.type));
    }

    function openSupplierModal(id = null) {
        const suppliers = getDB('bloom_suppliers', DEFAULT_SUPPLIERS);
        $('supplierEditId').value = ''; $('supplierCompany').value = ''; $('supplierContact').value = ''; $('supplierPhone').value = ''; $('supplierProduct').value = '';
        if (id) {
            const s = suppliers.find(x => x.id === id);
            if (s) { $('supplierEditId').value = s.id; $('supplierCompany').value = s.company; $('supplierContact').value = s.contact; $('supplierPhone').value = s.phone; $('supplierProduct').value = s.product; }
        }
        $('supplierModal').classList.add('show');
    }

    $('btnAddSupplier').onclick = () => openSupplierModal();
    $('btnSaveSupplier').onclick = function() {
        const suppliers = getDB('bloom_suppliers', DEFAULT_SUPPLIERS);
        const editId = $('supplierEditId').value;
        const company = $('supplierCompany').value.trim();
        const contact = $('supplierContact').value.trim();
        const phone = $('supplierPhone').value.trim();
        const product = $('supplierProduct').value.trim();

        if (!company || !contact) return showToast('Sistem Menolak: Identitas perusahaan dan kontak narahubung wajib diisi.', 'danger');
        if (editId) { const s = suppliers.find(x => x.id === +editId); if (s) Object.assign(s, { company, contact, phone, product }); } 
        else { suppliers.push({ id: Date.now(), company, contact, phone, product }); }

        saveDB('bloom_suppliers', suppliers); showToast('Kontrak kemitraan vendor berhasil diikat.');
        $('supplierModal').classList.remove('show'); renderSuppliersTable();
    };

    // ========== 10. EKSPOR LAPORAN PDF PRO STRUKTUR ==========
    function renderReports() {
        const sales = getDB('bloom_sales', []);
        $('totalSales').textContent = sales.length;
        $('totalRevenue').textContent = 'Rp ' + sales.reduce((s, x) => s + x.total, 0).toLocaleString('id-ID');
        const tbody = $('salesTableBody');
        if (!tbody) return;
        if (!sales.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-table">Buku besar bersih. Belum terjadi pembukuan transaksi.</td></tr>'; return; }

        tbody.innerHTML = sales.slice().reverse().map(s => `<tr>
            <td class="font-w600 text-blue">#INV-${String(s.id).padStart(4,'0')}</td>
            <td>${s.date}</td>
            <td style="max-width:200px;text-overflow:ellipsis;white-space:nowrap;overflow:hidden;">${s.items.map(i => `${i.name} (x${i.qty})`).join(', ')}</td>
            <td><span class="badge badge-good">${s.paymentMethod}</span></td>
            <td>${escapeHTML(s.cashierName)}</td>
            <td class="font-w600">Rp ${s.total.toLocaleString('id-ID')}</td>
        </tr>`).join('');
    }

    $('btnExportPDF').onclick = async function() {
        const sales = getDB('bloom_sales', []);
        if (!sales.length) return showToast('Sistem Pembukuan Kosong. File PDF dibatalkan.', 'warning');
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const settings = getSettings();

        doc.setFont('helvetica', 'bold'); 
        doc.setFontSize(18); 
        doc.setTextColor(15, 23, 42);
        doc.text(settings.storeName.toUpperCase(), 14, 20);
        
        doc.setFont('helvetica', 'normal'); 
        doc.setFontSize(10); 
        doc.setTextColor(100, 116, 139);
        doc.text(settings.storeAddress, 14, 26);
        doc.text(`Waktu Sinkronisasi Dokumen: ${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID')}`, 14, 32);
        
        doc.setDrawColor(200); 
        doc.setLineWidth(0.5);
        doc.line(14, 36, 196, 36);

        doc.setFont('helvetica', 'bold'); 
        doc.setFontSize(13); 
        doc.setTextColor(15, 23, 42);
        doc.text('DOKUMEN LEGAL JURNAL TRANSAKSI PENJUALAN KASIR', 14, 46);
        
        const tableColumn = ["ID Faktur", "Waktu Transaksi", "Rincian Checkout (Qty)", "Pembayaran", "Operator", "Nominal Tagihan"];
        const tableRows = [];
        let grandTotalKeseluruhan = 0;

        sales.forEach(s => {
            const rincianItems = s.items.map(i => `- ${i.name} (x${i.qty})`).join('\n');
            const rowData = [
                `#INV-${String(s.id).padStart(4,'0')}`,
                s.date,
                rincianItems,
                s.paymentMethod,
                s.cashierName,
                `Rp ${s.total.toLocaleString('id-ID')}`
            ];
            tableRows.push(rowData);
            grandTotalKeseluruhan += s.total;
        });

        doc.autoTable({
            startY: 52,
            head: [tableColumn],
            body: tableRows,
            theme: 'striped',
            headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
            bodyStyles: { textColor: [30, 41, 59], valign: 'middle' },
            columnStyles: {
                0: { fontStyle: 'bold', textColor: [59, 130, 246] },
                2: { cellWidth: 55 },
                5: { halign: 'right', fontStyle: 'bold' }
            },
            styles: { fontSize: 9, cellPadding: 4 },
            alternateRowStyles: { fillColor: [248, 250, 252] }
        });

        const finalY = doc.lastAutoTable.finalY || 52;
        doc.setFillColor(241, 245, 249);
        doc.rect(14, finalY + 6, 182, 14, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(11);
        doc.text('TOTAL PENDAPATAN KESELURUHAN (BRUTO):', 20, finalY + 15);
        doc.text(`Rp ${grandTotalKeseluruhan.toLocaleString('id-ID')}`, 190, finalY + 15, { align: 'right' });

        doc.save(`Arsip_Laporan_Keuangan_ERP_${Date.now()}.pdf`);
        showToast('Valid. Dokumen Laporan PDF Profesional Berhasil Dicetak dan Diunduh.', 'success');
    };

    // ========== 11. PENGATURAN SYSTEM & DELETE HANDLER ==========
    function loadSettings() {
        const s = getSettings();
        $('storeName').value = s.storeName; $('storeAddress').value = s.storeAddress; $('taxRate').value = s.taxRate; $('newAdminPass').value = '';
    }
    $('btnSaveSettings').onclick = function() {
        const s = getSettings(); s.storeName = $('storeName').value.trim(); s.storeAddress = $('storeAddress').value.trim(); s.taxRate = parseFloat($('taxRate').value) || 0;
        saveSettings(s); showToast('Perubahan parameter profil konfigurasi bisnis diamankan.');
    };
    $('btnChangePassword').onclick = function() {
        const pass = $('newAdminPass').value.trim(); if (pass.length < 4) return showToast('Lemah. Sandi harus terdiri dari minimal 4 karakter kombinasi.', 'danger');
        const s = getSettings(); s.adminPassword = pass; saveSettings(s);
        showToast('Kunci gerbang otorisasi administrator berhasil ditimpa.'); $('newAdminPass').value = '';
    };

    function openDeleteConfirmModal(id, type) {
        $('deleteTargetId').value = id; $('deleteTargetType').value = type;
        $('deleteTargetName').textContent = `${type.toUpperCase()} ID Register #${id}`;
        $('deleteConfirmModal').classList.add('show');
    }
    
    $('btnConfirmDelete').onclick = function() {
        const id = +$('deleteTargetId').value; const type = $('deleteTargetType').value;
        if (type === 'flower') saveDB('bloom_flowers', getDB('bloom_flowers', DEFAULT_FLOWERS).filter(x => x.id !== id));
        if (type === 'crm') saveDB('bloom_crm', getDB('bloom_crm', DEFAULT_CUSTOMERS).filter(x => x.id !== id));
        if (type === 'supplier') saveDB('bloom_suppliers', getDB('bloom_suppliers', DEFAULT_SUPPLIERS).filter(x => x.id !== id));
        
        showToast(`Indeks data ${type} berhasil dimusnahkan secara permanen dari server lokal.`, 'warning');
        $('deleteConfirmModal').classList.remove('show');
        
        if (type === 'flower') renderInventoryTable();
        if (type === 'crm') renderCRMTable();
        if (type === 'supplier') renderSuppliersTable();
    };

    // ========== 12. OTENTIKASI & TRIGGER INIT ==========
    function handleLogin() {
        const user = $('loginUsername').value.trim().toLowerCase();
        const pass = $('loginPassword').value.trim();
        const settings = getSettings(); 

        const schema = { admin: settings.adminPassword || DEFAULT_SETTINGS.adminPassword, kasir: 'kasir123' };

        if (!schema[user] || pass !== schema[user]) { 
            $('loginError').textContent = 'Pelanggaran Akses: Username atau Password tidak diizinkan menembus server.'; 
            $('loginError').style.display = 'block'; return; 
        }

        showLoading();
        setTimeout(() => {
            currentUser = { role: user, name: user === 'admin' ? 'Super Administrator' : 'Staf Operator Kasir' };
            $('loginPage').style.display = 'none'; 
            $('mainContainer').classList.add('active');
            $('sidebarRole').textContent = currentUser.name; 
            $('sidebarUserLabel').textContent = user.toUpperCase();
            
            setupSidebar();
            navigateTo(user === 'admin' ? 'dashboard' : 'cashier');
            hideLoading();
        }, 500);
    }

    $('btnLogout').onclick = function() {
        currentUser = null; cart = []; heldCarts = [];
        $('mainContainer').classList.remove('active');
        $('loginPage').style.display = 'flex';
        $('loginUsername').value = ''; $('loginPassword').value = '';
        closeAllModals();
        showToast('Sesi kerja Anda telah diakhiri.', 'success');
    };

    $('btnLogin').onclick = handleLogin;
    $('loginPassword').onkeydown = e => { if (e.key === 'Enter') handleLogin(); };
    $('paymentMethod').onchange = function() { $('cashInputGroup').style.display = this.value === 'tunai' ? 'block' : 'none'; };
    
    // Auto-Hitung Live Bayar Kembalian Kasir
    $('cashReceived').oninput = function() {
        const total = parseInt($('paymentTotalDisplay').textContent.replace(/[^\d]/g, '')) || 0;
        const received = parseInt(this.value) || 0;
        const display = $('changeDisplay'); 
        if (!display) return;
        
        display.style.display = 'block';
        if (received >= total) { 
            display.innerHTML = `<i class="fa-solid fa-circle-check icon-margin"></i> Uang Kembalian Pelanggan: <strong>Rp ${(received-total).toLocaleString('id-ID')}</strong>`; 
            display.className = 'alert-box-status bg-light-emerald text-emerald'; 
        } else { 
            display.innerHTML = `<i class="fa-solid fa-circle-xmark icon-margin"></i> Defisit / Nominal Uang Kurang: <strong>Rp ${(total-received).toLocaleString('id-ID')}</strong>`; 
            display.className = 'alert-box-status bg-light-red text-red'; 
        }
    };

    // Global Key Events & Modal Escapes
    document.querySelectorAll('.modal-overlay').forEach(ov => ov.onclick = function(e) { if (e.target === this) this.classList.remove('show'); });
    document.querySelectorAll('.modal-close, .cancel-btn').forEach(b => b.onclick = () => closeAllModals());
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllModals(); });

})();
