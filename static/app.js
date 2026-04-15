/* ═══════════════════════════════════════════════
   Synkron — E-Commerce Customer Intelligence
   Frontend Application Logic — v1.0.0
   ═══════════════════════════════════════════════ */

let analysisReady = false;

const DELETE_SVG = '<i class="fas fa-trash-alt"></i>';

// ── Init ──
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const s = await fetch('/api/settings');
        const d = await s.json();
        window.storeSlug = d.store_slug || '';
    } catch(e) { window.storeSlug = ''; }
    loadStats();
});

// ═══════════════════════════════════════════════
// TAB SWITCHING
// ═══════════════════════════════════════════════

function switchTab(tabId, el) {
    document.querySelectorAll('.nav-link').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    document.getElementById(tabId).classList.add('active');
    updateSelectionBar();

    // Lazy-load tab data
    if (tabId === 'all-tab' && !document.querySelector('#all-table tbody').innerHTML.trim()) loadAllPage(1);
    if (tabId === 'miss-tab' && !document.querySelector('#miss-table tbody').innerHTML.trim()) loadMissPage(1);
    if (tabId === 'dup-tab' && analysisReady) loadAnalysisPage('duplicates', 'dup-table', 'pag-dup', 1);
    if (tabId === 'invalid-tab' && analysisReady) loadAnalysisPage('invalid', 'invalid-table', 'pag-invalid', 1);
    if (tabId === 'email-tab' && analysisReady) loadAnalysisPage('emails', 'email-table', 'pag-email', 1);

    // Show location filters only for data tabs after analysis
    const show = !['settings-tab', 'stat-tab'].includes(tabId);
    document.getElementById('loc-filters').style.display = show && analysisReady ? 'flex' : 'none';
}

// ═══════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    const color = type === 'success' ? 'success' : 'danger';
    toast.innerHTML = `<i class="fas ${icon}" style="color:var(--${color});font-size:1.2rem;"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════

function formatDate(ts) {
    if (!ts) return '-';
    const d = new Date(parseInt(ts));
    return d.getDate().toString().padStart(2, '0') + '/' +
           (d.getMonth() + 1).toString().padStart(2, '0') + '/' +
           d.getFullYear();
}

/**
 * Client-side phone normalization preview.
 * Returns the fixed phone string or false if not auto-fixable.
 */
function canAutoFix(phone) {
    if (!phone) return false;
    phone = phone.trim().replace(/[\s\-\(\)]/g, '');
    if (/^5\d{9}$/.test(phone)) return '+90' + phone;
    if (/^05\d{9}$/.test(phone)) return '+90' + phone.substring(1);
    if (/^905\d{9}$/.test(phone)) return '+' + phone;
    return false;
}

// ═══════════════════════════════════════════════
// TABLE ROW BUILDER
// ═══════════════════════════════════════════════

function buildRows(arr, phoneFormatter, emailFormatter, showAutoFix) {
    if (!arr || arr.length === 0) {
        return '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:40px;">Kayıt bulunamadı.</td></tr>';
    }
    return arr.map(c => {
        const phone = (c.phone || '').trim();
        const fixResult = canAutoFix(phone);
        const fixBtn = showAutoFix && fixResult
            ? `<button class="fix-btn" onclick="autoFixPhone('${c.id}', this)" title="Düzelt: ${fixResult}"><i class="fas fa-magic"></i></button>`
            : '';
        return `
        <tr data-city="${c.city || '-'}" data-district="${c.district || '-'}" data-id="${c.id}">
            <td style="width:40px;"><label class="w-container"><input type="checkbox" class="row-check" value="${c.id}" onchange="updateSelectionBar()"/><div class="w-checkmark"></div></label></td>
            <td>
                <div style="display:flex; align-items:center; gap:10px;">
                    <a href="https://${window.storeSlug}.myikas.com/admin/customer/view/${c.id}" target="_blank" class="profile-link" title="İkas Profiline Git" ${!window.storeSlug ? 'style="opacity:0.3;pointer-events:none;" title="Önce Ayarlardan mağaza slug girin"' : ''}><i class="fas fa-external-link-alt"></i></a>
                    <span>${c.firstName || ''} ${c.lastName || ''}</span>
                </div>
            </td>
            <td style="color:var(--text-muted)">${emailFormatter(c)}</td>
            <td>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span>${phoneFormatter(c)}</span>
                    ${phone ? `<button class="copy-btn" onclick="navigator.clipboard.writeText('${phone.replace(/<[^>]+>/g, '')}'); showToast('Kopyalandı: ' + '${phone.replace(/<[^>]+>/g, '')}', 'success')" title="Numarayı Kopyala"><i class="fas fa-copy"></i></button>` : ''}
                </div>
            </td>
            <td style="color:var(--text-muted);font-size:0.8rem;">${c.city || '-'} / ${c.district || '-'}</td>
            <td style="color:var(--text-muted);font-size:0.85rem;">${formatDate(c.createdAt)}</td>
            <td>
                <div class="form-group">
                    <input type="text" class="input-dark" id="input-${c.id}" placeholder="+905555555555" maxlength="13" oninput="this.value=this.value.replace(/[^0-9+]/g,'')">
                    <button class="save-btn" onclick="updateCustomer('${c.id}','input-${c.id}', this)" title="Kaydet"><i class="fas fa-check"></i></button>
                    ${fixBtn}
                    <button class="delete-button" onclick="deleteSingleCustomer('${c.id}', this)" title="Kalıcı Olarak Sil">${DELETE_SVG}</button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function buildPagination(containerId, page, hasNext, count, callback) {
    const totalPages = Math.ceil(count / 50) || 1;
    document.getElementById(containerId).innerHTML = `
        <button class="page-btn" onclick="${callback}(${page - 1})" ${page <= 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>
        <span class="page-info">Sayfa ${page} / ${totalPages} &nbsp;(${count.toLocaleString()} kayıt)</span>
        <button class="page-btn" onclick="${callback}(${page + 1})" ${!hasNext ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>
    `;
}

