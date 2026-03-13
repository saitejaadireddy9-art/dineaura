// script.js — DineAura

// ── Theme Logic ──
function toggleTheme() {
    const root = document.documentElement;
    const isLight = root.getAttribute('data-theme') === 'light';
    const newTheme = isLight ? 'dark' : 'light';
    root.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
        btn.innerHTML = newTheme === 'light' ? '🌙' : '☀️';
    });
}

(function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
            btn.innerHTML = savedTheme === 'light' ? '🌙' : '☀️';
        });
    });

    // Cross-tab synchronization
    window.addEventListener('storage', (e) => {
        if (e.key === 'theme') {
            document.documentElement.setAttribute('data-theme', e.newValue);
            document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
                btn.innerHTML = e.newValue === 'light' ? '🌙' : '☀️';
            });
        }
    });
})();

// Overlay side menu (for mobile)
const overlayMenu = document.getElementById("overlayMenu");
const overlay = document.getElementById("overlay");

function toggleMenu() {
    if (overlayMenu) overlayMenu.classList.add("active");
    if (overlay) overlay.classList.add("active");
}

function closeMenu() {
    if (overlayMenu) overlayMenu.classList.remove("active");
    if (overlay) overlay.classList.remove("active");
}

// About tab switching
function openTab(tabId) {
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    const el = document.getElementById(tabId);
    if (el) el.classList.add("active");
    if (event && event.currentTarget) event.currentTarget.classList.add("active");
}

// ── Validation Helpers ──
function isValidContact(value) {
    const val = value.trim();
    if (!val) return false;
    // Check if it's an email
    if (val.includes('@')) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    }
    // Check if it's a 10-digit phone number
    const numeric = val.replace(/\D/g, '');
    return numeric.length === 10;
}

async function handleReservation() {
    const name = document.getElementById('resName').value.trim();
    const contact = document.getElementById('resContact').value.trim();
    const date = document.getElementById('resDate').value;
    const guests = document.getElementById('resGuests').value;
    const time = document.getElementById('resTime').value;

    if (!name || !contact || !date || !guests || !time) {
        alert('Please fill in all reservation details.');
        return;
    }

    if (!isValidContact(contact)) {
        alert('Please enter a valid email address or a 10-digit phone number.');
        return;
    }

    try {
        const res = await fetch('/api/reservations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email: contact, date, guests, time })
        });
        if (res.ok) {
            alert('✓ Reservation confirmed! We look forward to seeing you.');
            location.reload();
        } else {
            const d = await res.json();
            alert(d.error || 'Failed to book reservation');
        }
    } catch {
        alert('Reservation confirmed! (Demo mode)');
        location.reload();
    }
}

function restrictContactInput(input) {
    const val = input.value;
    // If it starts looking like a phone number (just digits)
    if (/^\d+$/.test(val.replace(/\s/g, ''))) {
        const cleaned = val.replace(/\D/g, '');
        if (cleaned.length > 10) {
            input.value = cleaned.slice(0, 10);
        }
    }
}


// ── Authentication & Global Widget Logic ──
let currentUser = null;
let currentUserType = null;
let currentUserIdentifier = null;
let currentUserEmail = null;
let currentUserPhone = null;

// ── Check session on page load ──
(async function initAuth() {
    // Check for sessionStorage redirect from login.html
    const ssUser = sessionStorage.getItem('loginUser');
    const ssType = sessionStorage.getItem('loginType');
    if (ssUser && window.location.search.includes('tab=')) {
        history.replaceState(null, '', window.location.pathname);
    }

    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.loggedIn) {
            showDashboard(data.user.username, data.user.type, data.user.identifier, data.user.email, data.user.phone);
            return;
        }
    } catch { /* server not running */ }

    // Fallback: sessionStorage redirect
    if (ssUser) {
        const isAdmin = ssUser === 'admin' || ssType === 'admin';
        const users = JSON.parse(localStorage.getItem('demo_users') || '{}');
        const user = users[ssUser];
        showDashboard(ssUser, isAdmin ? 'admin' : (user?.type || 'dine'), user?.identifier || '', user?.email || '', user?.phone || '');
    }
})();

