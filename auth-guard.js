// Kiểm tra quyền truy cập trước khi hiển thị nội dung các trang riêng tư.
// Đây chỉ là kiểm tra phía trình duyệt của bản demo localStorage, KHÔNG phải xác thực máy chủ.
(function () {
    'use strict';
    var page = location.pathname.split('/').pop().toLowerCase();
    if (!page || page === 'index.html' || page === 'register.html') return;
    var valid = false;
    try {
        var current = JSON.parse(localStorage.getItem('currentUser') || 'null');
        var users = JSON.parse(localStorage.getItem('users') || '[]');
        valid = !!(current && current.studentId && Array.isArray(users) &&
            users.some(function (u) { return u.studentId === current.studentId && u.password === current.password; }));
    } catch (e) { valid = false; }
    if (!valid) {
        localStorage.removeItem('currentUser');
        location.replace('index.html');
        // Chặn script khác chạy tiếp nếu trình duyệt chưa điều hướng kịp.
        document.addEventListener('DOMContentLoaded', function () { document.body.replaceChildren(); });
    }
})();
