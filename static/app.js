/* Synkron - Frontend Application Logic - v1.1.0 */

let analysisReady = false;
let rowInputCounter = 0;

const DELETE_ICON = 'fas fa-trash-alt';
const DEFAULT_STORE_SLUG = normalizeStoreSlug((window.appConfig && window.appConfig.storeSlug) || 'voidtrcom');
const API_RATE_LIMIT = (window.appConfig && window.appConfig.apiRateLimit) || null;
const settingsState = {
    secretConfigured: false
};

window.addEventListener('DOMContentLoaded', async () => {
    window.storeSlug = DEFAULT_STORE_SLUG;
    renderApiLimitInfo();

    try {
        const response = await fetch('/api/settings');
        const data = await response.json();
        window.storeSlug = normalizeStoreSlug(data.store_slug || DEFAULT_STORE_SLUG);
        updateSecretStatus(Boolean(data.secret_configured));
    } catch (error) {
        window.storeSlug = DEFAULT_STORE_SLUG;
    }

    loadStats();
});

function switchTab(tabId, el) {
    document.querySelectorAll('.nav-link').forEach((tab) => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((content) => content.classList.remove('active'));
    el.classList.add('active');
    document.getElementById(tabId).classList.add('active');
    updateSelectionBar();

    if (tabId === 'all-tab' && !document.querySelector('#all-table tbody').children.length) loadAllPage(1);
    if (tabId === 'miss-tab' && !document.querySelector('#miss-table tbody').children.length) loadMissPage(1);
    if (tabId === 'dup-tab' && analysisReady) loadAnalysisPage('duplicates', 'dup-table', 'pag-dup', 1);
    if (tabId === 'invalid-tab' && analysisReady) loadAnalysisPage('invalid', 'invalid-table', 'pag-invalid', 1);
    if (tabId === 'email-tab' && analysisReady) loadAnalysisPage('emails', 'email-table', 'pag-email', 1);

    const showFilters = !['settings-tab', 'stat-tab'].includes(tabId);
    document.getElementById('loc-filters').style.display = showFilters && analysisReady ? 'flex' : 'none';
}

function normalizeStoreSlug(slug) {
    const normalized = String(slug || '').trim().toLowerCase();
    return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(normalized) ? normalized : 'voidtrcom';
}

function isValidStoreSlug(slug) {
    return normalizeStoreSlug(slug) === String(slug || '').trim().toLowerCase();
}

function renderApiLimitInfo() {
    if (!API_RATE_LIMIT) return;

    const limitText = document.getElementById('api-limit-text');
    const delayText = document.getElementById('api-limit-delay');
    const timeoutText = document.getElementById('api-limit-timeout');

    if (!limitText || !delayText || !timeoutText) return;

    limitText.textContent =
        `Derin analiz ve toplu düzeltme işlemleri yaklaşık ${API_RATE_LIMIT.max_requests} istek / ${API_RATE_LIMIT.window_seconds} saniye sınırına göre yavaşlatılır.`;
    delayText.textContent = `İstek aralığı: ${API_RATE_LIMIT.safe_delay_ms} ms`;
    timeoutText.textContent =
        `Timeout: ${API_RATE_LIMIT.connect_timeout_seconds}s bağlanma / ${API_RATE_LIMIT.read_timeout_seconds}s yanıt`;
}

function updateSecretStatus(secretConfigured) {
    settingsState.secretConfigured = secretConfigured;

    const hint = document.getElementById('cfg-secret-status');
    const newSecret = document.getElementById('cfg-client-secret');

    if (!hint || !newSecret) return;

    if (secretConfigured) {
        hint.textContent = 'Mevcut secret sistemde kayıtlı. Yeni CLIENT_SECRET girerseniz mevcut değer güncellenir; alanı boş bırakırsanız mevcut secret korunur.';
        newSecret.placeholder = 'Boş bırakılırsa mevcut secret korunur';
    } else {
        hint.textContent = 'Henüz kayıtlı bir secret yok. İlk kurulumda sadece yeni CLIENT_SECRET girmeniz yeterli.';
        newSecret.placeholder = 'Yeni CLIENT_SECRET girin';
    }
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const icon = document.createElement('i');
    const text = document.createElement('span');

    toast.className = `toast ${type}`;
    icon.className = `fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`;
    icon.style.fontSize = '1.2rem';
    text.textContent = String(message || '');

    toast.append(icon, text);
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function formatDate(ts) {
    if (!ts) return '-';

    const parsed = Number.parseInt(ts, 10);
    if (Number.isNaN(parsed)) return '-';

    const date = new Date(parsed);
    if (Number.isNaN(date.getTime())) return '-';

    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function canAutoFix(phone) {
    if (!phone) return false;
    const normalized = String(phone).trim().replace(/[\s\-()]/g, '');
    if (/^5\d{9}$/.test(normalized)) return `+90${normalized}`;
    if (/^05\d{9}$/.test(normalized)) return `+90${normalized.substring(1)}`;
    if (/^905\d{9}$/.test(normalized)) return `+${normalized}`;
    return false;
}

function createIcon(iconClass) {
    const icon = document.createElement('i');
    icon.className = iconClass;
    return icon;
}

function createActionButton(className, iconClass, title, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.title = title;
    button.appendChild(createIcon(iconClass));
    button.addEventListener('click', onClick);
    return button;
}

function createDisplayNode(info) {
    const options = info || {};
    const value = options.text == null || options.text === '' ? (options.fallback || '-') : String(options.text);
    const node = document.createElement(options.highlight && value !== '-' ? 'span' : 'span');

    if (options.highlight && value !== '-') node.className = 'highlight';
    node.textContent = value;
    return node;
}

function createEmptyRow() {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 7;
    cell.style.textAlign = 'center';
    cell.style.color = 'var(--muted-foreground)';
    cell.style.padding = '40px';
    cell.textContent = 'Kayıt bulunamadı.';
    row.appendChild(cell);
    return row;
}

function createSelectionCell(customerId) {
    const cell = document.createElement('td');
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    const mark = document.createElement('div');

    cell.style.width = '40px';
    label.className = 'w-container';
    checkbox.type = 'checkbox';
    checkbox.className = 'row-check';
    checkbox.value = customerId;
    checkbox.addEventListener('change', updateSelectionBar);
    mark.className = 'w-checkmark';

    label.append(checkbox, mark);
    cell.appendChild(label);
    return cell;
}

function createNameCell(customer, customerId) {
    const cell = document.createElement('td');
    const wrapper = document.createElement('div');
    const link = document.createElement('a');
    const name = document.createElement('span');
    const fullName = [customer.firstName, customer.lastName]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .join(' ') || '-';

    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '10px';

    link.href = `https://${normalizeStoreSlug(window.storeSlug)}.myikas.com/admin/customer/view/${encodeURIComponent(customerId)}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'profile-link';
    link.title = 'İkas Profiline Git';
    link.appendChild(createIcon('fas fa-external-link-alt'));

    name.textContent = fullName;
    wrapper.append(link, name);
    cell.appendChild(wrapper);
    return cell;
}

function createValueCell(info, colorMuted = false) {
    const cell = document.createElement('td');
    if (colorMuted) cell.style.color = 'var(--muted-foreground)';
    cell.appendChild(createDisplayNode(info));
    return cell;
}

function createPhoneCell(customer, phoneInfo) {
    const cell = document.createElement('td');
    const wrapper = document.createElement('div');
    const phone = String(customer.phone || '').trim();

    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '8px';
    wrapper.appendChild(createDisplayNode(phoneInfo));

    if (phone) {
        const copyButton = createActionButton('copy-btn', 'fas fa-copy', 'Numarayı Kopyala', async () => {
            try {
                await navigator.clipboard.writeText(phone);
                showToast(`Kopyalandı: ${phone}`, 'success');
            } catch (error) {
                showToast('Kopyalama başarısız', 'error');
            }
        });
        wrapper.appendChild(copyButton);
    }

    cell.appendChild(wrapper);
    return cell;
}

function createLocationCell(customer) {
    const cell = document.createElement('td');
    cell.style.color = 'var(--muted-foreground)';
    cell.style.fontSize = '0.8rem';
    cell.textContent = `${customer.city || '-'} / ${customer.district || '-'}`;
    return cell;
}

function createDateCell(customer) {
    const cell = document.createElement('td');
    cell.style.color = 'var(--muted-foreground)';
    cell.style.fontSize = '0.85rem';
    cell.textContent = formatDate(customer.createdAt);
    return cell;
}

function createActionsCell(customerId, showAutoFix, phone) {
    const cell = document.createElement('td');
    const group = document.createElement('div');
    const input = document.createElement('input');
    const inputId = `input-${++rowInputCounter}`;
    const fixResult = canAutoFix(phone);

    group.className = 'form-group';

    input.type = 'text';
    input.className = 'input-dark';
    input.id = inputId;
    input.placeholder = '+905555555555';
    input.maxLength = 13;
    input.addEventListener('input', () => {
        input.value = input.value.replace(/[^0-9+]/g, '');
    });

    group.appendChild(input);
    group.appendChild(
        createActionButton('save-btn', 'fas fa-check', 'Kaydet', (event) => {
            updateCustomer(customerId, inputId, event.currentTarget);
        })
    );

    if (showAutoFix && fixResult) {
        group.appendChild(
            createActionButton('fix-btn', 'fas fa-magic', `Düzelt: ${fixResult}`, (event) => {
                autoFixPhone(customerId, event.currentTarget);
            })
        );
    }

    group.appendChild(
        createActionButton('delete-button', DELETE_ICON, 'Kalıcı Olarak Sil', (event) => {
            deleteSingleCustomer(customerId, event.currentTarget);
        })
    );

    cell.appendChild(group);
    return cell;
}

function createCustomerRow(customer, phoneInfo, emailInfo, showAutoFix) {
    const customerId = String(customer.id || '');
    const row = document.createElement('tr');

    row.dataset.city = customer.city || '-';
    row.dataset.district = customer.district || '-';
    row.dataset.id = customerId;

    row.appendChild(createSelectionCell(customerId));
    row.appendChild(createNameCell(customer, customerId));
    row.appendChild(createValueCell(emailInfo, true));
    row.appendChild(createPhoneCell(customer, phoneInfo));
    row.appendChild(createLocationCell(customer));
    row.appendChild(createDateCell(customer));
    row.appendChild(createActionsCell(customerId, showAutoFix, customer.phone));

    return row;
}

function buildRows(rows, phoneFormatter, emailFormatter, showAutoFix = false) {
    if (!rows || rows.length === 0) return [createEmptyRow()];
    return rows.map((customer) => createCustomerRow(customer, phoneFormatter(customer), emailFormatter(customer), showAutoFix));
}

function renderTableBody(tableId, rows) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    tbody.replaceChildren(...rows);
}

function createPageButton(disabled, iconClass, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'page-btn';
    button.disabled = disabled;
    button.appendChild(createIcon(iconClass));
    if (!disabled) button.addEventListener('click', onClick);
    return button;
}

function buildPagination(containerId, page, hasNext, count, callback, pageSize = 50) {
    const container = document.getElementById(containerId);
    const info = document.createElement('span');
    const totalPages = Math.max(1, Math.ceil(count / pageSize));

    container.replaceChildren();
    info.className = 'page-info';
    info.textContent = `Sayfa ${page} / ${totalPages} (${count.toLocaleString()} kayıt)`;

    container.appendChild(
        createPageButton(page <= 1, 'fas fa-chevron-left', () => callback(page - 1))
    );
    container.appendChild(info);
    container.appendChild(
        createPageButton(!hasNext, 'fas fa-chevron-right', () => callback(page + 1))
    );
}

async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        if (!data.success) return;

        document.getElementById('stat-total').innerText = data.total.toLocaleString();
        document.getElementById('stat-miss').innerText = data.missing.toLocaleString();
        document.getElementById('stat-invalid').innerText = data.invalid !== '?' ? data.invalid.toLocaleString() : '?';
        document.getElementById('stat-dup').innerText = data.duplicates !== '?' ? data.duplicates.toLocaleString() : '?';
        document.getElementById('all-count').innerText = data.total.toLocaleString();
        document.getElementById('miss-count').innerText = data.missing.toLocaleString();
    } catch (error) {
        console.error(error);
    }
}

async function loadAllPage(page) {
    const search = String(document.getElementById('search-all').value || '').trim();
    const url = `/api/customers/all?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        if (!data.success) {
            showToast(data.error, 'error');
            return;
        }

        renderTableBody(
            'all-table',
            buildRows(
                data.data,
                (customer) => ({ text: customer.phone || '-', fallback: '-' }),
                (customer) => ({ text: customer.email || '-', fallback: '-' })
            )
        );
        buildPagination('pag-all', data.page, data.hasNext, data.count, loadAllPage, 50);
        document.getElementById('all-count').innerText = data.count.toLocaleString();
    } catch (error) {
        showToast('Ağ hatası', 'error');
    }
}

function searchAll() {
    loadAllPage(1);
}

async function loadMissPage(page) {
    try {
        const response = await fetch(`/api/customers/missing?page=${page}`);
        const data = await response.json();
        if (!data.success) {
            showToast(data.error, 'error');
            return;
        }

        renderTableBody(
            'miss-table',
            buildRows(
                data.data,
                () => ({ text: '-', fallback: '-' }),
                (customer) => ({ text: customer.email || '-', fallback: '-' })
            )
        );
        buildPagination('pag-miss', data.page, data.hasNext, data.count, loadMissPage, 200);
        document.getElementById('miss-count').innerText = data.count.toLocaleString();
    } catch (error) {
        showToast('Ağ hatası', 'error');
    }
}

async function loadAnalysisPage(tab, tableId, paginationId, page) {
    try {
        const response = await fetch(`/api/analyze/results/${tab}?page=${page}`);
        const data = await response.json();
        if (!data.success) {
            showToast(data.error, 'error');
            return;
        }

        const phoneFormatter = (tab === 'invalid' || tab === 'duplicates')
            ? (customer) => ({ text: customer.phone || '-', fallback: '-', highlight: true })
            : (customer) => ({ text: customer.phone || '-', fallback: '-' });
        const emailFormatter = tab === 'emails'
            ? (customer) => ({ text: customer.email || '-', fallback: '-', highlight: true })
            : (customer) => ({ text: customer.email || '-', fallback: '-' });

        renderTableBody(tableId, buildRows(data.data, phoneFormatter, emailFormatter, tab === 'invalid'));
        buildPagination(paginationId, data.page, data.hasNext, data.count, (nextPage) => {
            loadAnalysisPage(tab, tableId, paginationId, nextPage);
        }, 50);

        if (data.cities && data.cities.length > 0) buildLocFilters(data.cities, data.districts || []);

        const fixBar = document.getElementById('auto-fix-bar');
        if (fixBar) {
            if (tab === 'invalid' && data.count > 0) {
                fixBar.style.display = 'flex';
                document.getElementById('fixable-count').innerText = data.count.toLocaleString();
            } else {
                fixBar.style.display = 'none';
            }
        }
    } catch (error) {
        showToast('Ağ hatası', 'error');
    }
}

async function startAnalysis() {
    const button = document.getElementById('fetch-btn');

    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analiz Çalışıyor...';

    document.getElementById('loading-overlay').style.display = 'flex';
    document.getElementById('progress-fill').style.width = '0%';
    document.getElementById('progress-thumb').style.left = '0%';
    document.getElementById('progress-label').innerText = 'Başlatılıyor...';

    document.querySelectorAll('.nav-link').forEach((tab) => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((content) => content.classList.remove('active'));
    document.querySelector('.nav-link[onclick*="stat-tab"]').classList.add('active');
    document.getElementById('stat-tab').classList.add('active');

    try {
        const startResponse = await fetch('/api/analyze', { method: 'POST' });
        const startData = await startResponse.json();
        if (!startData.success) throw new Error(startData.error || 'Analiz başlatılamadı');

        const poll = setInterval(async () => {
            try {
                const response = await fetch('/api/analyze/status');
                const data = await response.json();

                document.getElementById('progress-fill').style.width = `${data.progress}%`;
                document.getElementById('progress-thumb').style.left = `${data.progress}%`;
                document.getElementById('progress-label').innerText = `Sayfa ${data.fetched} / ${data.total} işlendi - %${data.progress}`;

                if (data.status === 'done') {
                    clearInterval(poll);
                    document.getElementById('loading-overlay').style.display = 'none';
                    button.disabled = false;
                    button.innerHTML = '<i class="fas fa-bolt"></i> Derin Analiz Başlat';
                    analysisReady = true;

                    document.getElementById('dup-count').innerText = data.dup_count;
                    document.getElementById('invalid-count').innerText = data.inv_count;
                    document.getElementById('email-count').innerText = data.dem_count;

                    ['dup', 'invalid', 'email'].forEach((prefix) => {
                        const need = document.getElementById(`${prefix}-need`);
                        const card = document.getElementById(`${prefix}-card`);
                        if (need) need.style.display = 'none';
                        if (card) card.style.display = 'block';
                    });

                    loadStats();
                    showToast(`Analiz tamamlandı. Kopya: ${data.dup_count}, Hatalı: ${data.inv_count}, Aynı Mail: ${data.dem_count}`, 'success');
                } else if (data.status === 'error') {
                    clearInterval(poll);
                    document.getElementById('loading-overlay').style.display = 'none';
                    button.disabled = false;
                    button.innerHTML = '<i class="fas fa-bolt"></i> Derin Analiz Başlat';
                    showToast(data.error || 'Analiz hatası', 'error');
                }
            } catch (error) {
                // Polling error, next interval will retry.
            }
        }, 2000);
    } catch (error) {
        showToast(error.message || 'Ağ hatası', 'error');
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-bolt"></i> Derin Analiz Başlat';
        document.getElementById('loading-overlay').style.display = 'none';
    }
}

function buildLocFilters(cities, districts) {
    const citySelect = document.getElementById('city-select');
    const districtSelect = document.getElementById('dist-select');
    const selectedCity = citySelect.value;
    const selectedDistrict = districtSelect.value;

    citySelect.replaceChildren();
    districtSelect.replaceChildren();

    const defaultCity = document.createElement('option');
    defaultCity.value = '';
    defaultCity.textContent = 'Tüm İller';
    citySelect.appendChild(defaultCity);

    const defaultDistrict = document.createElement('option');
    defaultDistrict.value = '';
    defaultDistrict.textContent = 'Tüm İlçeler';
    districtSelect.appendChild(defaultDistrict);

    cities.filter((city) => city !== '-').forEach((city) => {
        const option = document.createElement('option');
        option.value = city;
        option.textContent = city;
        citySelect.appendChild(option);
    });

    districts.filter((district) => district !== '-').forEach((district) => {
        const option = document.createElement('option');
        option.value = district;
        option.textContent = district;
        districtSelect.appendChild(option);
    });

    if ([...citySelect.options].some((option) => option.value === selectedCity)) citySelect.value = selectedCity;
    if ([...districtSelect.options].some((option) => option.value === selectedDistrict)) districtSelect.value = selectedDistrict;
}

function applyClientFilter() {
    const city = document.getElementById('city-select').value;
    const district = document.getElementById('dist-select').value;

    document.querySelectorAll('.tab-content.active table tbody tr').forEach((row) => {
        if (row.children.length === 1) return;
        const matchesCity = !city || row.dataset.city === city;
        const matchesDistrict = !district || row.dataset.district === district;
        row.style.display = matchesCity && matchesDistrict ? '' : 'none';
    });

    updateSelectionBar();
}

function toggleAll(checkbox, tableId) {
    document.querySelectorAll(`#${tableId} tbody tr`).forEach((row) => {
        if (row.style.display === 'none') return;
        const rowCheckbox = row.querySelector('.row-check');
        if (rowCheckbox) rowCheckbox.checked = checkbox.checked;
    });
    updateSelectionBar();
}

function updateSelectionBar() {
    const activeTab = document.querySelector('.tab-content.active');
    if (!activeTab) return;

    let selectedCount = 0;
    activeTab.querySelectorAll('.row-check:checked').forEach((checkbox) => {
        if (checkbox.closest('tr').style.display !== 'none') selectedCount += 1;
    });

    const bar = document.getElementById('bulk-action-bar');
    if (selectedCount > 0) {
        document.getElementById('sel-count').innerText = selectedCount;
        bar.classList.add('show');
    } else {
        bar.classList.remove('show');
    }
}

async function bulkDelete() {
    const activeTab = document.querySelector('.tab-content.active');
    const ids = [];

    activeTab.querySelectorAll('.row-check:checked').forEach((checkbox) => {
        if (checkbox.closest('tr').style.display !== 'none') ids.push(checkbox.value);
    });

    if (ids.length === 0) return;
    if (!confirm(`DİKKAT: Seçili ${ids.length} müşteriyi kalıcı olarak silmek üzeresiniz.\nBu işlem geri alınamaz.\n\nEmin misiniz?`)) return;

    try {
        const response = await fetch('/api/delete_customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
        });
        const data = await response.json();
        if (!data.success) {
            showToast(data.error, 'error');
            return;
        }

        showToast(`${ids.length} müşteri silindi.`, 'success');
        activeTab.querySelectorAll('.row-check:checked').forEach((checkbox) => {
            if (checkbox.closest('tr').style.display !== 'none') checkbox.closest('tr').remove();
        });
        updateSelectionBar();
        loadStats();
    } catch (error) {
        showToast('Ağ hatası', 'error');
    }
}

async function deleteSingleCustomer(id, button) {
    if (!confirm('DİKKAT: Bu müşteriyi kalıcı olarak silmek üzeresiniz.\nBu işlem geri alınamaz.\n\nEmin misiniz?')) return;

    const row = button.closest('tr');
    button.innerHTML = '<i class="fas fa-spinner fa-spin" style="color:var(--muted-foreground);"></i>';

    try {
        const response = await fetch('/api/delete_customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: [id] })
        });
        const data = await response.json();
        if (!data.success) {
            showToast(data.error, 'error');
            button.replaceChildren(createIcon(DELETE_ICON));
            return;
        }

        showToast('Müşteri silindi.', 'success');
        row.remove();
        updateSelectionBar();
        loadStats();
    } catch (error) {
        showToast('Ağ hatası', 'error');
        button.replaceChildren(createIcon(DELETE_ICON));
    }
}

async function updateCustomer(id, inputId, button) {
    const value = String(document.getElementById(inputId).value || '').trim();
    if (!/^\+90[5]\d{9}$/.test(value)) {
        showToast('Telefon +905XXXXXXXXX formatında 13 hane olmalı.', 'error');
        return;
    }

    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        const response = await fetch('/api/update_phone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, phone: value })
        });
        const data = await response.json();
        if (data.success) {
            showToast('Güncellendi.', 'success');
        } else {
            showToast(data.error, 'error');
        }
    } catch (error) {
        showToast('Ağ hatası', 'error');
    }

    button.replaceChildren(createIcon('fas fa-check'));
}

