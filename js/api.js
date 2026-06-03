const API_BASE = "http://localhost:8080";

const ROLE_CONFIG = {
  USER: {
    tokenKey: "USER_TOKEN",
    emailKey: "USER_EMAIL",
    roleKey: "USER_ROLE",
    idKey: "USER_ID",
    nameKey: "USER_NAME",
    loginPage: "user-login.html",
    dashboardPage: "user.html",
    listPath: "/api/users"
  },
  ADMIN: {
    tokenKey: "ADMIN_TOKEN",
    emailKey: "ADMIN_EMAIL",
    roleKey: "ADMIN_ROLE",
    idKey: "ADMIN_ID",
    nameKey: "ADMIN_NAME",
    loginPage: "admin-login.html",
    dashboardPage: "admin.html",
    listPath: "/api/admins"
  }
};

function getRoleConfig(role = "USER") {
  return ROLE_CONFIG[role] || ROLE_CONFIG.USER;
}

function getUserToken() {
  return localStorage.getItem(ROLE_CONFIG.USER.tokenKey);
}

function getAdminToken() {
  return localStorage.getItem(ROLE_CONFIG.ADMIN.tokenKey);
}

function getAuthHeaders(role = "USER") {
  const token = role === "ADMIN" ? getAdminToken() : getUserToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getSession(role = "USER") {
  const config = getRoleConfig(role);
  return {
    token: localStorage.getItem(config.tokenKey),
    email: localStorage.getItem(config.emailKey),
    role: localStorage.getItem(config.roleKey),
    id: localStorage.getItem(config.idKey),
    name: localStorage.getItem(config.nameKey)
  };
}

function setSession(role, data = {}) {
  const config = getRoleConfig(role);
  if (data.token) localStorage.setItem(config.tokenKey, data.token);
  if (data.email) localStorage.setItem(config.emailKey, data.email);
  if (data.role) localStorage.setItem(config.roleKey, data.role);
  if (data.id !== undefined && data.id !== null) localStorage.setItem(config.idKey, data.id);
  if (data.name) localStorage.setItem(config.nameKey, data.name);
}

function clearSession(role = "USER") {
  const config = getRoleConfig(role);
  localStorage.removeItem(config.tokenKey);
  localStorage.removeItem(config.emailKey);
  localStorage.removeItem(config.roleKey);
  localStorage.removeItem(config.idKey);
  localStorage.removeItem(config.nameKey);
}

function requireSession(role = "USER") {
  const session = getSession(role);
  if (!session.token) {
    window.location.href = getRoleConfig(role).loginPage;
    return null;
  }
  return session;
}

async function apiRequest(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const isFormBody = options.body instanceof FormData;

  if (!isFormBody && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message = data?.message || data?.error || data?.detail || data || `Request failed with ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function resolveCurrentAccount(role = "USER", force = false) {
  const session = getSession(role);
  if (!session.token || !session.email) return null;
  if (session.id && !force) return session;

  const config = getRoleConfig(role);
  const accounts = await apiRequest(config.listPath, {
    headers: getAuthHeaders(role)
  });

  const account = (accounts || []).find(item => {
    return String(item.email || "").toLowerCase() === String(session.email).toLowerCase();
  });

  if (account) {
    setSession(role, account);
    return { ...session, ...account, id: String(account.id) };
  }

  return session;
}

function getCurrentId(role = "USER") {
  return Number(localStorage.getItem(getRoleConfig(role).idKey));
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function showToast(message, type = "success") {
  const toast = document.getElementById("toast") || document.getElementById("message");
  if (!toast) return;

  toast.textContent = message;
  toast.className = `${toast.classList.contains("message") ? "message" : "toast"} ${type}`;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.className = toast.classList.contains("message") ? "message" : "toast";
    toast.textContent = "";
  }, 4200);
}

function setButtonBusy(button, busy, label = "Working...") {
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.textContent = label;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

function safe(value) {
  return value === null || value === undefined ? "" : String(value);
}

function escapeHtml(value) {
  return safe(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return safe(value);
  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function accountLabel(item, fallback = "Account") {
  return escapeHtml(item?.name || item?.email || `${fallback} #${item?.id || ""}`);
}

function getStatusLabel(item) {
  if (item?.active === false) return "Inactive";
  if (item?.resolved === true) return "Resolved";
  if (item?.approved === true) return "Approved";
  if (item?.approved === false) return "Pending";
  return item?.active === true ? "Active" : "Available";
}

function statusBadge(item) {
  const label = getStatusLabel(item);
  const key = label.toLowerCase();
  return `<span class="status ${key}">${label}</span>`;
}

function renderCards(containerId, items, renderer, emptyText = "No records found.") {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!items || items.length === 0) {
    container.innerHTML = `<div class="empty-state">${escapeHtml(emptyText)}</div>`;
    return;
  }

  container.innerHTML = items.map(renderer).join("");
}

function setupNavigation() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-btn").forEach(item => item.classList.remove("active"));
      document.querySelectorAll(".panel").forEach(panel => panel.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.section)?.classList.add("active");
    });
  });
}

function updateStat(id, value) {
  setText(id, value ?? 0);
}

let activeModal = null;
let focusedBeforeModal = null;

