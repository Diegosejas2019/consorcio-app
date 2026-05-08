import { toast } from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { skeleton } from '../../ui/skeleton.js';
import { setBtnLoading } from '../../ui/loading.js';
import { errorState } from '../../ui/helpers.js';

/* ── Type metadata ── */
const RV_TYPES = {
  visit: {
    label: 'Visita', color: '#9cf27b',
    svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 21c0-3.5 3.1-6 7-6s7 2.5 7 6"/></svg>`,
    svg13: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 21c0-3.5 3.1-6 7-6s7 2.5 7 6"/></svg>`,
  },
  provider: {
    label: 'Proveedor', color: '#7cc6f0',
    svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="6" width="14" height="11" rx="1"/><path d="M15 9h4l3 3v5h-7"/><circle cx="6" cy="18.5" r="1.7"/><circle cx="18" cy="18.5" r="1.7"/></svg>`,
    svg13: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="6" width="14" height="11" rx="1"/><path d="M15 9h4l3 3v5h-7"/><circle cx="6" cy="18.5" r="1.7"/><circle cx="18" cy="18.5" r="1.7"/></svg>`,
  },
  delivery: {
    label: 'Delivery', color: '#f5a85f',
    svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5V8z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/></svg>`,
    svg13: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5V8z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/></svg>`,
  },
};

/* ── Page state ── */
let _rvAll = [];
let _rvFilter = 'all';
let _rvDay = -1; // -1 = no day filter; 0–6 = week day index

/* ── Date helpers ── */
function _localDateStr(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function _fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-AR', { hour: 'numeric', minute: '2-digit' });
}
function _buildWeek() {
  const today = new Date();
  const DAY_ABBR = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
  const MON_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return {
      label: DAY_ABBR[d.getDay()],
      num: d.getDate(),
      mon: MON_ABBR[d.getMonth()],
      dateStr: _localDateStr(d.toISOString()),
      date: d,
    };
  });
}

/* ── Status badge ── */
function _statusBadge(status) {
  if (status === 'approved' || status === 'inside') return '<span class="rv-event-status is-ok">Aprobada</span>';
  if (status === 'pending')  return '<span class="rv-event-status is-pend">Pendiente</span>';
  if (status === 'rejected') return '<span class="rv-event-status is-dang">Rechazada</span>';
  if (status === 'exited')   return '<span class="rv-event-status" style="color:var(--muted);background:var(--surface-3)">Salió</span>';
  return '';
}

/* ── Render the event list section ── */
function _renderAgenda(week) {
  const filtered = _rvAll.filter(v => {
    if (_rvFilter !== 'all' && v.type !== _rvFilter) return false;
    if (_rvDay >= 0 && _localDateStr(v.expectedDate) !== week[_rvDay].dateStr) return false;
    return true;
  });

  // Group by date
  const map = new Map();
  filtered.forEach(v => {
    const key = _localDateStr(v.expectedDate);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(v);
  });

  // Sort groups chronologically
  const groups = [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateStr, visits]) => {
      const d = new Date(dateStr + 'T12:00:00');
      const todayStr = _localDateStr(new Date().toISOString());
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = _localDateStr(tomorrow.toISOString());
      let label;
      if (dateStr === todayStr) label = 'Hoy';
      else if (dateStr === tomorrowStr) label = 'Mañana';
      else label = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
      return { dateStr, num: d.getDate(), label, visits };
    });

  if (groups.length === 0) {
    return `
      <div class="rv-empty">
        <div class="rv-empty-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>
        </div>
        <div class="rv-empty-t">Sin visitas</div>
        <div class="rv-empty-s">${_rvFilter !== 'all' ? 'Probá otro filtro o' : 'No tenés visitas registradas.'} <button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="openNewVisitModal()">+ Nueva visita</button></div>
      </div>`;
  }

  return groups.map(g => `
    <section>
      <header class="rv-daySection-h">
        <div class="rv-daySection-num">${g.num}</div>
        <div>
          <div class="rv-daySection-title">${g.label}</div>
          <div class="rv-daySection-sub">${g.dateStr} · ${g.visits.length} ${g.visits.length === 1 ? 'visita' : 'visitas'}</div>
        </div>
      </header>
      <div class="rv-events">
        ${g.visits.map(v => {
          const meta = RV_TYPES[v.type] || RV_TYPES.visit;
          const canDelete = v.status === 'pending' || v.status === 'rejected';
          return `
            <article class="rv-event" style="--ev-color:${meta.color}">
              <div class="rv-event-time">
                <span class="rv-event-time-h">${_fmtTime(v.expectedDate)}</span>
              </div>
              <div class="rv-event-bar"></div>
              <div class="rv-event-body">
                <div class="rv-event-row1">
                  <h4 class="rv-event-title">${v.name}</h4>
                  ${_statusBadge(v.status)}
                </div>
                <div class="rv-event-row2">
                  <span style="display:inline-flex;color:${meta.color}">${meta.svg13}</span>
                  <span class="rv-event-type" style="color:${meta.color}">${meta.label}</span>
                  ${v.note ? `<span class="rv-event-sep">·</span><span class="rv-event-note">${v.note}</span>` : ''}
                </div>
                ${canDelete ? `<button class="rv-event-del" onclick="deleteVisit('${v._id}')">Eliminar</button>` : ''}
              </div>
            </article>`;
        }).join('')}
      </div>
    </section>`).join('');
}