// ── Show dashboard ──
window.showDashboard = function (username, type, identifier, email, phone) {
    currentUser = username;
    currentUserType = type || 'dine';
    currentUserIdentifier = identifier || '';
    currentUserEmail = email || '';
    currentUserPhone = phone;

    // Show widget, hide login/register links
    const navReg = document.getElementById('navRegister');
    const navLog = document.getElementById('navLogin');
    const widget = document.getElementById('userWidget');
    if (navReg) navReg.style.display = 'none';
    if (navLog) navLog.style.display = 'none';
    if (widget) widget.style.display = 'block';

    // Populate widget details
    const typeLabel = currentUserType === 'dine' ? 'Table' : (currentUserType === 'admin' ? 'Admin' : 'Room');
    const widgetAvatar = document.getElementById('widgetAvatar');
    const widgetUserName = document.getElementById('widgetUserName');
    const widgetUserRole = document.getElementById('widgetUserRole');
    const widgetIdentifier = document.getElementById('widgetIdentifier');

    if (widgetAvatar) widgetAvatar.textContent = username.charAt(0).toUpperCase();
    if (widgetUserName) widgetUserName.textContent = username;
    if (widgetUserRole) widgetUserRole.textContent = typeLabel;
    if (widgetIdentifier) widgetIdentifier.textContent = identifier || 'N/A';

    // Update widget buttons to link to separate pages
    const mainDashBtn = document.getElementById('widgetDashboardBtn');
    const orderBtn = document.getElementById('widgetOrderBtn');
    const historyBtn = document.getElementById('widgetHistoryBtn');
    const bookingsBtn = document.getElementById('widgetBookingsBtn');

    const dashPath = username === 'admin' ? 'admin.html' : 'dashboard.html';

    if (mainDashBtn) mainDashBtn.href = dashPath;
    if (orderBtn) orderBtn.href = dashPath + '#order';
    if (historyBtn) historyBtn.href = dashPath + '#history';
    if (bookingsBtn) bookingsBtn.href = dashPath + '#bookings';

    // If admin, add specific admin link if not present
    const userDropdown = document.getElementById('userDropdown');
    if (currentUserType === 'admin' && userDropdown && !document.getElementById('widgetAdminBtn')) {
        const adminLink = document.createElement('a');
        adminLink.href = 'admin.html';
        adminLink.className = 'dropdown-item';
        adminLink.id = 'widgetAdminBtn';
        adminLink.innerHTML = '👑 Admin Panel';
        const divider = userDropdown.querySelector('div[style*="height:1px"]');
        if (divider) userDropdown.insertBefore(adminLink, divider);
    }

    // Bind dropdown toggle
    const userBtn = document.getElementById('userBtn');
    if (userBtn && userDropdown) {
        userBtn.onclick = function (e) {
            e.preventDefault();
            userDropdown.classList.toggle('show');
            userBtn.classList.toggle('active');
        };
    }

    // Bind logout button
    const logoutBtn = document.getElementById('widgetLogoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = async function () {
            try {
                await fetch('/api/auth/logout', { method: 'POST' });
            } catch (e) { }
            localStorage.removeItem('demo_users');
            sessionStorage.removeItem('loginUser');
            window.location.reload();
        };
    }

    // Close dropdown if clicked outside
    document.addEventListener('click', function (e) {
        if (widget && !widget.contains(e.target) && userDropdown && userDropdown.classList.contains('show')) {
            userDropdown.classList.remove('show');
            userBtn.classList.remove('active');
        }
    });

    // Make sure the legacy dashboards don't show
    const cd = document.getElementById('customerDashboard');
    if (cd) cd.style.display = 'none';
    const ad = document.getElementById('adminDashboard');
    // Don't hide admin dashboard if currently visible by admin JS logic
    // we will let the admin page code handle its own display state.

    // ── Intersection Observer for Scroll Effects ──
    const fadeEls = document.querySelectorAll('.gallery-item, .about-card, .feature-item, .team-member, .award-item');
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12 });
        fadeEls.forEach(el => {
            el.classList.add('fade-in');
            observer.observe(el);
        });
    } else {
        fadeEls.forEach(el => el.classList.add('visible'));
    }
};