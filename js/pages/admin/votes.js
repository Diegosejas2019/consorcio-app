import { toast } from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { skeleton } from '../../ui/skeleton.js';
import { setBtnLoading } from '../../ui/loading.js';
import { formatDate, errorState } from '../../ui/helpers.js';

// ── Badge de estado ───────────────────────────────────────────
function voteStatusBadge(status) {
  return status === 'open'
    ? '<span class="badge badge-success">🟢 Abierta</span>'
    : '<span class="badge badge-default">⚫ Cerrada</span>';
}

// ── Barra de progreso de opciones ─────────────────────────────
function optionBar(label, votes, total, idx, myVote) {
  const pct      = total > 0 ? Math.round((votes / total) * 100) : 0;
  const isChosen = myVote === idx;
  return `
    <div class="vote-option-row${isChosen ? ' vote-option-chosen' : ''}">
      <div class="flex between" style="margin-bottom:.25rem">
        <span class="text-sm">${label}</span>
        <span class="text-sm text-muted">${votes} voto${votes !== 1 ? 's' : ''} · ${pct}%</span>
      </div>
      <div class="vote-bar-bg">
        <div class="vote-bar-fill${isChosen ? ' vote-bar-fill--chosen' : ''}" style="width:${pct}%"></div>
      </div>
    </div>`;
}

// ── Render principal ──────────────────────────────────────────
export async function renderAdminVotes() {
  const el = document.getElementById('page-admin-votes');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(3)}</div>`;
  try {
    const res   = await api.votes.getAll({ limit: 50 });
    const votes = res.data.votes;

    el.innerHTML = `
      <div class="flex col gap-3">
        <div class="flex between">
          <h1>Votaciones</h1>
          <button class="btn btn-primary btn-sm" onclick="openNewVoteModal()">+ Nueva</button>
        </div>
        ${votes.length === 0
          ? `<div style="text-align:center;padding:3rem 1rem">
               <p style="font-size:2.5rem">🗳️</p>
               <p class="text-muted text-sm mt-1">No hay votaciones todavía.</p>
               <button class="btn btn-primary btn-sm mt-2" onclick="openNewVoteModal()">Crear primera votación</button>
             </div>`
          : votes.map((v, i) => {
              const total = v.options.reduce((s, o) => s + (o.votes ?? 0), 0);
              return `
                <div class="card oh-entry" style="--delay:${Math.min(i * 40, 200)}ms">
                  <div class="card-header">
                    <div class="flex between" style="align-items:flex-start;gap:.5rem">
                      <div>
                        <div class="flex gap-1" style="align-items:center;flex-wrap:wrap">
                          ${voteStatusBadge(v.status)}
                          <span class="text-muted text-sm">${formatDate(v.createdAt)}</span>
                          ${v.endsAt ? `<span class="text-muted text-sm">· Vence ${formatDate(v.endsAt)}</span>` : ''}
                        </div>
                        <h3 style="margin-top:.35rem">${v.title}</h3>
                        ${v.description ? `<p class="text-sm text-muted" style="margin-top:.2rem">${v.description.slice(0, 120)}${v.description.length > 120 ? '…' : ''}</p>` : ''}
                      </div>
                      <div class="flex gap-1">
                        ${v.status === 'open' ? `<button class="btn btn-secondary btn-sm" onclick="confirmCloseVote('${v._id}','${v.title.replace(/'/g, "\\'")}')">Cerrar</button>` : ''}
                        <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="confirmDeleteVote('${v._id}','${v.title.replace(/'/g, "\\'")}')">🗑</button>
                      </div>
                    </div>
                  </div>
                  <div class="card-body flex col gap-2">
                    ${v.options.map((o, idx) => optionBar(o.label, o.votes ?? 0, total, idx, null)).join('')}
                    <div class="flex between mt-1">
                      <span class="text-sm text-muted">${total} voto${total !== 1 ? 's' : ''} en total</span>
                      <button class="btn btn-ghost btn-sm" onclick="openVoteResults('${v._id}')">Ver detalle →</button>
                    </div>
                  </div>
                </div>`;
            }).join('')}
      </div>`;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderAdminVotes()');
  }
}