/* ── Main render ── */
export async function renderOwnerVisits() {
  const el = document.getElementById('page-owner-visits');
  el.innerHTML = `<div style="padding:16px">${skeleton(3)}</div>`;

  try {
    const res = await api.visits.getMy();
    _rvAll = res.data.visits || [];
    _rvFilter = 'all';
    _rvDay = -1;

    const week = _buildWeek();
    const now = new Date();
    const MON = now.toLocaleDateString('es-AR', { month: 'long' });
    const YEAR = now.getFullYear();

    el.innerHTML = `
      <div style="padding:0 16px 100px">
        <div class="rv-pageHead">
          <div>
            <div class="rv-monthPill">
              ${MON.charAt(0).toUpperCase() + MON.slice(1)} ${YEAR}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
            </div>
            <h1 class="page-title" style="margin-top:10px">Mis Visitas</h1>
          </div>
          <button class="rv-fab-inline" onclick="openNewVisitModal()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
            Nueva
          </button>
        </div>

        <div class="rv-weekStrip" id="rv-weekStrip">
          ${week.map((d, i) => {
            const dots = _rvAll.filter(v => _localDateStr(v.expectedDate) === d.dateStr);
            return `
              <button class="rv-dayPill ${i === 0 ? 'is-today is-active' : ''}" onclick="rvSetDay(${i})">
                <span class="rv-dayPill-d">${d.label}</span>
                <span class="rv-dayPill-n">${d.num}</span>
                <span class="rv-dayPill-dots">
                  ${dots.slice(0, 3).map(v => `<i style="background:${(RV_TYPES[v.type] || RV_TYPES.visit).color}"></i>`).join('')}
                </span>
              </button>`;
          }).join('')}
        </div>

        <div class="rv-chips" id="rv-chips">
          <button class="rv-chip is-on" onclick="rvSetFilter('all')">
            Todas <span class="rv-chip-count">${_rvAll.length}</span>
          </button>
          ${Object.entries(RV_TYPES).map(([k, m]) => {
            const n = _rvAll.filter(v => v.type === k).length;
            return `<button class="rv-chip" onclick="rvSetFilter('${k}')">
              <i class="rv-chip-dot" style="background:${m.color}"></i>
              ${m.label}
              ${n > 0 ? `<span class="rv-chip-count">${n}</span>` : ''}
            </button>`;
          }).join('')}
        </div>

        <div class="rv-agenda" id="rv-agenda">
          ${_renderAgenda(week)}
        </div>
      </div>`;

    window._rvWeek = week;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderOwnerVisits()');
  }
}

/* ── Filter / day handlers ── */
function _refreshList() {
  const week = window._rvWeek || _buildWeek();
  const agenda = document.getElementById('rv-agenda');
  if (agenda) agenda.innerHTML = _renderAgenda(week);

  // Update chip active states
  document.querySelectorAll('.rv-chip').forEach(btn => {
    const fn = btn.getAttribute('onclick') || '';
    const match = fn.match(/rvSetFilter\('(\w+)'\)/);
    if (match) btn.classList.toggle('is-on', match[1] === _rvFilter);
  });

  // Update day pill active states
  document.querySelectorAll('.rv-dayPill').forEach((btn, i) => {
    btn.classList.toggle('is-active', i === _rvDay || (_rvDay === -1 && i === 0));
  });
}

