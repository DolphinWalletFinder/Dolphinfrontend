// login-api.js

const API_BASE_URL = "https://web-production-13d5a.up.railway.app/api";

const USERNAME_RE = /^[A-Za-z0-9]+$/;
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;
// ایمیل ساده و معتبر (ASCII)؛ TLD حداقل 2 حرف
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

/** Normalize & sanitize email to avoid hidden RTL/zero-width etc. */
function sanitizeEmail(raw) {
  const s = String(raw || "")
    .trim()
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\u00A0]/g, "")
    .normalize("NFKC")
    .toLowerCase();

  const fa = "۰۱۲۳۴۵۶۷۸۹";
  const ar = "٠١٢٣٤٥٦٧٨٩";
  return [...s].map(ch => {
    const iFa = fa.indexOf(ch);
    if (iFa !== -1) return String(iFa);
    const iAr = ar.indexOf(ch);
    if (iAr !== -1) return String(iAr);
    return ch;
  }).join("");
}

/**
 * Register a new user
 */
async function register(username, email, password) {
  const cleanUsername = String(username || "").trim();
  const cleanEmail = sanitizeEmail(email);
  const cleanPassword = String(password || "");

  if (!USERNAME_RE.test(cleanUsername))
    throw new Error('Username must contain only English letters and digits.');
  if (!EMAIL_RE.test(cleanEmail))
    throw new Error('Invalid email format.');
  if (!PASSWORD_RE.test(cleanPassword))
    throw new Error('Password must be at least 6 chars and include letters and digits.');

  let res;
  try {
    res = await fetch(API_BASE_URL + "/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: cleanUsername, email: cleanEmail, password: cleanPassword })
    });
  } catch (e) {
    throw new Error("Network error while contacting server.");
  }

  let data;
  try { data = await res.json(); }
  catch { throw new Error(`Server returned status ${res.status} with a non-JSON response.`); }

  if (!res.ok) {
    const msg = data?.error || data?.message || (Array.isArray(data?.errors) ? data.errors.join(", ") : null) || "Registration failed";
    throw new Error(msg + (res.status ? ` (HTTP ${res.status})` : ""));
  }
  return data;
}

/**
 * Decide where to send the user after login based on scan completion.
 * Logic: if user has a wallet record -> go to results; else -> go to scan.
 */
async function smartRedirectAfterLogin() {
  const token = localStorage.getItem("token");
  if (!token) { window.location.href = "/pages/login.html"; return; }
  try {
    const res = await fetch(API_BASE_URL + "/my-wallet", {
      method: "GET",
      headers: { "Authorization": "Bearer " + token }
    });
    if (res.ok) {
      const data = await res.json();
      const hasCompletedScan = !!(data && data.wallet);
      if (hasCompletedScan) window.location.href = "/pages/results.html";
      else window.location.href = "/pages/scan.html";
    } else {
      window.location.href = "/pages/scan.html";
    }
  } catch (_) {
    window.location.href = "/pages/scan.html";
  }
}

/**
 * Login user
 */
async function login(username, password) {
  const res = await fetch(API_BASE_URL + "/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();

  if (data.token) {
    // Store token
    localStorage.setItem("token", data.token);

    // Parse role from JWT if possible
    try {
      const payload = JSON.parse(atob(data.token.split('.')[1] || '{}'));
      const role = payload.role || "user";
      localStorage.setItem("role", role);
      localStorage.setItem("username", payload.username || username);

      if (role === "admin") {
        window.location.href = "/pages/admin-licenses.html";
      } else {
        await smartRedirectAfterLogin();
      }
    } catch (err) {
      console.error("JWT parsing error:", err);
      await smartRedirectAfterLogin();
    }
  } else {
    throw new Error(data.error || "Login failed");
  }

  return data;
}

/**
 * Reset password using username + email + newPassword
 */
async function resetPassword(username, email, newPassword) {
  const cleanUsername = String(username || "").trim();
  const cleanEmail = sanitizeEmail(email);
  const cleanPassword = String(newPassword || "");

  if (!USERNAME_RE.test(cleanUsername)) throw new Error('Invalid username format.');
  if (!EMAIL_RE.test(cleanEmail)) throw new Error('Invalid email format.');
  if (!PASSWORD_RE.test(cleanPassword)) throw new Error('Password must be at least 6 chars and include letters and digits.');

  const res = await fetch(API_BASE_URL + "/password/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: cleanUsername, email: cleanEmail, newPassword: cleanPassword })
  });
  const data = await res.json();
  if (!res.ok && data && data.error) throw new Error(data.error);
  return data; // { ok: true } even if user not found (generic)
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("username");
  window.location.href = "/pages/login.html";
}

// Expose to global scope
window.DWF_API = {
  API_BASE_URL,
  register,
  login,
  resetPassword,
  smartRedirectAfterLogin,
  logout
};
