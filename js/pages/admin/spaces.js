import { toast } from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { skeleton } from '../../ui/skeleton.js';
import { SVG } from '../../ui/icons.js';
import { setBtnLoading } from '../../ui/loading.js';
import { errorState } from '../../ui/helpers.js';

export async function renderAdminSpaces() {
  const el = document.getElementById('page-admin-spaces');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(3)}</div>`;
  try {
    const res    = await api.spaces.getAll();
    const spaces = res.data.spaces;

    const renderCard = (s) => `
      <div style="background:var(--bg);border-radius:10px;padding:.85rem;display:flex;flex-direction:column;gap:.5rem">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem">
          <div style="flex:1;min-width:0">
            <p style="font-weight:600;font-size:.9rem;margin-bottom:.15rem">${s.name}</p>
            <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.25rem">
              ${s.capacity ? `<span class="badge badge-neutral">Cap. ${s.capacity}</span>` : ''}
              ${s.requiresApproval
                ? `<span class="badge" style="background:#fef3c7;color:#92400e">Requiere aprobación</span>`
                : `<span class="badge badge-success">Aprobación automática</span>`}
            </div>
          </div>
          <div class="flex gap-1">
            <button class="btn btn-ghost btn-sm" onclick="openEditSpaceModal('${s._id}','${s.name.replace(/'/g, "\\'")}','${(s.description || '').replace(/'/g, "\\'")}',${s.capacity || ''},${s.requiresApproval})" title="Editar">
              ${SVG.edit || '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'}
            </button>
            <button class="btn btn-ghost btn-sm" onclick="deleteSpace('${s._id}')" style="color:var(--muted)" title="Eliminar">${SVG.x}</button>
          </div>
        </div>
        ${s.description ? `<p style="font-size:.82rem;color:var(--muted)">${s.description}</p>` : ''}
      </div>`;

    el.innerHTML = `
      <div class="flex col gap-3">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h1>Espacios Comunes</h1>
          <button class="btn btn-primary btn-sm" onclick="openCreateSpaceModal()">+ Nuevo</button>
        </div>

        ${spaces.length === 0
          ? `<div class="card"><div class="card-body">
               <p class="text-muted text-sm" style="margin-bottom:1rem">No hay espacios creados aún.</p>
               <button class="btn btn-primary btn-sm" onclick="openCreateSpaceModal()">Crear primer espacio</button>
             </div></div>`
          : `<div class="card">
               <div class="card-body flex col gap-2">${spaces.map(renderCard).join('')}</div>
             </div>`}
      </div>`;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderAdminSpaces()');
  }
}

function spaceFormHTML(opts = {}) {
  const { name = '', description = '', capacity = '', requiresApproval = false } = opts;
  return `
    <div class="form-group">
      <label>Nombre *</label>
      <input class="input" id="space-name" placeholder="Ej: SUM, Parrilla, Quincho" maxlength="100" value="${name}">
    </div>
    <div class="form-group">
      <label>Descripción <span style="color:var(--muted);font-size:.8rem">(opcional)</span></label>
      <textarea class="input" id="space-description" placeholder="Horarios, reglas de uso, equipamiento..." rows="2" maxlength="500">${description}</textarea>
    </div>
    <div class="form-group">
      <label>Capacidad máxima <span style="color:var(--muted);font-size:.8rem">(opcional)</span></label>
      <input class="input" type="number" id="space-capacity" placeholder="Ej: 30" min="1" value="${capacity}">
    </div>
    <div class="form-group">
      <label style="display:flex;align-items:center;gap:.6rem;cursor:pointer">
        <input type="checkbox" id="space-approval" ${requiresApproval ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--primary)">
        <span>Requiere aprobación del administrador</span>
      </label>
      <p class="text-sm text-muted" style="margin-top:.25rem;margin-left:1.6rem">Si no se activa, las reservas se aprueban automáticamente.</p>
    </div>`;
}

export function openCreateSpaceModal() {
  openModal();
  document.getElementById('modal').innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:1rem">Nuevo Espacio</h2>
    <div class="flex col gap-2">
      ${spaceFormHTML()}
      <button class="btn btn-primary w-full" id="btn-submit-space" data-requires-network onclick="submitCreateSpace()">Crear espacio</button>
      <button class="btn btn-secondary w-full" onclick="closeModal()">Cancelar</button>
    </div>`;
}

export function openEditSpaceModal(id, name, description, capacity, requiresApproval) {
  openModal();
  document.getElementById('modal').innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:1rem">Editar Espacio</h2>
    <div class="flex col gap-2">
      ${spaceFormHTML({ name, description, capacity, requiresApproval })}
      <button class="btn btn-primary w-full" id="btn-submit-space" data-requires-network onclick="submitEditSpace('${id}')">Guardar cambios</button>
      <button class="btn btn-secondary w-full" onclick="closeModal()">Cancelar</button>
    </div>`;
}

export async function submitCreateSpace() {
  const name            = document.getElementById('space-name')?.value?.trim();
  const description     = document.getElementById('space-description')?.value?.trim();
  const capacityVal     = document.getElementById('space-capacity')?.value;
  const requiresApproval = document.getElementById('space-approval')?.checked ?? false;

  if (!name) { toast('El nombre es obligatorio.', 'error'); return; }

  const btn = document.getElementById('btn-submit-space');
  setBtnLoading(btn, true);
  try {
    await api.spaces.create({
      name,
      description: description || undefined,
      capacity:    capacityVal ? Number(capacityVal) : undefined,
      requiresApproval,
    });
    closeModal();
    toast('Espacio creado correctamente.', 'success');
    renderAdminSpaces();
  } catch (err) {
    toast(err.message, 'error');
    setBtnLoading(btn, false);
  }
}

export async function submitEditSpace(id) {
  const name            = document.getElementById('space-name')?.value?.trim();
  const description     = document.getElementById('space-description')?.value?.trim();
  const capacityVal     = document.getElementById('space-capacity')?.value;
  const requiresApproval = document.getElementById('space-approval')?.checked ?? false;

  if (!name) { toast('El nombre es obligatorio.', 'error'); return; }

  const btn = document.getElementById('btn-submit-space');
  setBtnLoading(btn, true);
  try {
    await api.spaces.update(id, {
      name,
      description: description || undefined,
      capacity:    capacityVal ? Number(capacityVal) : undefined,
      requiresApproval,
    });
    closeModal();
    toast('Espacio actualizado correctamente.', 'success');
    renderAdminSpaces();
  } catch (err) {
    toast(err.message, 'error');
    setBtnLoading(btn, false);
  }
}

export async function deleteSpace(id) {
  try {
    await api.spaces.delete(id);
    toast('Espacio eliminado.', 'success');
    renderAdminSpaces();
  } catch (err) {
    toast(err.message, 'error');
  }
}

window.renderAdminSpaces    = renderAdminSpaces;
window.openCreateSpaceModal = openCreateSpaceModal;
window.openEditSpaceModal   = openEditSpaceModal;
window.submitCreateSpace    = submitCreateSpace;
window.submitEditSpace      = submitEditSpace;
window.deleteSpace          = deleteSpace;
