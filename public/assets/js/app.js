let currentUser = null;

document.addEventListener("DOMContentLoaded", async () => {
  await i18n.init();
  initRouter();
  initSidebar();
  initLangSwitcher();
  initToast();
  await checkAuth();
  updateAuthUI();
});

function initRouter() {
  router.addRoute("/", () => router.navigate("/convert"));
  router.addRoute("/convert", renderConvertPage);
  router.addRoute("/files", renderFilesPage);
  router.addRoute("/login", renderLoginPage);
  router.addRoute("/register", renderRegisterPage);
  router.addRoute("/404", render404Page);

  router.init();
}

async function checkAuth() {
  try {
    currentUser = await api.me();
  } catch {
    currentUser = null;
  }
  updateAuthUI();
}

function updateAuthUI() {
  const userMenu = document.getElementById("userMenu");
  const authLinks = document.querySelectorAll("[data-auth]");

  if (currentUser && userMenu) {
    userMenu.innerHTML = `
      <span class="user-name">${currentUser.name || currentUser.email}</span>
      <button class="logout-btn" onclick="handleLogout()">${i18n.t ? i18n.t("logout") : "تسجيل خروج"}</button>
    `;
  }

  authLinks.forEach(el => {
    const requiresAuth = el.getAttribute("data-auth") === "required";
    if (requiresAuth) {
      el.style.display = currentUser ? "" : "none";
    } else {
      el.style.display = currentUser ? "none" : "";
    }
  });
}

async function handleLogout() {
  try {
    await api.logout();
  } catch {}
  currentUser = null;
  updateAuthUI();
  router.navigate("/login");
  showToast(i18n.t ? i18n.t("loggedOut") : "تم تسجيل الخروج بنجاح", "success");
}

async function renderConvertPage() {
  await router.loadPage("convert");
}

async function renderFilesPage() {
  if (!currentUser) {
    router.navigate("/login");
    return;
  }
  await router.loadPage("files");
}

async function renderLoginPage() {
  if (currentUser) {
    router.navigate("/convert");
    return;
  }
  await router.loadPage("login");
}

async function renderRegisterPage() {
  if (currentUser) {
    router.navigate("/convert");
    return;
  }
  await router.loadPage("register");
}

async function render404Page() {
  await router.loadPage("404");
}

function initSidebar() {
  const toggle = document.getElementById("sidebarToggle");
  const saved = localStorage.getItem("sidebarCollapsed");
  if (saved === "true") {
    document.body.classList.add("sidebar-collapsed");
  }
  toggle?.addEventListener("click", toggleSidebar);
}

function toggleSidebar() {
  document.body.classList.toggle("sidebar-collapsed");
  const collapsed = document.body.classList.contains("sidebar-collapsed");
  localStorage.setItem("sidebarCollapsed", collapsed);
}

function initLangSwitcher() {
  const langSelect = document.getElementById("langSelect");
  if (langSelect) {
    langSelect.value = i18n.currentLang;
    langSelect.addEventListener("change", async (e) => {
      await i18n.setLanguage(e.target.value);
      updateAuthUI();
    });
  }
}

function initToast() {
  window.showToast = showToast;
}

function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer") || createToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === "success" ? "✓" : "✕"}</span>
    <span class="toast-message">${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast-show");
  }, 10);

  setTimeout(() => {
    toast.classList.remove("toast-show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function createToastContainer() {
  const container = document.createElement("div");
  container.id = "toastContainer";
  container.className = "toast-container";
  document.body.appendChild(container);

  if (!document.getElementById("toastStyles")) {
    const style = document.createElement("style");
    style.id = "toastStyles";
    style.textContent = `
      .toast-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .toast {
        padding: 12px 20px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        opacity: 0;
        transform: translateX(20px);
        transition: all 0.3s ease;
      }
      .toast-show {
        opacity: 1;
        transform: translateX(0);
      }
      .toast-success {
        background: #15803d;
        color: #fff;
      }
      .toast-error {
        background: #dc2626;
        color: #fff;
      }
      .toast-icon {
        font-size: 16px;
      }
    `;
    document.head.appendChild(style);
  }

  return container;
}