async function autoFixPhone(id, button) {
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        const response = await fetch('/api/auto_fix_phone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        const data = await response.json();
        if (!data.success) {
            showToast(data.error || 'Düzeltilemedi', 'error');
            button.disabled = false;
            button.replaceChildren(createIcon('fas fa-magic'));
            return;
        }

        showToast(`Düzeltildi: ${data.old_phone} -> ${data.new_phone}`, 'success');
        const row = button.closest('tr');
        row.style.transition = 'opacity 0.5s';
        row.style.opacity = '0.3';
        row.style.pointerEvents = 'none';
        setTimeout(() => row.remove(), 800);
    } catch (error) {
        showToast('Ağ hatası', 'error');
        button.disabled = false;
        button.replaceChildren(createIcon('fas fa-magic'));
    }
}

async function bulkAutoFix() {
    const button = document.getElementById('bulk-fix-btn');
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> İşleniyor...';

    try {
        const response = await fetch('/api/bulk_auto_fix', { method: 'POST' });
        const data = await response.json();
        if (!data.success) {
            showToast(data.error || 'Toplu düzeltme hatası', 'error');
            return;
        }

        showToast(`${data.fixed} düzeltildi | ${data.skipped} atlandı | ${data.errors} hata`, data.errors > 0 ? 'error' : 'success');
        loadAnalysisPage('invalid', 'invalid-table', 'pag-invalid', 1);
        loadStats();
    } catch (error) {
        showToast('Ağ hatası', 'error');
    } finally {
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-magic"></i> Tümünü Otomatik Düzelt';
    }
}

