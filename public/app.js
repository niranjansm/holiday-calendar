const today = new Date().toISOString().split('T')[0];
let currentYear = new Date().getFullYear();
let state = { entitlements: {}, holidays: {} };
let addingFor = null;

// ── API helpers ──────────────────────────────────────────────────────────────

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ── Data loading ─────────────────────────────────────────────────────────────

async function loadYear(year) {
  const data = await api('GET', `/api/data/${year}`);

  state.entitlements = {};
  data.entitlements.forEach(e => { state.entitlements[e.person] = e.total_days; });

  state.holidays = { Niranjan: [], Nayana: [] };
  data.holidays.forEach(h => { state.holidays[h.person].push(h); });

  document.getElementById('current-year').textContent = year;
  renderPerson('Niranjan');
  renderPerson('Nayana');
}

// ── Rendering ────────────────────────────────────────────────────────────────

function calcStats(person) {
  const entitlement = state.entitlements[person] ?? null;
  const holidays = state.holidays[person] || [];
  const taken   = holidays.filter(h => h.date <= today).length;
  const planned = holidays.filter(h => h.date > today).length;
  const remaining = entitlement !== null ? entitlement - taken - planned : null;
  return { entitlement, taken, planned, remaining };
}

function renderPerson(person) {
  const key = person.toLowerCase();
  const { entitlement, taken, planned, remaining } = calcStats(person);
  const holidays = state.holidays[person] || [];

  document.getElementById(`${key}-entitlement`).textContent = entitlement ?? '—';
  document.getElementById(`${key}-taken`).textContent = taken;
  document.getElementById(`${key}-planned`).textContent = planned;

  const remEl = document.getElementById(`${key}-remaining`);
  remEl.textContent = remaining ?? '—';
  remEl.style.color = remaining !== null && remaining < 5 ? '#cf222e' : '';

  const container = document.getElementById(`${key}-list`);

  if (holidays.length === 0) {
    container.innerHTML = '<div class="empty-state">No holidays added yet</div>';
    return;
  }

  const rows = holidays.map(h => `
    <tr class="${h.date <= today ? 'past' : ''}">
      <td>${fmtDate(h.date)}</td>
      <td>${esc(h.name)}</td>
      <td><span class="badge ${h.is_public ? 'public' : 'personal'}">${h.is_public ? 'Public' : 'Personal'}</span></td>
      <td><button class="del-btn" onclick="deleteHoliday(${h.id},'${person}')" title="Remove">×</button></td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table>
      <thead><tr><th>Date</th><th>Name</th><th>Type</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function fmtDate(d) {
  const [y, m, day] = d.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
}

function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Add holiday modal ─────────────────────────────────────────────────────────

function showAddHoliday(person) {
  addingFor = person;
  document.getElementById('holiday-modal-title').textContent = `Add Holiday — ${person}`;
  document.getElementById('h-date').value = '';
  document.getElementById('h-date').min = `${currentYear}-01-01`;
  document.getElementById('h-date').max = `${currentYear}-12-31`;
  document.getElementById('h-name').value = '';
  document.getElementById('h-public').checked = false;
  document.getElementById('h-error').textContent = '';
  document.getElementById('holiday-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('h-date').focus(), 50);
}

function closeHolidayModal() {
  document.getElementById('holiday-modal').classList.add('hidden');
  addingFor = null;
}

document.getElementById('holiday-form').addEventListener('submit', async e => {
  e.preventDefault();
  const date      = document.getElementById('h-date').value;
  const name      = document.getElementById('h-name').value.trim();
  const is_public = document.getElementById('h-public').checked;
  document.getElementById('h-error').textContent = '';
  try {
    await api('POST', '/api/holidays', { person: addingFor, year: currentYear, date, name, is_public });
    closeHolidayModal();
    loadYear(currentYear);
  } catch (err) {
    document.getElementById('h-error').textContent = err.message;
  }
});

// ── Delete holiday ────────────────────────────────────────────────────────────

async function deleteHoliday(id, person) {
  if (!confirm('Remove this holiday?')) return;
  await api('DELETE', `/api/holidays/${id}`);
  loadYear(currentYear);
}

// ── Entitlement modal ─────────────────────────────────────────────────────────

function showEntitlementModal(person) {
  document.getElementById('ent-modal-title').textContent = `Set Entitlement — ${person}`;
  document.getElementById('ent-person').value = person;
  document.getElementById('ent-days').value = state.entitlements[person] ?? '';
  document.getElementById('entitlement-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('ent-days').focus(), 50);
}

function closeEntitlementModal() {
  document.getElementById('entitlement-modal').classList.add('hidden');
}

document.getElementById('entitlement-form').addEventListener('submit', async e => {
  e.preventDefault();
  const person     = document.getElementById('ent-person').value;
  const total_days = parseInt(document.getElementById('ent-days').value);
  await api('POST', '/api/entitlements', { person, year: currentYear, total_days });
  closeEntitlementModal();
  loadYear(currentYear);
});

// ── Year navigation ───────────────────────────────────────────────────────────

document.getElementById('prev-year').addEventListener('click', () => { currentYear--; loadYear(currentYear); });
document.getElementById('next-year').addEventListener('click', () => { currentYear++; loadYear(currentYear); });

// ── Close modals on backdrop click ────────────────────────────────────────────

document.getElementById('holiday-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeHolidayModal(); });
document.getElementById('entitlement-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeEntitlementModal(); });

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeHolidayModal(); closeEntitlementModal(); }
});

// ── Init ──────────────────────────────────────────────────────────────────────

loadYear(currentYear);
