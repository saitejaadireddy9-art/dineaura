/**
 * DineAura — Firebase Configuration
 * Using Firebase Modular SDK (v9+) via CDN
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCFeFkHfTs-nOvikiAR964W8kXXX-S15hg",
    authDomain: "dineaura-5555c.firebaseapp.com",
    projectId: "dineaura-5555c",
    storageBucket: "dineaura-5555c.firebasestorage.app",
    messagingSenderId: "48147109517",
    appId: "1:48147109517:web:ba49291432d75d8e6334c4",
    measurementId: "G-YPLQBYYMSN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

console.log("🔥 DineAura: Firebase & Firestore Initialized");

export { app, analytics, db };