// ═══════════════════════════════════════════════
// 1) STATS (instant count-only queries)
// ═══════════════════════════════════════════════

async function loadStats() {
    try {
        const r = await fetch('/api/stats');
        const d = await r.json();
        if (d.success) {
            document.getElementById('stat-total').innerText = d.total.toLocaleString();
            document.getElementById('stat-miss').innerText = d.missing.toLocaleString();
            document.getElementById('stat-invalid').innerText = d.invalid !== '?' ? d.invalid.toLocaleString() : '?';
            document.getElementById('stat-dup').innerText = d.duplicates !== '?' ? d.duplicates.toLocaleString() : '?';
            document.getElementById('all-count').innerText = d.total.toLocaleString();
            document.getElementById('miss-count').innerText = d.missing.toLocaleString();
        }
    } catch (e) { console.error(e); }
}

// ═══════════════════════════════════════════════
// 2) ALL CUSTOMERS (paginated + searchable)
// ═══════════════════════════════════════════════

async function loadAllPage(page) {
    const search = (document.getElementById('search-all').value || '').trim();
    const url = `/api/customers/all?page=${page}` + (search ? `&search=${encodeURIComponent(search)}` : '');
    try {
        const r = await fetch(url);
        const d = await r.json();
        if (d.success) {
            document.querySelector('#all-table tbody').innerHTML = buildRows(d.data, c => c.phone || '-', c => c.email || '');
            buildPagination('pag-all', d.page, d.hasNext, d.count, 'loadAllPage');
            document.getElementById('all-count').innerText = d.count.toLocaleString();
        } else showToast(d.error, 'error');
    } catch (e) { showToast('Ağ hatası', 'error'); }
}

function searchAll() { loadAllPage(1); }

// ═══════════════════════════════════════════════
// 3) MISSING PHONES (server-filtered)
// ═══════════════════════════════════════════════

async function loadMissPage(page) {
    try {
        const r = await fetch(`/api/customers/missing?page=${page}`);
        const d = await r.json();
        if (d.success) {
            document.querySelector('#miss-table tbody').innerHTML = buildRows(d.data, c => '-', c => c.email || '');
            buildPagination('pag-miss', d.page, d.hasNext, d.count, 'loadMissPage');
            document.getElementById('miss-count').innerText = d.count;
        } else showToast(d.error, 'error');
    } catch (e) { showToast('Ağ hatası', 'error'); }
}

