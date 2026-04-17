export function skeleton(lines = 3) {
  return Array.from({ length: lines }, (_, i) =>
    `<div class="skeleton" style="height:18px;margin-bottom:10px;${i % 3 === 2 ? 'width:65%' : ''}"></div>`
  ).join('');
}
