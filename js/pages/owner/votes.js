import { toast } from '../../ui/toast.js';
import { skeleton } from '../../ui/skeleton.js';
import { setBtnLoading } from '../../ui/loading.js';
import { formatDate, errorState } from '../../ui/helpers.js';
import { svgIcon } from '../../ui/icons.js';

let _votesFilter = 'active';
let _allVotes    = [];

function _voteBar(label, votes, total, idx, myVote) {
  const pct      = total > 0 ? Math.round((votes / total) * 100) : 0;
  const isMine   = myVote === idx;
  return `
    <div class="vote-bar${isMine ? ' is-mine' : ''}">
      <div class="row-between" style="margin-bottom:6px">
        <span style="font:var(--t-sm)">${isMine ? svgIcon('check', 14) + ' ' : ''}${label}</span>
        <span class="tnum" style="font:var(--t-xs)">${pct}%</span>
      </div>
      <div style="background:var(--surface-3);height:6px;border-radius:3px;overflow:hidden">
        <div style="width:${pct}%;height:6px;border-radius:3px;background:${isMine ? 'var(--accent)' : 'var(--border-strong)'};transition:width .4s"></div>
      </div>
      <div class="muted" style="font:var(--t-xs);margin-top:4px">${votes} voto${votes !== 1 ? 's' : ''}</div>
    </div>`;
}

export function switchVotesFilter(f) {
  _votesFilter = f;
  document.querySelectorAll('#votes-seg .seg-btn').forEach(b => b.classList.toggle('is-active', b.dataset.f === f));
  _renderVotesList();
}

function _renderVotesList() {
  const el = document.getElementById('votes-list');
  if (!el) return;
  const filtered = _votesFilter === 'active'
    ? _allVotes.filter(v => v.status === 'open' && (!v.endsAt || new Date() <= new Date(v.endsAt)))
    : _allVotes.filter(v => v.status === 'closed' || (v.endsAt && new Date() > new Date(v.endsAt)));

  if (filtered.length === 0) {
    el.innerHTML = `<div class="empty" style="padding:32px 0">
      <div class="empty-icon">${svgIcon('vote', 24)}</div>
      <p class="empty-title">Sin votaciones</p>
      <p class="empty-sub">No hay votaciones ${_votesFilter === 'active' ? 'activas' : 'cerradas'} por el momento.</p>
    </div>`;
    return;
  }
  el.innerHTML = filtered.map(_voteCard).join('');
}

const PAGE_SIZE = 50;

export async function renderOwnerVotes() {
  const el = document.getElementById('page-owner-votes');
  el.innerHTML = `<div style="padding:16px">${skeleton(3)}</div>`;
  try {
    const res   = await api.votes.getAll({ limit: PAGE_SIZE, page: 1 });
    _allVotes   = res.data.votes;
    _votesFilter = 'active';

    el.innerHTML = `
      <div style="padding:0 16px 32px">
        <p class="page-eyebrow" style="padding-top:16px">Comunidad</p>
        <h1 class="page-title">Votaciones</h1>

        <div class="seg" style="margin-top:18px" id="votes-seg">
          <button class="seg-btn is-active" data-f="active" onclick="switchVotesFilter('active')">Activas</button>
          <button class="seg-btn" data-f="closed" onclick="switchVotesFilter('closed')">Cerradas</button>
        </div>

        <div class="stack-2" style="margin-top:16px" id="votes-list"></div>
      </div>`;
    _renderVotesList();
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderOwnerVotes()');
  }
}

function _voteCard(v) {
  const isExpired = v.endsAt && new Date() > new Date(v.endsAt);
  const isClosed  = v.status === 'closed' || isExpired;
  const hasVoted  = v.myVote !== null && v.myVote !== undefined;
  const showResult = hasVoted || isClosed;
  const total      = showResult ? v.options.reduce((s, o) => s + (o.votes ?? 0), 0) : 0;

  const statusBadge = v.status === 'closed'
    ? `<span class="badge">Cerrada</span>`
    : isExpired
      ? `<span class="badge badge-warning">Vencida</span>`
      : `<span class="badge badge-success">Abierta</span>`;

  let body;
  if (showResult) {
    body = `
      <div class="stack-2" style="margin-top:14px">
        ${v.options.map((o, idx) => _voteBar(o.label, o.votes ?? 0, total, idx, v.myVote)).join('')}
      </div>
      <div class="muted" style="font:var(--t-xs);margin-top:8px;text-align:right">${total} voto${total !== 1 ? 's' : ''} en total</div>
      ${hasVoted ? `<div style="margin-top:8px;color:var(--accent);font:var(--t-sm)">${svgIcon('check', 14)} Tu voto fue registrado.</div>` : ''}`;
  } else {
    body = `
      <div class="stack-2" style="margin-top:14px" id="vote-opts-${v._id}">
        ${v.options.map((o, idx) => `
          <button class="btn btn-ghost btn-block" style="justify-content:flex-start;text-align:left" onclick="castOwnerVote('${v._id}',${idx},this)">${o.label}</button>`).join('')}
      </div>`;
  }

  return `
    <div class="card" style="padding:16px">
      <div class="row-between" style="margin-bottom:10px">
        ${statusBadge}
        ${v.endsAt ? `<span class="muted" style="font:var(--t-xs)">Vence ${formatDate(v.endsAt)}</span>` : ''}
      </div>
      <div class="bright" style="font:var(--t-body-md)">${v.title}</div>
      ${v.description ? `<div class="muted" style="font:var(--t-sm);margin-top:4px">${v.description}</div>` : ''}
      ${body}
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
  const optsEl = document.getElementById(`vote-opts-${v._id}`);
  if (!optsEl) { renderOwnerVotes(); return; }
  const card = optsEl.closest('.card');
  if (!card) { renderOwnerVotes(); return; }
  // Also update in-memory vote
  const idx = _allVotes.findIndex(x => x._id === v._id);
  if (idx !== -1) _allVotes[idx] = v;
  const temp = document.createElement('div');
  temp.innerHTML = _voteCard(v);
  card.replaceWith(temp.firstElementChild);
}

window.renderOwnerVotes  = renderOwnerVotes;
window.castOwnerVote     = castOwnerVote;
window.switchVotesFilter = switchVotesFilter;