// ═══════════════════════════════════════════════
// 4) ANALYSIS TABS (duplicates / invalid / emails)
// ═══════════════════════════════════════════════

/** Global navigation function for analysis tab pagination */
function navAnalysis(tab, page) {
    const config = {
        'duplicates': ['dup-table', 'pag-dup'],
        'invalid':    ['invalid-table', 'pag-invalid'],
        'emails':     ['email-table', 'pag-email']
    };
    const [tableId, pagId] = config[tab];
    loadAnalysisPage(tab, tableId, pagId, page);
}

async function loadAnalysisPage(tab, tableId, pagId, page) {
    try {
        const r = await fetch(`/api/analyze/results/${tab}?page=${page}`);
        const d = await r.json();
        if (d.success) {
            const phoneF = (tab === 'invalid' || tab === 'duplicates')
                ? c => `<span class="highlight">${c.phone}</span>`
                : c => c.phone || '';
            const emailF = tab === 'emails'
                ? c => `<span class="highlight">${c.email}</span>`
                : c => c.email || '';
            const showAutoFix = (tab === 'invalid');

            document.querySelector(`#${tableId} tbody`).innerHTML = buildRows(d.data, phoneF, emailF, showAutoFix);
            buildPagination(pagId, d.page, d.hasNext, d.count, `navAnalysis.bind(null,'${tab}')`);

            // Build location filters from analysis data
            if (d.cities && d.cities.length > 0) buildLocFilters(d.cities, d.districts);

            // Show/hide bulk auto-fix bar for invalid tab
            const fixBar = document.getElementById('auto-fix-bar');
            if (fixBar) {
                if (tab === 'invalid' && d.count > 0) {
                    fixBar.style.display = 'flex';
                    document.getElementById('fixable-count').innerText = d.count;
                } else {
                    fixBar.style.display = 'none';
                }
            }
        } else showToast(d.error, 'error');
    } catch (e) { showToast('Ağ hatası', 'error'); }
}

// ═══════════════════════════════════════════════
// 5) DEEP ANALYSIS (background worker)
// ═══════════════════════════════════════════════

async function startAnalysis() {
    const btn = document.getElementById('fetch-btn');
    btn.disabled = true;
    btn.innerHTML = '<div class="analyze-btn-icon"><i class="fas fa-spinner fa-spin"></i></div> <span>Analiz Çalışıyor...</span>';

    // Show loading overlay
    document.getElementById('loading-overlay').style.display = 'flex';
    document.getElementById('progress-fill').style.width = '0%';
    document.getElementById('progress-label').innerText = 'Başlatılıyor...';

    // Reset to stats tab
    document.querySelectorAll('.nav-link').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('.nav-link[onclick*="stat-tab"]').classList.add('active');
    document.getElementById('stat-tab').classList.add('active');

    try {
        await fetch('/api/analyze', { method: 'POST' });

        const poll = setInterval(async () => {
            try {
                const r = await fetch('/api/analyze/status');
                const d = await r.json();

                document.getElementById('progress-fill').style.width = d.progress + '%';
                document.getElementById('progress-thumb').style.left = d.progress + '%';
                document.getElementById('progress-label').innerText =
                    `Sayfa ${d.fetched} / ${d.total} işlendi — %${d.progress}`;

                if (d.status === 'done') {
                    clearInterval(poll);
                    document.getElementById('loading-overlay').style.display = 'none';
                    btn.disabled = false;
                    btn.innerHTML = '<div class="analyze-btn-icon"><i class="fas fa-bolt"></i></div> <span>Derin Analiz Başlat</span>';
                    analysisReady = true;

                    // Update sidebar badges
                    document.getElementById('dup-count').innerText = d.dup_count;
                    document.getElementById('invalid-count').innerText = d.inv_count;
                    document.getElementById('email-count').innerText = d.dem_count;

                    // Reveal analysis tabs
                    ['dup', 'invalid', 'email'].forEach(t => {
                        const need = document.getElementById(t + '-need');
                        const card = document.getElementById(t + '-card');
                        if (need) need.style.display = 'none';
                        if (card) card.style.display = 'block';
                    });

                    loadStats();
                    showToast(`Analiz tamamlandı! Kopya: ${d.dup_count}, Hatalı: ${d.inv_count}, Aynı Mail: ${d.dem_count}`, 'success');
                } else if (d.status === 'error') {
                    clearInterval(poll);
                    document.getElementById('loading-overlay').style.display = 'none';
                    btn.disabled = false;
                    btn.innerHTML = '<div class="analyze-btn-icon"><i class="fas fa-bolt"></i></div> <span>Derin Analiz Başlat</span>';
                    showToast(d.error || 'Analiz hatası', 'error');
                }
            } catch (e) { /* polling error, retry next tick */ }
        }, 2000);
    } catch (e) {
        showToast('Ağ hatası', 'error');
        btn.disabled = false;
        btn.innerHTML = '<div class="analyze-btn-icon"><i class="fas fa-bolt"></i></div> <span>Derin Analiz Başlat</span>';
    }
}

