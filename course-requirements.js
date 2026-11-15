/* Kiểm tra học phần học trước từ dữ liệu K2025 và bảng điểm đã lưu.
 * "Học trước" trong JSON là đề nghị, KHÔNG phải tiên quyết bắt buộc.
 */
(() => {
  const input = document.getElementById('m-code');
  const panel = document.getElementById('m-course-requirements');
  if (!input || !panel) return;

  const normalize = value => String(value || '').trim().toUpperCase();
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
  function period(grade) {
    const year = String(grade.year || '').match(/\d{2,4}/);
    const sem = Number(grade.sem);
    if (!year || ![1, 2, 3].includes(sem)) return null;
    const start = Number(year[0]);
    return (start < 100 ? 2000 + start : start) * 10 + sem;
  }
  function targetPeriod() {
    return period({
      year: document.getElementById('m-year')?.value || '25 - 26',
      sem: document.querySelector('#m-sem-group .pill-btn.active')?.dataset.val || '1'
    });
  }
  function statusFor(code) {
    const rows = userGrades().filter(g => normalize(g.code) === code);
    const target = targetPeriod();
    const passed = rows.filter(isPassed);
    if (passed.length) {
      if (target !== null && passed.some(g => period(g) !== null && period(g) < target)) {
        return { label: 'Đã học và đạt trước học kỳ này', color: '#15803d', ok: true };
      }
      if (target !== null && passed.some(g => period(g) === target)) {
        return { label: 'Đã đạt trong cùng học kỳ (không phải học trước)', color: '#b45309', ok: false };
      }
      if (target !== null && passed.some(g => period(g) !== null && period(g) > target)) {
        return { label: 'Đã đạt ở học kỳ sau (không tính là học trước)', color: '#b45309', ok: false };
      }
      return { label: 'Đã đạt, chưa xác định được thời điểm học', color: '#b45309', ok: false };
    }
    if (rows.length) return { label: 'Đã học nhưng chưa đạt', color: '#b91c1c', ok: false };
    return { label: 'Chưa có trong bảng điểm', color: '#b91c1c', ok: false };
  }
  function render() {
    const code = normalize(input.value);
    if (!code || !window.courseDictionary?.[code] && !(typeof courseDictionary !== 'undefined' && courseDictionary[code])) {
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
    const satisfied = details.filter(item => item.ok).length;
    panel.innerHTML = `
      <div style="font-weight:700;color:#174575;margin-bottom:8px">Kiểm tra điều kiện học phần: ${escapeHTML(code)}</div>
      <div style="font-size:13px;color:#475569;margin-bottom:8px">
        Học phần tiên quyết bắt buộc: <strong>chưa có dữ liệu xác nhận</strong>.
        Không suy ra tiên quyết từ danh sách đề nghị học trước.
      </div>
      ${prior.length ? `
        <div style="font-weight:600;margin-bottom:6px">Học phần đề nghị học trước (${satisfied}/${details.length} đã đạt trước học kỳ đang chọn):</div>
        <ul style="padding-left:18px;margin:0">
          ${details.map(item => `<li style="margin-bottom:8px">
            <strong>${escapeHTML(item.id)}</strong> — ${escapeHTML(dict[item.id] || 'Chưa có tên trong danh mục')}
            <div style="color:${item.color};font-weight:600">${escapeHTML(item.label)}</div>
            ${item.note ? `<small style="color:#64748b">Ghi chú: ${escapeHTML(item.note)}</small>` : ''}
          </li>`).join('')}
        </ul>` : '<div>Không có học phần đề nghị học trước trong dữ liệu K2025.</div>'}
      <small style="display:block;margin-top:8px;color:#64748b">
        Đây là thông tin tham khảo theo bảng điểm đã nhập. Thiếu môn đề nghị học trước không đồng nghĩa bị cấm đăng ký.
      </small>`;
  }
  input.addEventListener('input', render);
  input.addEventListener('change', render);
  document.getElementById('m-year')?.addEventListener('change', render);
  document.querySelectorAll('#m-sem-group .pill-btn').forEach(btn => btn.addEventListener('click', () => setTimeout(render, 0)));
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