function ensureModalRoot() {
  let modal = document.getElementById("appModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "appModal";
  modal.className = "modal-overlay";
  modal.setAttribute("hidden", "");
  modal.innerHTML = `
    <section class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <button class="modal-close" type="button" data-modal-close aria-label="Close dialog">x</button>
      <div class="modal-header">
        <p id="modalEyebrow" class="eyebrow"></p>
        <h2 id="modalTitle"></h2>
      </div>
      <div id="modalBody" class="modal-body"></div>
      <div id="modalFooter" class="modal-footer"></div>
    </section>
  `;
  document.body.appendChild(modal);

  modal.addEventListener("click", event => {
    if (event.target === modal && modal.dataset.closeOnBackdrop !== "false") {
      closeModal();
    }
  });

  modal.querySelector("[data-modal-close]")?.addEventListener("click", () => closeModal());
  document.addEventListener("keydown", handleModalKeydown);

  return modal;
}

function handleModalKeydown(event) {
  if (!activeModal || event.key !== "Escape" || activeModal.dataset.locked === "true") return;
  closeModal();
}

function openModal(config = {}) {
  const modal = ensureModalRoot();
  const dialog = modal.querySelector(".modal-dialog");
  const eyebrow = modal.querySelector("#modalEyebrow");
  const title = modal.querySelector("#modalTitle");
  const body = modal.querySelector("#modalBody");
  const footer = modal.querySelector("#modalFooter");
  const closeButton = modal.querySelector("[data-modal-close]");

  focusedBeforeModal = document.activeElement;
  activeModal = modal;
  modal.dataset.closeOnBackdrop = String(config.closeOnBackdrop !== false);
  modal.dataset.locked = "false";
  modal.className = `modal-overlay active ${config.tone ? `modal-${config.tone}` : ""} ${config.size ? `modal-${config.size}` : ""}`.trim();
  modal.removeAttribute("hidden");
  document.body.classList.add("modal-open");

  dialog.dataset.danger = config.danger ? "true" : "false";
  title.textContent = config.title || "Dialog";
  eyebrow.textContent = config.eyebrow || "";
  eyebrow.hidden = !config.eyebrow;
  body.innerHTML = config.body || "";
  footer.innerHTML = "";
  closeButton.disabled = false;

  const cancelText = config.cancelText || "Cancel";
  if (config.showCancel !== false) {
    footer.insertAdjacentHTML("beforeend", `<button type="button" class="secondary-btn" data-modal-cancel>${escapeHtml(cancelText)}</button>`);
    footer.querySelector("[data-modal-cancel]")?.addEventListener("click", () => closeModal());
  }

  if (config.submitText) {
    const submitClass = config.danger ? "danger" : (config.tone === "admin" ? "admin-tone" : "");
    footer.insertAdjacentHTML(
      "beforeend",
      `<button type="button" class="${submitClass}" data-modal-submit>${escapeHtml(config.submitText)}</button>`
    );
  }

  const submitButton = footer.querySelector("[data-modal-submit]");
  const form = body.querySelector("form");
  const modalApi = {
    close: closeModal,
    getForm: () => form,
    setBusy: (busy, label) => setModalBusy(busy, label)
  };

  if (form && config.onSubmit) {
    form.addEventListener("submit", event => {
      event.preventDefault();
      config.onSubmit(event, modalApi);
    });
  }

  submitButton?.addEventListener("click", () => {
    if (form) {
      form.requestSubmit();
      return;
    }
    config.onSubmit?.(null, modalApi);
  });

  modal.onCloseModal = config.onClose || null;

  window.setTimeout(() => {
    const firstFocusable = modal.querySelector("input, textarea, select")
      || modal.querySelector("[data-modal-submit]")
      || modal.querySelector("button:not([disabled]), [tabindex]:not([tabindex='-1'])");
    firstFocusable?.focus();
  }, 0);

  return modalApi;
}

function setModalBusy(busy, label = "Working...") {
  const modal = activeModal;
  if (!modal) return;

  modal.dataset.locked = busy ? "true" : "false";
  modal.querySelectorAll("button, input, textarea, select").forEach(element => {
    if (busy) {
      element.dataset.modalDisabled = element.disabled ? "true" : "false";
      element.disabled = true;
    } else {
      element.disabled = element.dataset.modalDisabled === "true";
      delete element.dataset.modalDisabled;
    }
  });

  const submitButton = modal.querySelector("[data-modal-submit]");
  if (!submitButton) return;
  if (busy) {
    submitButton.dataset.originalText = submitButton.textContent;
    submitButton.textContent = label;
  } else {
    submitButton.textContent = submitButton.dataset.originalText || submitButton.textContent;
  }
}

function closeModal() {
  const modal = activeModal || document.getElementById("appModal");
  if (!modal || modal.hasAttribute("hidden") || modal.dataset.locked === "true") return;

  const onClose = modal.onCloseModal;
  modal.setAttribute("hidden", "");
  modal.className = "modal-overlay";
  modal.querySelector("#modalBody").innerHTML = "";
  modal.querySelector("#modalFooter").innerHTML = "";
  document.body.classList.remove("modal-open");
  activeModal = null;
  modal.onCloseModal = null;

  if (typeof onClose === "function") onClose();
  if (focusedBeforeModal?.isConnected && typeof focusedBeforeModal.focus === "function") {
    focusedBeforeModal.focus();
  }
  focusedBeforeModal = null;
}

function openConfirmModal(config = {}) {
  return openModal({
    title: config.title || "Confirm action",
    eyebrow: config.eyebrow || "Please confirm",
    body: `
      <div class="confirm-copy">
        <p>${escapeHtml(config.message || "This action cannot be undone.")}</p>
        ${config.detail ? `<span>${escapeHtml(config.detail)}</span>` : ""}
      </div>
    `,
    submitText: config.confirmText || "Confirm",
    cancelText: config.cancelText || "Cancel",
    danger: config.danger !== false,
    tone: config.tone,
    onSubmit: async (event, modal) => {
      modal.setBusy(true, config.busyText || "Working...");
      try {
        await config.onConfirm?.();
        modal.setBusy(false);
        modal.close();
      } catch (error) {
        modal.setBusy(false);
        if (!error.toastShown) showToast(error.message, "error");
      }
    }
  });
}
