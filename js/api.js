const API_BASE = "http://localhost:8080";

function getUserToken() {
  return localStorage.getItem("USER_TOKEN");
}

function getAdminToken() {
  return localStorage.getItem("ADMIN_TOKEN");
}

function getAuthHeaders(role = "USER") {
  const token = role === "ADMIN" ? getAdminToken() : getUserToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message = data?.message || data?.error || data || `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return data;
}

function showToast(message, type = "success") {
  const toast = document.getElementById("toast") || document.getElementById("message");
  if (!toast) return;

  toast.textContent = message;
  toast.className = `${toast.classList.contains("message") ? "message" : "toast"} ${type}`;
  setTimeout(() => {
    toast.className = toast.classList.contains("message") ? "message" : "toast";
  }, 3500);
}

function renderCards(containerId, items, renderer) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!items || items.length === 0) {
    container.innerHTML = `<div class="card">No records found.</div>`;
    return;
  }

  container.innerHTML = items.map(renderer).join("");
}

function safe(value) {
  return value === null || value === undefined ? "" : String(value);
}

function setupNavigation() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.section)?.classList.add("active");
    });
  });
}
