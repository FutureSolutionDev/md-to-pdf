import db from "./db.js";
import { existsSync, mkdirSync, copyFileSync, statSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const MAX_FILES_PER_USER = 20;
const MAX_STORAGE_PER_USER = 100 * 1024 * 1024;
const STORAGE_DIR = "storage";

function getUserFolder(userId) {
  return join(STORAGE_DIR, userId);
}

function ensureUserFolder(userId) {
  const folder = getUserFolder(userId);
  if (!existsSync(folder)) {
    mkdirSync(folder, { recursive: true });
  }
  return folder;
}

function getFilePath(userId, fileId) {
  return join(STORAGE_DIR, userId, `${fileId}.pdf`);
}

export function saveFile(userId, jobPdfPath, originalName) {
  const storage = getUserStorage(userId);
  
  if (storage.fileLimitReached) {
    throw new Error("File limit reached. Maximum 20 files allowed.");
  }
  
  if (storage.storageFull) {
    throw new Error("Storage limit reached. Maximum 100MB allowed.");
  }
  
  if (!existsSync(jobPdfPath)) {
    throw new Error("Source PDF file not found.");
  }
  
  const stats = statSync(jobPdfPath);
  const fileSize = stats.size;
  
  if (storage.used + fileSize > MAX_STORAGE_PER_USER) {
    throw new Error("Storage limit would be exceeded by this file.");
  }
  
  ensureUserFolder(userId);
  
  const fileId = randomUUID();
  const destPath = getFilePath(userId, fileId);
  
  copyFileSync(jobPdfPath, destPath);
  
  db.run(
    "INSERT INTO files (id, user_id, original_name, pdf_path, file_size) VALUES (?, ?, ?, ?, ?)",
    [fileId, userId, originalName, destPath, fileSize]
  );
  
  return {
    id: fileId,
    user_id: userId,
    original_name: originalName,
    file_size: fileSize,
    pdf_path: destPath
  };
}

export function getUserFiles(userId) {
  const stmt = db.prepare(
    "SELECT id, user_id, original_name, file_size, created_at FROM files WHERE user_id = ? ORDER BY created_at DESC"
  );
  return stmt.all(userId);
}

export function getFile(fileId, userId) {
  const stmt = db.prepare(
    "SELECT id, user_id, original_name, pdf_path, file_size, created_at FROM files WHERE id = ? AND user_id = ?"
  );
  return stmt.get(fileId, userId);
}

export async function deleteFile(fileId, userId) {
  const file = getFile(fileId, userId);

  if (!file) {
    throw new Error("File not found or access denied.");
  }

  if (existsSync(file.pdf_path)) {
    await unlink(file.pdf_path);
  }

  db.run("DELETE FROM files WHERE id = ?", [fileId]);

  return true;
}

export function getUserStorage(userId) {
  const files = getUserFiles(userId);
  const fileCount = files.length;
  const used = files.reduce((total, file) => total + (file.file_size || 0), 0);
  
  return {
    used,
    limit: MAX_STORAGE_PER_USER,
    fileCount,
    fileLimit: MAX_FILES_PER_USER,
    fileLimitReached: fileCount >= MAX_FILES_PER_USER,
    storageFull: used >= MAX_STORAGE_PER_USER
  };
}

export { ensureUserFolder, getFilePath };
