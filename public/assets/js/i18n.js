class I18n {
  constructor() {
    this.currentLang = "ar";
    this.translations = {};
  }

  async init() {
    const saved = localStorage.getItem("lang");
    this.currentLang = saved || "ar";
    await this.loadTranslations(this.currentLang);
    this.updateDOM();
  }

  async loadTranslations(lang) {
    try {
      const res = await fetch(`/api/i18n/${lang}`, {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
      });
      if (!res.ok) {
        throw new Error(`Failed to load ${lang} translations`);
      }
      this.translations = await res.json();
    } catch (err) {
      console.error("I18n: Failed to load translations", err);
      this.translations = {};
    }
  }

  async setLanguage(lang) {
    this.currentLang = lang;
    localStorage.setItem("lang", lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    await this.loadTranslations(lang);
    this.updateDOM();
  }

  t(key, params = {}) {
    let text = this.translations[key] || key;
    Object.keys(params).forEach((k) => {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), params[k]);
    });
    return text;
  }

  updateDOM() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      el.textContent = this.t(key);
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      el.placeholder = this.t(key);
    });

    document.documentElement.lang = this.currentLang;
    document.documentElement.dir = this.currentLang === "ar" ? "rtl" : "ltr";
  }
}

// Export for use in other scripts
window.i18n = new I18n();
