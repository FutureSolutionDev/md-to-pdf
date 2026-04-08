class Router {
  constructor() {
    this.routes = new Map();
    this.currentPath = null;
    this.beforeEach = null;
  }

  addRoute(path, handler) {
    this.routes.set(path, handler);
  }

  navigate(path) {
    history.pushState(null, '', path);
    this.handleRoute(path);
  }

  async handleRoute(path) {
    this.currentPath = path;
    window.scrollTo(0, 0);
    this.updateNav(path);

    const handler = this.routes.get(path);

    if (handler) {
      const result = await handler();
      if (result === false) return;
    } else {
      const notFoundHandler = this.routes.get('/404');
      if (notFoundHandler) {
        await notFoundHandler();
      }
    }
  }

  updateNav(path) {
    document.querySelectorAll('[data-nav]').forEach(el => {
      const navPath = el.getAttribute('data-nav');
      if (navPath === path || (path.startsWith(navPath) && navPath !== '/')) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
  }

  async loadPage(page) {
    try {
      const res = await fetch(`/pages/${page}.html`);
      if (!res.ok) throw new Error('Page not found');
      const html = await res.text();
      const app = document.getElementById('app');
      if (app) {
        // Extract scripts and inline them
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Get all scripts
        const scripts = [];
        tempDiv.querySelectorAll('script').forEach(script => {
          scripts.push(script.textContent);
          script.remove();
        });
        
        // Set the HTML without scripts
        app.innerHTML = tempDiv.innerHTML;
        
        // Execute scripts
        scripts.forEach(scriptText => {
          if (scriptText && scriptText.trim()) {
            try {
              eval(scriptText);
            } catch (err) {
              console.error('Script error:', err);
            }
          }
        });
        
        // Call the init function for this page
        const initFn = `init${page.charAt(0).toUpperCase() + page.slice(1)}`;
        if (typeof window[initFn] === 'function') {
          console.log('Calling', initFn);
          window[initFn]();
        }
        
        console.log('Page loaded:', page);
      }
    } catch (err) {
      console.error('Failed to load page:', err);
    }
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  async init() {
    console.log('Router.init() started');
    const path = window.location.pathname;
    const initialPath = path === '/' ? '/convert' : path;
    console.log('Initial path:', initialPath);

    window.addEventListener('popstate', () => {
      console.log('Popstate event');
      this.handleRoute(window.location.pathname);
    });

    // Add click handler
    document.addEventListener('click', (e) => {
      const link = e.target.closest('[data-link]');
      if (link) {
        console.log('Link clicked:', link.href);
        e.preventDefault();
        const href = link.getAttribute('href');
        console.log('Navigating to:', href);
        if (href && href !== window.location.pathname) {
          this.navigate(href);
        }
      }
    });

    console.log('Calling handleRoute for:', initialPath);
    await this.handleRoute(initialPath);
    console.log('Router.init() completed');
  }

  setBeforeEach(fn) {
    this.beforeEach = fn;
  }

  async checkAuth() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (!res.ok) return false;
      const data = await res.json();
      return data.user && data.user.id;
    } catch {
      return false;
    }
  }

  redirect(path) {
    this.navigate(path);
  }
}

const router = new Router();

router.addRoute('/', () => {
  router.navigate('/convert');
});

router.addRoute('/convert', async () => {
  await router.loadPage('convert');
});

router.addRoute('/files', async () => {
  const isAuth = await router.checkAuth();
  if (!isAuth) {
    router.redirect('/login');
    return false;
  }
  await router.loadPage('files');
});

router.addRoute('/login', async () => {
  const isAuth = await router.checkAuth();
  if (isAuth) {
    router.redirect('/convert');
    return false;
  }
  await router.loadPage('login');
});

router.addRoute('/register', async () => {
  const isAuth = await router.checkAuth();
  if (isAuth) {
    router.redirect('/convert');
    return false;
  }
  await router.loadPage('register');
});

router.addRoute('/404', async () => {
  await router.loadPage('404');
});

// Export for use in other scripts
window.router = router;

// Don't auto-init here - let the first page load trigger init
console.log('Router: Defined, waiting for first page load...');
