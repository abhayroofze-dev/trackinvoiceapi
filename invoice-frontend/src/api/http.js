// src/api/http.js
//
// Thin fetch wrapper for calling the Node/Express backend
// (invoice-backend). Base URL comes from VITE_API_BASE_URL if you set it
// in a .env file, otherwise it defaults to the backend's default port.

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    // No JSON body (e.g. network error page) — leave body as null.
  }

  if (!res.ok || (body && body.success === false)) {
    const message = body?.message || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return body;
}

export const http = {
  get: (path) => request(path),
  post: (path, data) => request(path, { method: "POST", body: JSON.stringify(data) }),
  put: (path, data) => request(path, { method: "PUT", body: JSON.stringify(data) }),
  patch: (path, data) => request(path, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (path) => request(path, { method: "DELETE" }),
};

export { API_BASE };