// ── Modal: nueva votación ─────────────────────────────────────
export function openNewVoteModal() {
  document.getElementById('modal').innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:1rem">Nueva Votación</h2>
    <div class="flex col gap-2">
      <div class="form-group">
        <label>Título</label>
        <input class="input" id="v-title" placeholder="Ej: ¿Pintamos el palier?" maxlength="150">
      </div>
      <div class="form-group">
        <label>Descripción <span class="text-muted" style="font-size:.8rem">(opcional)</span></label>
        <textarea class="input" id="v-desc" rows="2" placeholder="Contexto adicional para los propietarios..." maxlength="2000"></textarea>
      </div>
      <div class="form-group">
        <label>Fecha límite <span class="text-muted" style="font-size:.8rem">(opcional)</span></label>
        <input class="input" type="datetime-local" id="v-ends-at">
      </div>
      <div class="form-group">
        <label>Opciones <span class="text-muted" style="font-size:.8rem">(mínimo 2)</span></label>
        <div id="v-options-list" class="flex col gap-1">
          <div class="flex gap-1"><input class="input" placeholder="Opción 1" style="flex:1"><button class="btn-icon" onclick="removeVoteOption(this)" title="Eliminar">✕</button></div>
          <div class="flex gap-1"><input class="input" placeholder="Opción 2" style="flex:1"><button class="btn-icon" onclick="removeVoteOption(this)" title="Eliminar">✕</button></div>
        </div>
        <button class="btn btn-ghost btn-sm mt-1" onclick="addVoteOption()">+ Agregar opción</button>
      </div>
      <label style="font-size:.85rem;display:flex;align-items:center;gap:.5rem;cursor:pointer">
        <input type="checkbox" id="v-push" checked> Notificar a propietarios por push
      </label>
      <div class="flex gap-1 mt-1">
        <button class="btn btn-secondary w-full" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary w-full" id="btn-save-vote" data-requires-network onclick="saveVote()">Publicar</button>
      </div>
    </div>`;
  openModal();
}

export function addVoteOption() {
  const list  = document.getElementById('v-options-list');
  const count = list.children.length + 1;
  const div   = document.createElement('div');
  div.className = 'flex gap-1';
  div.innerHTML = `<input class="input" placeholder="Opción ${count}" style="flex:1"><button class="btn-icon" onclick="removeVoteOption(this)" title="Eliminar">✕</button>`;
  list.appendChild(div);
}

export function removeVoteOption(btn) {
  const list = document.getElementById('v-options-list');
  if (list.children.length <= 2) { toast('Debe haber al menos 2 opciones.', 'error'); return; }
  btn.closest('.flex').remove();
}

export async function saveVote() {
  const title    = document.getElementById('v-title')?.value.trim();
  const desc     = document.getElementById('v-desc')?.value.trim();
  const endsAt   = document.getElementById('v-ends-at')?.value;
  const sendPush = document.getElementById('v-push')?.checked;
  const inputs   = [...document.querySelectorAll('#v-options-list input')];
  const options  = inputs.map((i) => i.value.trim()).filter(Boolean);

  if (!title)           { toast('El título es obligatorio.', 'error'); return; }
  if (options.length < 2) { toast('Agregá al menos 2 opciones.', 'error'); return; }

  const btn = document.getElementById('btn-save-vote');
  setBtnLoading(btn, true);
  try {
    await api.votes.create({
      title,
      description: desc || undefined,
      options,
      endsAt: endsAt || undefined,
      sendPush,
    });
    closeModal();
    toast('Votación publicada.', 'success');
    renderAdminVotes();
  } catch (err) {
    toast(err.message, 'error');
    setBtnLoading(btn, false);
  }
}

// ── Cerrar votación ───────────────────────────────────────────
export function confirmCloseVote(id, title) {
  document.getElementById('modal').innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:.75rem">Cerrar votación</h2>
    <p class="text-sm text-muted" style="margin-bottom:1.5rem">¿Cerrás "<strong>${title}</strong>"? Los propietarios ya no podrán votar.</p>
    <div class="flex gap-1">
      <button class="btn btn-secondary w-full" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary w-full" id="btn-close-vote" data-requires-network onclick="doCloseVote('${id}')">Cerrar votación</button>
    </div>`;
  openModal();
}

