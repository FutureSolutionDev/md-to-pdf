let currentUser = null;

document.addEventListener("DOMContentLoaded", async () => {
  if (window.i18n) {
    await window.i18n.init();
  }
  initSidebar();
  initLangSwitcher();
  await checkAuth();
  updateAuthUI();
});

function initSidebar() {
  const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
  const saved = localStorage.getItem("sidebarCollapsed");

  if (saved === "true") {
    document.getElementById("sidebar")?.classList.add("collapsed");
  }

  sidebarToggleBtn?.addEventListener("click", () => {
    const sidebar = document.getElementById("sidebar");
    sidebar?.classList.toggle("collapsed");
    const collapsed = sidebar?.classList.contains("collapsed");
    localStorage.setItem("sidebarCollapsed", collapsed);
  });

  const mobileToggle = document.getElementById("sidebarToggle");
  mobileToggle?.addEventListener("click", () => {
    const sidebar = document.getElementById("sidebar");
    sidebar?.classList.toggle("open");
  });
}

async function checkAuth() {
  try {
    if (window.api) {
      const response = await window.api.me();
      currentUser = response;
    }
  } catch {
    currentUser = null;
  }
  updateAuthUI();
}

function updateAuthUI() {
  const userMenu = document.getElementById("userMenu");
  const authButtons = document.getElementById("authButtons");
  const navItems = document.querySelectorAll("[data-auth]");
  const sidebar = document.getElementById("sidebar");

  if (currentUser && currentUser.user) {
    userMenu.style.display = "flex";
    userMenu.querySelector(".user-name").textContent = currentUser.user.name || currentUser.user.email;
    authButtons.style.display = "none";
    sidebar.style.display = "flex";
  } else {
    userMenu.style.display = "none";
    authButtons.style.display = "flex";
    sidebar.style.display = "flex";
  }

  navItems.forEach(el => {
    const requiresAuth = el.getAttribute("data-auth") === "required";
    if (requiresAuth) {
      el.style.display = (currentUser && currentUser.user) ? "" : "none";
    }
  });
}

async function handleLogout() {
  try {
    if (window.api) {
      await window.api.logout();
    }
  } catch {}
  currentUser = null;
  updateAuthUI();
  if (window.router) {
    window.router.navigate("/convert");
  }
  const msg = window.i18n ? window.i18n.t("success.logout") : "Logged out";
  showToast(msg, "success");
}

function initLangSwitcher() {
  const langSelect = document.getElementById("langSelect");
  if (langSelect && window.i18n) {
    langSelect.value = window.i18n.currentLang;
    langSelect.addEventListener("change", async (e) => {
      await window.i18n.setLanguage(e.target.value);
      updateAuthUI();
    });
  }
}

function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === "success" ? "✓" : "✕"}</span>
    <span class="toast-message">${message}</span>
  `;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("toast-show"));

  setTimeout(() => {
    toast.classList.remove("toast-show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

window.showToast = showToast;
window.handleLogout = handleLogout;
window.checkAuth = checkAuth;
window.updateAuthUI = updateAuthUI;
window.currentUser = null;
Object.defineProperty(window, "currentUser", {
  get: () => currentUser,
  set: (v) => { currentUser = v; }
});