window.rvSetFilter = function(type) {
  _rvFilter = type;
  _refreshList();
};

window.rvSetDay = function(i) {
  const week = window._rvWeek || _buildWeek();
  // Toggle: clicking the already-active day resets to "all days"
  _rvDay = (_rvDay === i) ? -1 : i;
  _refreshList();

  // Recolor the day pills
  document.querySelectorAll('.rv-dayPill').forEach((btn, idx) => {
    const isActive = (_rvDay === -1 && idx === 0) || _rvDay === idx;
    const isToday  = idx === 0;
    btn.classList.toggle('is-active', isActive);
    btn.classList.toggle('is-today', isToday);
  });
};

/* ── New visit modal (sheet style) ── */
export function openNewVisitModal() {
  const today = new Date();
  const DAY_ABBR = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
  const MON_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  const days = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return { label: i === 0 ? 'HOY' : DAY_ABBR[d.getDay()], num: d.getDate(), mon: MON_ABBR[d.getMonth()], iso: _localDateStr(d.toISOString()) };
  });

  const slots = ['08:00', '09:30', '12:00', '15:00', '17:30', '20:00'];

  openModal();
  document.getElementById('modal').innerHTML = `
    <div class="modal-handle"></div>
    <div class="rv-sheet-head">
      <div>
        <div class="rv-sheet-eyebrow">NUEVA</div>
        <h2 class="rv-sheet-title">Visita</h2>
      </div>
      <button class="rv-sheet-close" onclick="closeModal()" aria-label="Cerrar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>

    <div class="rv-fieldGroup">
      <label class="field-label">Tipo de visita</label>
      <div class="rv-typeRow">
        ${Object.entries(RV_TYPES).map(([k, m], idx) => `
          <button class="rv-typeChip ${idx === 0 ? 'is-on' : ''}" style="--c:${m.color}" data-type="${k}" onclick="rvSelectType(this, '${k}')">
            <span class="rv-typeChip-icon">${m.svg}</span>
            <span>${m.label}</span>
          </button>`).join('')}
      </div>
    </div>

    <div class="rv-fieldGroup">
      <label class="field-label">Visitante</label>
      <div class="rv-inputWrap">
        <svg class="rv-inputIcon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 21c0-3.5 3.1-6 7-6s7 2.5 7 6"/></svg>
        <input class="rv-input" id="rv-name" placeholder="Nombre y apellido" maxlength="150" oninput="rvUpdateSummary()">
      </div>
    </div>

    <div class="rv-fieldGroup">
      <label class="field-label">¿Cuándo?</label>
      <div class="rv-dayStrip">
        ${days.map((d, i) => `
          <button class="rv-dayCell ${i === 0 ? 'is-today is-on' : ''}" data-iso="${d.iso}" onclick="rvSelectDay(this)">
            <span class="rv-dayCell-d">${d.label}</span>
            <span class="rv-dayCell-n">${d.num}</span>
            <span class="rv-dayCell-m">${d.mon}</span>
          </button>`).join('')}
      </div>
    </div>

    <div class="rv-fieldGroup">
      <label class="field-label">Hora estimada</label>
      <div class="rv-slots">
        ${slots.map((s, i) => `
          <button class="rv-slot ${i === 0 ? 'is-on' : ''}" data-slot="${s}" onclick="rvSelectSlot(this)">${s}</button>`).join('')}
        <button class="rv-slot rv-slot-custom" onclick="rvCustomTime()">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          Otra
        </button>
      </div>
      <input class="rv-input" id="rv-custom-time" type="time" style="display:none;margin-top:8px" oninput="rvUpdateSummary()">
    </div>

    <div class="rv-fieldGroup">
      <label class="field-label">Nota <span class="rv-opt">(opcional)</span></label>
      <textarea class="rv-textarea" id="rv-note" placeholder="Detalle para el portero..." rows="2" maxlength="500"></textarea>
    </div>

    <div class="rv-sheet-footer">
      <div class="rv-summary" id="rv-summary">
        <span class="rv-summary-dot" id="rv-summary-dot" style="background:${RV_TYPES[Object.keys(RV_TYPES)[0]].color}"></span>
        <div>
          <div class="rv-summary-l" id="rv-summary-l">${RV_TYPES[Object.keys(RV_TYPES)[0]].label} · ${slots[0]}</div>
          <div class="rv-summary-s" id="rv-summary-s">hoy ${days[0].num} de ${days[0].mon}</div>
        </div>
      </div>
      <button class="btn btn-primary btn-lg btn-block" id="rv-submit" onclick="submitVisit()" data-requires-network>
        Registrar visita
      </button>
    </div>`;
}