export async function doCloseVote(id) {
  const btn = document.getElementById('btn-close-vote');
  setBtnLoading(btn, true);
  try {
    await api.votes.close(id);
    closeModal();
    toast('Votación cerrada.', 'success');
    renderAdminVotes();
  } catch (err) {
    toast(err.message, 'error');
    setBtnLoading(btn, false);
  }
}

// ── Eliminar votación ─────────────────────────────────────────
export function confirmDeleteVote(id, title) {
  document.getElementById('modal').innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:.75rem">Eliminar votación</h2>
    <p class="text-sm text-muted" style="margin-bottom:1.5rem">¿Eliminás "<strong>${title}</strong>"? Se borrarán todos los votos registrados.</p>
    <div class="flex gap-1">
      <button class="btn btn-secondary w-full" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary w-full" style="background:var(--danger)" id="btn-del-vote" data-requires-network onclick="doDeleteVote('${id}')">Eliminar</button>
    </div>`;
  openModal();
}

export async function doDeleteVote(id) {
  const btn = document.getElementById('btn-del-vote');
  setBtnLoading(btn, true);
  try {
    await api.votes.delete(id);
    closeModal();
    toast('Votación eliminada.');
    renderAdminVotes();
  } catch (err) {
    toast(err.message, 'error');
    setBtnLoading(btn, false);
  }
}

// ── Resultados detallados ─────────────────────────────────────
export async function openVoteResults(id) {
  document.getElementById('modal').innerHTML = `<div class="modal-handle"></div><div style="padding:1.5rem;text-align:center">${skeleton(4)}</div>`;
  openModal();
  try {
    const res = await api.votes.results(id);
    const { vote, options, totalVotes, responses } = res.data;

    document.getElementById('modal').innerHTML = `
      <div class="modal-handle"></div>
      <div class="flex between" style="margin-bottom:.75rem;align-items:flex-start">
        <div>
          <h2>${vote.title}</h2>
          ${vote.description ? `<p class="text-sm text-muted">${vote.description}</p>` : ''}
        </div>
        ${voteStatusBadge(vote.status)}
      </div>
      <div class="flex col gap-2" style="margin-bottom:1rem">
        ${options.map((o) => optionBar(o.label, o.votes, totalVotes, o.index, null)).join('')}
        <p class="text-sm text-muted" style="text-align:right">${totalVotes} voto${totalVotes !== 1 ? 's' : ''} en total</p>
      </div>
      ${responses.length > 0 ? `
        <details style="margin-top:.5rem">
          <summary class="text-sm" style="cursor:pointer;color:var(--accent)">Ver quién votó (${responses.length})</summary>
          <div class="flex col gap-1 mt-2">
            ${responses.map((r) => `
              <div class="flex between text-sm" style="padding:.4rem .5rem;background:var(--surface2);border-radius:.5rem">
                <span>${r.owner?.name ?? '—'} ${r.owner?.unit ? `<span class="text-muted">(${r.owner.unit})</span>` : ''}</span>
                <span class="text-muted">${options[r.optionIndex]?.label ?? r.optionIndex}</span>
              </div>`).join('')}
          </div>
        </details>` : ''}
      <button class="btn btn-secondary w-full mt-2" onclick="closeModal()">Cerrar</button>`;
  } catch (err) {
    document.getElementById('modal').innerHTML = `
      <div class="modal-handle"></div>
      ${errorState(err.message, `openVoteResults('${id}')`)}
      <button class="btn btn-secondary w-full mt-2" onclick="closeModal()">Cerrar</button>`;
  }
}

window.renderAdminVotes    = renderAdminVotes;
window.openNewVoteModal    = openNewVoteModal;
window.addVoteOption       = addVoteOption;
window.removeVoteOption    = removeVoteOption;
window.saveVote            = saveVote;
window.confirmCloseVote    = confirmCloseVote;
window.doCloseVote         = doCloseVote;
window.confirmDeleteVote   = confirmDeleteVote;
window.doDeleteVote        = doDeleteVote;
window.openVoteResults     = openVoteResults;
