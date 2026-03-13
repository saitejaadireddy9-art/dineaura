/**
 * DineAura — Firebase Service Layer
 * Handles all Firestore reads/writes for:
 *   • users     (register / login)
 *   • orders    (place order / fetch history)
 *
 * Collections structure:
 *   users/{username}   → { username, contact, passwordHash, type, identifier, createdAt }
 *   orders/{orderId}   → { orderId, username, items[], total, status, placedAt, identifier }
 *
 * Usage (ES module import):
 *   import { fsRegister, fsLogin, fsPlaceOrder, fsGetOrders } from './firebase-service.js';
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getFirestore,
    doc, getDoc, setDoc, addDoc,
    collection, query, where, orderBy, getDocs,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ── Firebase init (same project as firebase-config.js) ──────────────────────
const firebaseConfig = {
    apiKey: "AIzaSyCFeFkHfTs-nOvikiAR964W8kXXX-S15hg",
    authDomain: "dineaura-5555c.firebaseapp.com",
    projectId: "dineaura-5555c",
    storageBucket: "dineaura-5555c.firebasestorage.app",
    messagingSenderId: "48147109517",
    appId: "1:48147109517:web:ba49291432d75d8e6334c4"
};

const app = initializeApp(firebaseConfig, "dineaura-service");
const db = getFirestore(app);

// ────────────────────────────────────────────────────────────────────────────
//  SIMPLE PASSWORD HASH  (SHA-256 via Web Crypto — no library needed)
// ────────────────────────────────────────────────────────────────────────────
async function hashPassword(plain) {
    const buf = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(plain)
    );
    return Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

// ────────────────────────────────────────────────────────────────────────────
//  REGISTER  →  users/{username}
// ────────────────────────────────────────────────────────────────────────────
/**
 * @param {object} payload  { username, contact, password, type, identifier }
 * @returns {{ ok:boolean, error?:string }}
 */
export async function fsRegister({ username, contact, password, type, identifier }) {
    if (!username || !contact || !password) {
        return { ok: false, error: "All fields are required." };
    }
    if (password.length < 6) {
        return { ok: false, error: "Password must be at least 6 characters." };
    }

    const userRef = doc(db, "users", username);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
        return { ok: false, error: "Username already taken." };
    }

    const passwordHash = await hashPassword(password);

    await setDoc(userRef, {
        username,
        contact,          // email or phone
        passwordHash,
        type: type || "dine",
        identifier: identifier || "",
        createdAt: serverTimestamp()
    });

    console.log(`✅ [Firestore] User registered: ${username}`);
    return { ok: true };
}

// ────────────────────────────────────────────────────────────────────────────
//  LOGIN  →  read users/{username}, compare hash
// ────────────────────────────────────────────────────────────────────────────
/**
 * @param {object} payload  { username, password }
 * @returns {{ ok:boolean, user?:object, error?:string }}
 */
export async function fsLogin({ username, password }) {
    if (!username || !password) {
        return { ok: false, error: "Username and password are required." };
    }

    const snap = await getDoc(doc(db, "users", username));

    if (!snap.exists()) {
        return { ok: false, error: "Invalid credentials." };
    }

    const data = snap.data();
    const hash = await hashPassword(password);

    if (hash !== data.passwordHash) {
        return { ok: false, error: "Invalid credentials." };
    }

    const user = {
        username: data.username,
        contact: data.contact,
        type: data.type,
        identifier: data.identifier
    };

    console.log(`✅ [Firestore] Login success: ${username}`);
    return { ok: true, user };
}

// ────────────────────────────────────────────────────────────────────────────
//  PLACE ORDER  →  orders/{auto-id}
// ────────────────────────────────────────────────────────────────────────────
/**
 * @param {object} payload  { username, identifier, items[], total, orderNum }
 * @returns {{ ok:boolean, orderId?:string, error?:string }}
 */
export async function fsPlaceOrder({ username, identifier, items, total, orderNum }) {
    if (!items || !items.length) {
        return { ok: false, error: "Cart is empty." };
    }

    const ref = await addDoc(collection(db, "orders"), {
        orderId: orderNum || ("ORD-" + Date.now()),
        username: username || "guest",
        identifier: identifier || "walk-in",
        items,          // [{ name, price, qty }]
        total,
        status: "pending",
        placedAt: serverTimestamp()
    });

    console.log(`✅ [Firestore] Order placed: ${ref.id} for ${username}`);
    return { ok: true, orderId: ref.id };
}

// ────────────────────────────────────────────────────────────────────────────
//  GET ORDERS  →  orders where username == …
// ────────────────────────────────────────────────────────────────────────────
/**
 * @param {string} username
 * @returns {Array}  ordered by placedAt desc
 */
export async function fsGetOrders(username) {
    const q = query(
        collection(db, "orders"),
        where("username", "==", username),
        orderBy("placedAt", "desc")
    );
    const snaps = await getDocs(q);
    return snaps.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ────────────────────────────────────────────────────────────────────────────
//  GET ALL ORDERS (admin)
// ────────────────────────────────────────────────────────────────────────────
export async function fsGetAllOrders() {
    const q = query(collection(db, "orders"), orderBy("placedAt", "desc"));
    const snaps = await getDocs(q);
    return snaps.docs.map(d => ({ id: d.id, ...d.data() }));
}

console.log("🔥 DineAura Firebase Service loaded (users + orders)");