/* ── Form interaction helpers ── */
window.rvSelectType = function(btn, type) {
  document.querySelectorAll('.rv-typeChip').forEach(b => b.classList.remove('is-on'));
  btn.classList.add('is-on');
  rvUpdateSummary();
};

window.rvSelectDay = function(btn) {
  document.querySelectorAll('.rv-dayCell').forEach(b => b.classList.remove('is-on'));
  btn.classList.add('is-on');
  rvUpdateSummary();
};

window.rvSelectSlot = function(btn) {
  document.querySelectorAll('.rv-slot').forEach(b => b.classList.remove('is-on'));
  btn.classList.add('is-on');
  const customInput = document.getElementById('rv-custom-time');
  if (customInput) customInput.style.display = 'none';
  rvUpdateSummary();
};

window.rvCustomTime = function() {
  document.querySelectorAll('.rv-slot').forEach(b => b.classList.remove('is-on'));
  const input = document.getElementById('rv-custom-time');
  if (input) { input.style.display = 'block'; input.focus(); }
};

window.rvUpdateSummary = function() {
  const typeBtn = document.querySelector('.rv-typeChip.is-on');
  const dayBtn  = document.querySelector('.rv-dayCell.is-on');
  const slotBtn = document.querySelector('.rv-slot.is-on');
  const customTime = document.getElementById('rv-custom-time');

  const type = typeBtn?.dataset.type || Object.keys(RV_TYPES)[0];
  const meta = RV_TYPES[type] || RV_TYPES.visit;
  const time = slotBtn ? slotBtn.dataset.slot : (customTime?.value || '');
  const dayIso = dayBtn?.dataset.iso || '';
  const dayLabel = dayBtn ? dayBtn.querySelector('.rv-dayCell-d')?.textContent : '';
  const dayNum   = dayBtn ? dayBtn.querySelector('.rv-dayCell-n')?.textContent : '';
  const dayMon   = dayBtn ? dayBtn.querySelector('.rv-dayCell-m')?.textContent : '';

  const dot = document.getElementById('rv-summary-dot');
  const lEl = document.getElementById('rv-summary-l');
  const sEl = document.getElementById('rv-summary-s');
  if (dot) dot.style.background = meta.color;
  if (lEl) lEl.textContent = `${meta.label}${time ? ' · ' + time : ''}`;
  if (sEl) sEl.textContent = `${dayLabel?.toLowerCase()} ${dayNum} de ${dayMon}`;
};

/* ── Submit ── */
export async function submitVisit() {
  const name = document.getElementById('rv-name')?.value?.trim();
  const typeBtn = document.querySelector('.rv-typeChip.is-on');
  const dayBtn  = document.querySelector('.rv-dayCell.is-on');
  const slotBtn = document.querySelector('.rv-slot.is-on');
  const customTime = document.getElementById('rv-custom-time');
  const note = document.getElementById('rv-note')?.value?.trim();

  const type = typeBtn?.dataset.type || Object.keys(RV_TYPES)[0];
  const dayIso = dayBtn?.dataset.iso;
  const time = slotBtn ? slotBtn.dataset.slot : customTime?.value;

  if (!name)   { toast('El nombre del visitante es obligatorio.', 'error'); return; }
  if (!dayIso) { toast('Seleccioná un día.', 'error'); return; }
  if (!time)   { toast('Ingresá una hora.', 'error'); return; }

  const expectedDate = new Date(`${dayIso}T${time}:00`).toISOString();

  const btn = document.getElementById('rv-submit');
  setBtnLoading(btn, true);
  try {
    await api.visits.create({ name, type, expectedDate, note });
    closeModal();
    toast('Visita registrada correctamente.', 'success');
    renderOwnerVisits();
  } catch (err) {
    toast(err.message, 'error');
    setBtnLoading(btn, false);
  }
}

window.renderOwnerVisits = renderOwnerVisits;
window.openNewVisitModal = openNewVisitModal;
window.submitVisit       = submitVisit;
