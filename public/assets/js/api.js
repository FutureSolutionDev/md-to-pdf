function parseResponseError(data, fallback) {
  if (!data) return fallback;
  if (typeof data === "string") return data || fallback;
  if (typeof data.error === "string" && data.error) return data.error;
  if (typeof data.message === "string" && data.message) return data.message;
  return fallback;
}

async function getErrorMessage(res) {
  const fallback = `Request failed with status ${res.status}`;
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const data = await res.json();
      return parseResponseError(data, fallback);
    } catch {
      return fallback;
    }
  }

  const text = await res.text();
  return text || fallback;
}

function parseContentLength(headerValue) {
  const total = Number.parseInt(headerValue || "", 10);
  return Number.isFinite(total) && total > 0 ? total : null;
}

function parseDownloadFilename(contentDisposition, fallbackName) {
  if (!contentDisposition) return fallbackName;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const basicMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return basicMatch?.[1] || fallbackName;
}

function triggerDownload(blob, fileName) {
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

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
    console.log("api.login called", email, password);
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

  async downloadFile(fileId, { fileName, onProgress } = {}) {
    const response = await fetch(`/api/files/${fileId}/download`, {
      credentials: "same-origin"
    });

    if (!response.ok) {
      throw new Error(await getErrorMessage(response));
    }

    const total = parseContentLength(response.headers.get("content-length"));
    const resolvedFileName = parseDownloadFilename(
      response.headers.get("content-disposition"),
      fileName || `file-${fileId}.pdf`
    );
    const reportProgress = typeof onProgress === "function" ? onProgress : null;

    if (reportProgress) {
      reportProgress({
        loaded: 0,
        total,
        percent: 0,
        indeterminate: total === null
      });
    }

    let blob;

    if (response.body?.getReader) {
      const reader = response.body.getReader();
      const chunks = [];
      let loaded = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (!value) continue;

          chunks.push(value);
          loaded += value.byteLength;

          if (reportProgress) {
            reportProgress({
              loaded,
              total,
              percent: total ? Math.round((loaded / total) * 100) : 0,
              indeterminate: total === null
            });
          }
        }
      } finally {
        reader.releaseLock();
      }

      blob = new Blob(chunks, {
        type: response.headers.get("content-type") || "application/pdf"
      });

      if (reportProgress) {
        reportProgress({
          loaded: blob.size,
          total: total ?? blob.size,
          percent: 100,
          indeterminate: false
        });
      }
    } else {
      blob = await response.blob();

      if (reportProgress) {
        reportProgress({
          loaded: blob.size,
          total: total ?? blob.size,
          percent: 100,
          indeterminate: false
        });
      }
    }

    triggerDownload(blob, resolvedFileName);

    return {
      fileName: resolvedFileName,
      size: blob.size
    };
  },

  async deleteFile(fileId) {
    return this.del(`/api/files/${fileId}`);
  },

  async getStorage() {
    return this.get("/api/storage");
  }
};

// Export for use in other scripts
window.api = api;
