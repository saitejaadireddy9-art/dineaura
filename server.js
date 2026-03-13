/**
 * DineAura — Express Backend Server
 * Serves all HTML/CSS/JS as static files + REST API
 * Run: node server.js
 * Visit: http://localhost:3000
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'dineaura_secret_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Serve all static files (HTML, CSS, JS, images) from project root
app.use(express.static(__dirname));

// ── Data helpers ────────────────────────────────────────────────────────────
function readData(file) {
    try {
        return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
    } catch {
        return file.endsWith('.json') && file !== 'users.json' ? [] : {};
    }
}

function writeData(file, data) {
    fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

// Auth middleware
function requireAuth(req, res, next) {
    if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
    next();
}

function isValidContact(value) {
    const val = (value || '').trim();
    if (!val) return false;
    if (val.includes('@')) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    }
    const numeric = val.replace(/\D/g, '');
    return numeric.length === 10;
}

function requireAdmin(req, res, next) {
    if (!req.session.user || req.session.user.type !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

// ═══════════════════════════════════════════════════════
//  AUTH ROUTES
// ═══════════════════════════════════════════════════════

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password, type, identifier } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Username, email or phone, and password are required' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    if (!isValidContact(email)) {
        return res.status(400).json({ error: 'Please enter a valid email or a 10-digit phone number' });
    }

    const users = readData('users.json');

    if (users[username]) {
        return res.status(409).json({ error: 'Username already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 8);
    users[username] = {
        email, // Consolidating contact info (email or phone) into this field
        passwordHash,
        type: type || 'dine',
        identifier: identifier || '',
        createdAt: new Date().toISOString()
    };

    writeData('users.json', users);
    res.status(201).json({ message: 'Account created successfully' });
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    const users = readData('users.json');
    const user = users[username];

    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Support plain-text legacy password for admin seed (password123) and bcrypt
    let valid = false;
    if (user.passwordHash) {
        valid = await bcrypt.compare(password, user.passwordHash);
    }
    // Fallback for plain text (legacy)
    if (!valid && user.password) {
        valid = user.password === password;
    }

    if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.user = {
        username,
        email: user.email,
        type: user.type,
        identifier: user.identifier
    };

    res.json({
        message: 'Login successful',
        user: {
            username,
            email: user.email,
            type: user.type,
            identifier: user.identifier
        }
    });
});

// GET /api/auth/logout
app.get('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out' });
});

// GET /api/auth/me — check session
app.get('/api/auth/me', (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true, user: req.session.user });
    } else {
        res.json({ loggedIn: false });
    }
});

// ═══════════════════════════════════════════════════════
//  ORDERS ROUTES
// ═══════════════════════════════════════════════════════

// GET /api/orders — admin: all orders; user: their orders
app.get('/api/orders', requireAuth, (req, res) => {
    const orders = readData('orders.json');
    if (req.session.user.type === 'admin') {
        return res.json(orders);
    }
    res.json(orders.filter(o => o.user === req.session.user.username));
});

// POST /api/orders — place new order
app.post('/api/orders', requireAuth, (req, res) => {
    const { items, total } = req.body;
    if (!items || !items.length) {
        return res.status(400).json({ error: 'Cart is empty' });
    }

    const orders = readData('orders.json');
    const order = {
        id: Date.now().toString(),
        user: req.session.user.username,
        identifier: req.session.user.identifier || 'N/A',
        items,
        total,
        status: 'pending',
        time: new Date().toISOString()
    };

    orders.push(order);
    writeData('orders.json', orders);
    res.status(201).json({ message: 'Order placed', order });
});

// PATCH /api/orders/:id — update status (admin only)
app.patch('/api/orders/:id', requireAdmin, (req, res) => {
    const { status } = req.body;
    const orders = readData('orders.json');
    const idx = orders.findIndex(o => o.id === req.params.id);

    if (idx === -1) return res.status(404).json({ error: 'Order not found' });

    orders[idx].status = status;
    writeData('orders.json', orders);
    res.json({ message: 'Order updated', order: orders[idx] });
});

// ═══════════════════════════════════════════════════════
//  RESERVATIONS ROUTES
// ═══════════════════════════════════════════════════════

// POST /api/reservations — book a table
app.post('/api/reservations', (req, res) => {
    const { date, guests, time, name, email } = req.body;

    if (!date || !guests || !time) {
        return res.status(400).json({ error: 'Date, guests, and time are required' });
    }
    if (email && !isValidContact(email)) {
        return res.status(400).json({ error: 'Please enter a valid email or a 10-digit phone number' });
    }

    const reservations = readData('reservations.json');
    const reservation = {
        id: Date.now().toString(),
        date,
        guests,
        time,
        name: name || (req.session.user?.username || 'Guest'),
        email: email || '',
        status: 'confirmed',
        createdAt: new Date().toISOString()
    };

    reservations.push(reservation);
    writeData('reservations.json', reservations);
    res.status(201).json({ message: 'Reservation confirmed! We look forward to seeing you.', reservation });
});

// GET /api/reservations — admin: all reservations; user: their reservations
app.get('/api/reservations', requireAuth, (req, res) => {
    const reservations = readData('reservations.json');
    if (req.session.user.type === 'admin') {
        return res.json(reservations);
    }
    // Filter reservations by matching the user's username or email
    const userReservations = reservations.filter(r =>
        r.name === req.session.user.username ||
        r.email === req.session.user.email
    );
    res.json(userReservations);
});

// ═══════════════════════════════════════════════════════
//  CONTACT ROUTE
// ═══════════════════════════════════════════════════════

// POST /api/contact — save contact message
app.post('/api/contact', (req, res) => {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Name, contact info (email/phone) and message are required' });
    }
    if (!isValidContact(email)) {
        return res.status(400).json({ error: 'Please enter a valid email or a 10-digit phone number' });
    }

    const contacts = readData('contacts.json');
    contacts.push({
        id: Date.now().toString(),
        name,
        email, // This is the consolidated field (Email or Phone)
        subject,
        message,
        receivedAt: new Date().toISOString()
    });

    writeData('contacts.json', contacts);
    res.json({ message: 'Message received! We\'ll be in touch shortly.' });
});

// GET /api/contact — admin only
app.get('/api/contact', requireAdmin, (req, res) => {
    res.json(readData('contacts.json'));
});

// ── Serve index.html for root route ───────────────────────────────
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Catch-all: serve index.html for any unmatched route (SPA mode) ─
app.get('*', (req, res) => {
    // Only serve index.html for routes that don't have a file extension
    if (!req.path.includes('.')) {
        res.sendFile(path.join(__dirname, 'index.html'));
    } else {
        // Let static files be served normally
        res.status(404).send('Not found');
    }
});

// ── Start server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🍽  DineAura server running at http://localhost:${PORT}`);
    console.log(`   Admin credentials: admin / password123`);
    console.log(`   Press Ctrl+C to stop\n`);
});
