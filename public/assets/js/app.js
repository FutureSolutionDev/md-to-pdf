let currentUser = null;

document.addEventListener("DOMContentLoaded", async () => {
  if (window.i18n) {
    await window.i18n.init();
  }
  initRouter();
  initSidebar();
  initLangSwitcher();
  initToast();
  await checkAuth();
  updateAuthUI();
});

function initRouter() {
  if (!window.router) {
    console.error("Router not initialized");
    return;
  }
  window.router.addRoute("/", () => window.router.navigate("/convert"));
  window.router.addRoute("/convert", renderConvertPage);
  window.router.addRoute("/files", renderFilesPage);
  window.router.addRoute("/login", renderLoginPage);
  window.router.addRoute("/register", renderRegisterPage);
  window.router.addRoute("/404", render404Page);

  window.router.init();
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
    // Show user menu, hide auth buttons
    userMenu.style.display = "flex";
    userMenu.querySelector(".user-name").textContent = currentUser.user.name || currentUser.user.email;
    authButtons.style.display = "none";
    
    // Show sidebar
    sidebar.style.display = "flex";
  } else {
    // Show auth buttons, hide user menu
    userMenu.style.display = "none";
    authButtons.style.display = "flex";
    
    // Still show sidebar for guests (optional - can hide if preferred)
    sidebar.style.display = "flex";
  }

  // Update nav items visibility based on auth requirement
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
  const loggedOutText = window.i18n ? window.i18n.t("success.loggedOut") : "تم تسجيل الخروج بنجاح";
  showToast(loggedOutText, "success");
}

async function renderConvertPage() {
  if (window.router) {
    await window.router.loadPage("convert");
  }
}

async function renderFilesPage() {
  if (!currentUser) {
    if (window.router) {
      window.router.navigate("/login");
    }
    return;
  }
  if (window.router) {
    await window.router.loadPage("files");
  }
}

async function renderLoginPage() {
  if (currentUser) {
    if (window.router) {
      window.router.navigate("/convert");
    }
    return;
  }
  if (window.router) {
    await window.router.loadPage("login");
  }
}

async function renderRegisterPage() {
  if (currentUser) {
    if (window.router) {
      window.router.navigate("/convert");
    }
    return;
  }
  if (window.router) {
    await window.router.loadPage("register");
  }
}

async function render404Page() {
  if (window.router) {
    await window.router.loadPage("404");
  }
}

function initSidebar() {
  // Toggle button in sidebar
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
  
  // Mobile hamburger menu
  const mobileToggle = document.getElementById("sidebarToggle");
  mobileToggle?.addEventListener("click", () => {
    const sidebar = document.getElementById("sidebar");
    sidebar?.classList.toggle("open");
  });
}

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  sidebar?.classList.toggle("collapsed");
  const collapsed = sidebar?.classList.contains("collapsed");
  localStorage.setItem("sidebarCollapsed", collapsed);
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