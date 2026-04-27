import { toast } from '../../ui/toast.js';
import { skeleton } from '../../ui/skeleton.js';
import { setBtnLoading } from '../../ui/loading.js';
import { formatDate, errorState } from '../../ui/helpers.js';

// ── Barra de progreso ─────────────────────────────────────────
function optionBar(label, votes, total, idx, myVote) {
  const pct      = total > 0 ? Math.round((votes / total) * 100) : 0;
  const isChosen = myVote === idx;
  return `
    <div class="vote-option-row${isChosen ? ' vote-option-chosen' : ''}">
      <div class="flex between" style="margin-bottom:.25rem">
        <span class="text-sm">${isChosen ? `<strong>${label}</strong> ✓` : label}</span>
        <span class="text-sm text-muted">${pct}%</span>
      </div>
      <div class="vote-bar-bg">
        <div class="vote-bar-fill${isChosen ? ' vote-bar-fill--chosen' : ''}" style="width:${pct}%"></div>
      </div>
    </div>`;
}

// ── Render principal ──────────────────────────────────────────
export async function renderOwnerVotes() {
  const el = document.getElementById('page-owner-votes');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(3)}</div>`;
  try {
    const res   = await api.votes.getAll({ limit: 50 });
    const votes = res.data.votes;

    el.innerHTML = `
      <div class="oh-wrap">
        <div class="oh-greeting oh-entry" style="--delay:0ms">
          <div>
            <p class="oh-greeting-sub">Participación</p>
            <h1 class="oh-greeting-name">Votaciones</h1>
          </div>
        </div>
        ${votes.length === 0
          ? `<div class="oc-empty oh-entry" style="--delay:60ms">
               <p class="oc-empty__icon">🗳️</p>
               <p class="oc-empty__msg">No hay votaciones activas.</p>
             </div>`
          : votes.map((v, i) => _voteCard(v, i)).join('')}
      </div>`;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderOwnerVotes()');
  }
}

function _voteCard(v, i) {
  const delay      = Math.min(i * 40 + 40, 220);
  const isExpired  = v.endsAt && new Date() > new Date(v.endsAt);
  const isClosed   = v.status === 'closed' || isExpired;
  const hasVoted   = v.myVote !== null && v.myVote !== undefined;
  const showResult = hasVoted || isClosed;
  const total      = showResult ? v.options.reduce((s, o) => s + (o.votes ?? 0), 0) : 0;
  const statusBadge = v.status === 'closed'
    ? '<span class="badge badge-default">⚫ Cerrada</span>'
    : isExpired
      ? '<span class="badge badge-warning">🔴 Vencida</span>'
      : '<span class="badge badge-success">🟢 Abierta</span>';

  let body;
  if (showResult) {
    // Mostrar resultados
    body = `
      <div class="flex col gap-2">
        ${v.options.map((o, idx) => optionBar(o.label, o.votes ?? 0, total, idx, v.myVote)).join('')}
        <p class="text-sm text-muted" style="text-align:right;margin-top:.25rem">${total} voto${total !== 1 ? 's' : ''} en total</p>
        ${hasVoted ? '<p class="text-sm" style="color:var(--accent);margin-top:.25rem">✓ Tu voto fue registrado.</p>' : ''}
      </div>`;
  } else {
    // Mostrar opciones para votar
    body = `
      <div class="flex col gap-1" id="vote-opts-${v._id}">
        ${v.options.map((o, idx) => `
          <button
            class="btn btn-secondary w-full"
            style="justify-content:flex-start;text-align:left"
            onclick="castOwnerVote('${v._id}', ${idx}, this)"
          >${o.label}</button>`).join('')}
      </div>`;
  }

  return `
    <div class="oc-card oh-entry" style="--delay:${delay}ms">
      <div class="oc-card__header">
        ${statusBadge}
        ${v.endsAt ? `<span class="text-muted text-sm">Vence ${formatDate(v.endsAt)}</span>` : ''}
      </div>
      <h3 class="oc-card__title">${v.title}</h3>
      ${v.description ? `<p class="oc-card__body">${v.description}</p>` : ''}
      <div style="margin-top:.75rem">${body}</div>
      <div class="oc-card__footer"><span class="oc-card__date">${formatDate(v.createdAt)}</span></div>
    </div>`;
}

export async function castOwnerVote(voteId, optionIndex, btn) {
  setBtnLoading(btn, true);
  // Deshabilitar todas las opciones mientras se procesa
  const container = document.getElementById(`vote-opts-${voteId}`);
  if (container) container.querySelectorAll('button').forEach((b) => (b.disabled = true));
  try {
    const res     = await api.votes.cast(voteId, optionIndex);
    const updated = res.data.vote;
    toast('¡Voto registrado!', 'success');
    // Reemplazar la card con la versión de resultados
    _replaceCard(updated);
  } catch (err) {
    toast(err.message, 'error');
    setBtnLoading(btn, false);
    if (container) container.querySelectorAll('button').forEach((b) => (b.disabled = false));
  }
}

function _replaceCard(v) {
  // Buscar la card existente por el id del contenedor de opciones
  const optsEl = document.getElementById(`vote-opts-${v._id}`);
  if (!optsEl) { renderOwnerVotes(); return; }
  const card = optsEl.closest('.oc-card');
  if (!card) { renderOwnerVotes(); return; }
  const temp = document.createElement('div');
  temp.innerHTML = _voteCard(v, 0);
  card.replaceWith(temp.firstElementChild);
}

window.renderOwnerVotes = renderOwnerVotes;
window.castOwnerVote    = castOwnerVote;
