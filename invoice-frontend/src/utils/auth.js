// ---------------------------------------------------------------------------
// Frontend-only auth. No server yet — credentials + session both live in
// localStorage. Swap this file's internals for real API calls later; the
// function signatures (login/logout/getSession/isAuthenticated) can stay.
// ---------------------------------------------------------------------------

const USERS_KEY = "rfz_users";
const SESSION_KEY = "rfz_session";

function seedDefaultUser() {
  if (!localStorage.getItem(USERS_KEY)) {
    localStorage.setItem(
      USERS_KEY,
      JSON.stringify([{ username: "admin", password: "admin123", name: "Admin", role: "Administrator" }])
    );
  }
}
seedDefaultUser();

export function login(username, password) {
  const users = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
  const user = users.find(
    (u) => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password
  );
  if (!user) return false;
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ username: user.username, name: user.name, role: user.role, loginAt: Date.now() })
  );
  return true;
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
}

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  return !!getSession();
}