// ═══════════════════════════════════════════════
// LOCATION FILTERS
// ═══════════════════════════════════════════════

function buildLocFilters(cities, districts) {
    const csel = document.getElementById('city-select');
    const dsel = document.getElementById('dist-select');
    csel.innerHTML = '<option value="">Tüm İller</option>' +
        cities.filter(c => c !== '-').map(c => `<option value="${c}">${c}</option>`).join('');
    dsel.innerHTML = '<option value="">Tüm İlçeler</option>' +
        districts.filter(d => d !== '-').map(d => `<option value="${d}">${d}</option>`).join('');
}

function applyClientFilter() {
    const csel = document.getElementById('city-select').value;
    const dsel = document.getElementById('dist-select').value;
    document.querySelectorAll('.tab-content.active table tbody tr').forEach(row => {
        if (row.children.length === 1) return; // skip "no data" row
        const c = row.getAttribute('data-city');
        const d = row.getAttribute('data-district');
        row.style.display = ((!csel || c === csel) && (!dsel || d === dsel)) ? '' : 'none';
    });
    updateSelectionBar();
}

// ═══════════════════════════════════════════════
// SELECTION & BULK DELETE
// ═══════════════════════════════════════════════

function toggleAll(cb, tableId) {
    document.querySelectorAll(`#${tableId} tbody tr`).forEach(r => {
        if (r.style.display !== 'none') {
            const check = r.querySelector('.row-check');
            if (check) check.checked = cb.checked;
        }
    });
    updateSelectionBar();
}

function updateSelectionBar() {
    const activeTab = document.querySelector('.tab-content.active');
    if (!activeTab) return;
    let n = 0;
    activeTab.querySelectorAll('.row-check:checked').forEach(c => {
        if (c.closest('tr').style.display !== 'none') n++;
    });
    const bar = document.getElementById('bulk-action-bar');
    if (n > 0) {
        document.getElementById('sel-count').innerText = n;
        bar.classList.add('show');
    } else {
        bar.classList.remove('show');
    }
}

async function bulkDelete() {
    const activeTab = document.querySelector('.tab-content.active');
    const ids = [];
    activeTab.querySelectorAll('.row-check:checked').forEach(c => {
        if (c.closest('tr').style.display !== 'none') ids.push(c.value);
    });
    if (ids.length === 0) return;

    if (!confirm(`DİKKAT: Seçili ${ids.length} müşteriyi kalıcı olarak silmek üzeresiniz.\nBu işlem geri alınamaz.\n\nEmin misiniz?`)) return;

    try {
        const res = await fetch('/api/delete_customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
        });
        const dat = await res.json();
        if (dat.success) {
            showToast(`${ids.length} müşteri silindi!`, 'success');
            activeTab.querySelectorAll('.row-check:checked').forEach(c => {
                if (c.closest('tr').style.display !== 'none') c.closest('tr').remove();
            });
            updateSelectionBar();
            loadStats();
        } else showToast(dat.error, 'error');
    } catch (e) { showToast('Ağ hatası', 'error'); }
}

async function deleteSingleCustomer(id, btnEl) {
    if (!confirm('DİKKAT: Bu müşteriyi kalıcı olarak silmek üzeresiniz.\nBu işlem geri alınamaz.\n\nEmin misiniz?')) return;

    const tr = btnEl.closest('tr');
    btnEl.innerHTML = '<i class="fas fa-spinner fa-spin" style="color:var(--text-muted);"></i>';
    try {
        const res = await fetch('/api/delete_customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: [id] })
        });
        const dat = await res.json();
        if (dat.success) {
            showToast('Müşteri silindi!', 'success');
            tr.remove();
            updateSelectionBar();
            loadStats();
        } else {
            showToast(dat.error, 'error');
            btnEl.innerHTML = DELETE_SVG;
        }
    } catch (e) {
        showToast('Ağ hatası', 'error');
        btnEl.innerHTML = DELETE_SVG;
    }
}

