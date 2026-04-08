const api = {
  async get(url) {
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) throw new Error(await res.text());
    const text = res.headers.get("content-type")?.includes("application/json")
      ? await res.text()
      : await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  },

  async post(url, data) {
    const isFormData = data instanceof FormData;
    const res = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      ...(isFormData ? { body: data } : {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })
    });
    if (!res.ok) throw new Error(await res.text());
    const text = res.headers.get("content-type")?.includes("application/json")
      ? await res.text()
      : await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  },

  async del(url) {
    const res = await fetch(url, {
      method: "DELETE",
      credentials: "same-origin"
    });
    if (!res.ok) throw new Error(await res.text());
    const text = res.headers.get("content-type")?.includes("application/json")
      ? await res.text()
      : await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  },

  async register(name, email, password) {
    return this.post("/api/auth/register", { name, email, password });
  },

  async login(email, password) {
    return this.post("/api/auth/login", { email, password });
  },

  async logout() {
    return this.post("/api/auth/logout", {});
  },

  async me() {
    return this.get("/api/auth/me");
  },

  checkAuth() {
    return this.me().then(() => true).catch(() => false);
  },

  async convert(file) {
    const formData = new FormData();
    formData.append("file", file);
    return this.post("/convert", formData);
  },

  getStreamUrl(jobId) {
    return `/stream/${jobId}`;
  },

  async saveFile(jobId) {
    return this.post(`/api/files/save/${jobId}`, {});
  },

  async getFiles() {
    return this.get("/api/files");
  },

  async downloadFile(fileId) {
    return this.get(`/api/files/${fileId}/download`);
  },

  async deleteFile(fileId) {
    return this.del(`/api/files/${fileId}`);
  },

  async getStorage() {
    return this.get("/api/storage");
  }
};

export default api;