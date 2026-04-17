import { skeleton } from '../../ui/skeleton.js';
import { tagLabel, formatDate, errorState } from '../../ui/helpers.js';

export async function renderOwnerNotices() {
  const el = document.getElementById('page-owner-notices');
  el.innerHTML = `<div class="oh-wrap">${skeleton(3)}</div>`;
  try {
    const res     = await api.notices.getAll({ limit: 30 });
    const notices = res.data.notices;

    el.innerHTML = `
      <div class="oh-wrap">
        <div class="oh-greeting oh-entry" style="--delay:0ms">
          <div>
            <p class="oh-greeting-sub">Comunicados</p>
            <h1 class="oh-greeting-name">Avisos</h1>
          </div>
          ${notices.length > 0 ? `<span class="oh-unit-chip">${notices.length}</span>` : ''}
        </div>
        ${notices.length
          ? notices.map((n, i) => `
              <div class="on-card on-tag-${n.tag} oh-entry" style="--delay:${Math.min(i * 40 + 40, 220)}ms">
                <div class="on-card__header">
                  <span class="on-card__tag tag-${n.tag}">${tagLabel(n.tag)}</span>
                  <span class="on-card__date-small">${formatDate(n.createdAt)}</span>
                </div>
                <h2 class="on-card__title">${n.title}</h2>
                <p class="on-card__body">${n.body}</p>
              </div>`).join('')
          : '<p class="text-muted text-sm oh-entry" style="--delay:60ms">Sin avisos por el momento.</p>'}
      </div>`;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderOwnerNotices()');
  }
}

window.renderOwnerNotices = renderOwnerNotices;