// ═══════════════════════════════════════════════
// PHONE UPDATE (manual)
// ═══════════════════════════════════════════════

async function updateCustomer(id, inputId, btn) {
    const val = document.getElementById(inputId).value;
    if (!val || val.length !== 13) {
        showToast('+905555555555 formatında 13 hane olmalı.', 'error');
        return;
    }
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    try {
        const res = await fetch('/api/update_phone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, phone: val })
        });
        const dat = await res.json();
        if (dat.success) showToast('Güncellendi!', 'success');
        else showToast(dat.error, 'error');
    } catch (e) { showToast('Hata', 'error'); }
    btn.innerHTML = '<i class="fas fa-check"></i>';
}

// ═══════════════════════════════════════════════
// PHONE AUTO-FIX (automation)
// ═══════════════════════════════════════════════

/**
 * Auto-fix a single customer's phone number.
 * Rules:
 *   5XXXXXXXXX   → +905XXXXXXXXX
 *   05XXXXXXXXX  → +905XXXXXXXXX
 *   905XXXXXXXXX → +905XXXXXXXXX
 */
async function autoFixPhone(id, btnEl) {
    btnEl.disabled = true;
    btnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    try {
        const res = await fetch('/api/auto_fix_phone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        const dat = await res.json();
        if (dat.success) {
            showToast(`Düzeltildi: ${dat.old_phone} → ${dat.new_phone}`, 'success');
            const tr = btnEl.closest('tr');
            tr.style.transition = 'opacity 0.5s';
            tr.style.opacity = '0.3';
            tr.style.pointerEvents = 'none';
            setTimeout(() => tr.remove(), 800);
        } else {
            showToast(dat.error || 'Düzeltilemedi', 'error');
            btnEl.disabled = false;
            btnEl.innerHTML = '<i class="fas fa-magic"></i>';
        }
    } catch (e) {
        showToast('Ağ hatası', 'error');
        btnEl.disabled = false;
        btnEl.innerHTML = '<i class="fas fa-magic"></i>';
    }
}

/** Bulk auto-fix all fixable phone numbers */
async function bulkAutoFix() {
    const btn = document.getElementById('bulk-fix-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> İşleniyor...';

    try {
        const res = await fetch('/api/bulk_auto_fix', { method: 'POST' });
        const dat = await res.json();
        if (dat.success) {
            const msg = `✅ ${dat.fixed} düzeltildi | ⏭ ${dat.skipped} atlandı | ❌ ${dat.errors} hata`;
            showToast(msg, dat.errors > 0 ? 'error' : 'success');
            // Reload analysis data
            loadAnalysisPage('invalid', 'invalid-table', 'pag-invalid', 1);
            loadStats();
        } else {
            showToast(dat.error || 'Toplu düzeltme hatası', 'error');
        }
    } catch (e) { showToast('Ağ hatası', 'error'); }

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-magic"></i> Tümünü Otomatik Düzelt';
}

// ═══════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════

async function loadSettings() {
    try {
        const res = await fetch('/api/settings');
        const d = await res.json();
        document.getElementById('cfg-client-id').value = d.client_id || '';
        document.getElementById('cfg-client-secret').value = d.client_secret || '';
        document.getElementById('cfg-store-slug').value = d.store_slug || '';
    } catch (e) { /* silent */ }
}

async function saveSettings() {
    const id = document.getElementById('cfg-client-id').value;
    const secret = document.getElementById('cfg-client-secret').value;
    const slug = document.getElementById('cfg-store-slug').value;
    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id: id, client_secret: secret, store_slug: slug })
        });
        const d = await res.json();
        if (d.success) {
            window.storeSlug = slug || '';
            showToast('Ayarlar kaydedildi!', 'success');
        } else showToast('Hata', 'error');
    } catch (e) { showToast('Ağ hatası', 'error'); }
}
