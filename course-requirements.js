/* Kiểm tra học phần học trước từ dữ liệu K2025 và bảng điểm đã lưu.
 * Chỉ kiểm tra các môn đề nghị học trước theo danh sách K2025.
 */
(() => {
  const input = document.getElementById('m-code') || document.getElementById('check-course-code');
  const panel = document.getElementById('m-course-requirements') || document.getElementById('check-course-result');
  if (!input || !panel) return;

  const normalize = value => String(value || '').trim().toUpperCase();
  const catalog = typeof courseDictionary !== 'undefined' ? courseDictionary : {};
  const list = document.getElementById('check-course-list');
  if (list) Object.entries(catalog).forEach(([code, name]) => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.label = name;
    list.appendChild(opt);
  });
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let requirements = null;
  let loadError = false;

  function userGrades() {
    try {
      const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
      return Array.isArray(user?.stats?.gradesList) ? user.stats.gradesList : [];
    } catch { return []; }
  }
  function isPassed(grade) {
    // Theo bảng điểm hiện tại, điểm >= 5.0 (hệ 10) là đạt.
    const score = Number(grade.score);
    return grade.score !== '' && grade.score != null &&
      Number.isFinite(score) && Math.round(score * 10) / 10 >= 5;
  }
  function statusFor(code) {
    const rows = userGrades().filter(g => normalize(g.code) === code);
    if (rows.some(isPassed)) {
      return { label: 'Đã đạt', color: '#15803d', state: 'passed' };
    }
    if (rows.length) {
      return { label: 'Đã học nhưng chưa đạt', color: '#b45309', state: 'studied' };
    }
    return { label: 'Chưa học', color: '#b91c1c', state: 'missing' };
  }
  function render() {
    const raw = normalize(input.value);
    const code = catalog[raw] ? raw : (Object.entries(catalog).find(([id,name]) => normalize(name) === raw)?.[0] || raw);
    if (!code || !catalog[code]) {
      panel.hidden = true;
      panel.innerHTML = '';
      return;
    }
    panel.hidden = false;
    if (loadError) {
      panel.textContent = 'Không tải được danh sách học phần học trước. Hãy kiểm tra kết nối và tải lại trang.';
      return;
    }
    if (!requirements) {
      panel.textContent = 'Đang tải danh sách học phần học trước…';
      return;
    }
    const prior = requirements.courses?.[code] || [];
    const notes = requirements.notes?.[code] || {};
    const dict = typeof courseDictionary !== 'undefined' ? courseDictionary : {};
    const details = prior.map(id => ({ id, ...statusFor(id), note: notes[id] || '' }));
    const passed = details.filter(item => item.state === 'passed').length;
    const studied = details.filter(item => item.state === 'studied').length;
    const missing = details.filter(item => item.state === 'missing');
    panel.innerHTML = `
      <div style="font-weight:700;color:#174575;margin-bottom:8px">Kiểm tra học phần học trước: ${escapeHTML(code)}</div>
      ${prior.length ? `
        <div style="font-weight:600;margin-bottom:6px">Học phần đề nghị học trước (${passed} đã đạt, ${studied} đã học nhưng chưa đạt, ${missing.length} chưa học):</div>
        <ul style="padding-left:18px;margin:0">
          ${details.map(item => `<li style="margin-bottom:8px">
            <strong>${escapeHTML(item.id)}</strong> — ${escapeHTML(dict[item.id] || 'Chưa có tên trong danh mục')}
            <div style="color:${item.color};font-weight:600">${escapeHTML(item.label)}</div>
            ${item.state === 'missing' ? '<div style="color:#1d4ed8">Đề nghị học học phần này.</div>' : ''}
            ${item.note ? `<small style="color:#64748b">Ghi chú: ${escapeHTML(item.note)}</small>` : ''}
          </li>`).join('')}
        </ul>
        ${missing.length ? `<div style="margin-top:10px;font-weight:600;color:#1d4ed8">Đề nghị học: ${missing.map(item => escapeHTML(item.id) + ' — ' + escapeHTML(dict[item.id] || 'Chưa có tên trong danh mục')).join('; ')}</div>` : ''}` : '<div>Không có học phần đề nghị học trước trong dữ liệu K2025.</div>'}
      <small style="display:block;margin-top:8px;color:#64748b">
        Đây là thông tin tham khảo theo bảng điểm đã nhập. Thiếu môn đề nghị học trước không đồng nghĩa bị cấm đăng ký.
      </small>`;
  }
  input.addEventListener('input', render);
  input.addEventListener('change', render);
  document.getElementById('m-course-suggestions')?.addEventListener('click', () => setTimeout(render, 0));
  document.getElementById('btn-add-manual')?.addEventListener('click', () => setTimeout(render, 0));
  // Duy trì hiển thị khi tên học phần được cập nhật bằng hàm chọn gợi ý.
  const preview = document.getElementById('m-name-preview');
  if (preview) new MutationObserver(render).observe(preview, {childList:true, characterData:true, subtree:true});
  fetch('hoc_truoc_K2025.json', {cache:'no-store'})
    .then(response => { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
    .then(data => { requirements = data; render(); })
    .catch(error => { console.error('Lỗi dữ liệu học trước:', error); loadError = true; render(); });
})();