async function loadSettings() {
    try {
        const response = await fetch('/api/settings');
        const data = await response.json();

        document.getElementById('cfg-client-id').value = data.client_id || '';
        document.getElementById('cfg-store-slug').value = data.store_slug || '';
        document.getElementById('cfg-client-secret').value = '';
        updateSecretStatus(Boolean(data.secret_configured));
    } catch (error) {
        showToast('Ayarlar yüklenemedi', 'error');
    }
}

async function saveSettings() {
    const clientId = String(document.getElementById('cfg-client-id').value || '').trim();
    const newSecret = String(document.getElementById('cfg-client-secret').value || '').trim();
    const slug = String(document.getElementById('cfg-store-slug').value || '').trim().toLowerCase();

    if (!clientId) {
        showToast('Client ID gerekli.', 'error');
        return;
    }
    if (!slug || !isValidStoreSlug(slug)) {
        showToast('Mağaza slug formatı geçersiz.', 'error');
        return;
    }
    if (!newSecret && !settingsState.secretConfigured) {
        showToast('İlk kurulumda yeni CLIENT_SECRET gerekli.', 'error');
        return;
    }

    try {
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: newSecret,
                store_slug: slug
            })
        });
        const data = await response.json();
        if (!data.success) {
            showToast(data.error || 'Ayarlar kaydedilemedi', 'error');
            return;
        }

        window.storeSlug = normalizeStoreSlug(slug);
        document.getElementById('cfg-client-secret').value = '';
        updateSecretStatus(Boolean(data.secret_configured));
        showToast('Ayarlar kaydedildi.', 'success');
    } catch (error) {
        showToast('Ağ hatası', 'error');
    }
}
