import db from "./db.js";

const SESSION_EXPIRY_DAYS = 7;
const SESSION_EXPIRY_MS = SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 15 * 60 * 1000;
const rateLimiter = new Map();

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateName(name) {
  return typeof name === "string" && name.length >= 2 && name.length <= 50;
}

function validatePassword(password) {
  return typeof password === "string" && password.length >= 6;
}

function createSession(userId) {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MS).toISOString();
  
  db.run(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
    [token, userId, expiresAt]
  );
  
  return token;
}

export async function register(name, email, password) {
  if (!validateName(name)) {
    throw new Error("Name must be between 2 and 50 characters");
  }
  
  if (!validateEmail(email)) {
    throw new Error("Invalid email format");
  }
  
  if (!validatePassword(password)) {
    throw new Error("Password must be at least 6 characters");
  }
  
  email = email.toLowerCase();
  
  const existingUser = db.query("SELECT id FROM users WHERE email = ?").get(email);
  if (existingUser) {
    throw new Error("Email already registered");
  }
  
  const userId = crypto.randomUUID();
  const passwordHash = await Bun.password.hash(password);
  
  db.run(
    "INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)",
    [userId, name, email, passwordHash]
  );
  
  const token = createSession(userId);
  
  const user = db.query("SELECT id, name, email, created_at FROM users WHERE id = ?").get(userId);
  
  return { user, token };
}

export async function login(email, password) {
  if (!validateEmail(email)) {
    throw new Error("Invalid email format");
  }
  
  if (!password) {
    throw new Error("Password is required");
  }
  
  email = email.toLowerCase();
  
  const rateLimitKey = email;
  const attempts = rateLimiter.get(rateLimitKey);
  
  if (attempts) {
    if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
      const timePassed = Date.now() - attempts.firstAttempt;
      if (timePassed < BLOCK_DURATION_MS) {
        throw new Error("Too many failed attempts. Please try again later.");
      } else {
        rateLimiter.delete(rateLimitKey);
      }
    }
  }
  
  const user = db.query("SELECT id, name, email, password, created_at FROM users WHERE email = ?").get(email);
  
  if (!user) {
    const current = rateLimiter.get(rateLimitKey) || { count: 0, firstAttempt: Date.now() };
    current.count += 1;
    if (current.count === 1) {
      current.firstAttempt = Date.now();
    }
    rateLimiter.set(rateLimitKey, current);
    throw new Error("Invalid email or password");
  }
  
  const validPassword = await Bun.password.verify(password, user.password);
  
  if (!validPassword) {
    const current = rateLimiter.get(rateLimitKey) || { count: 0, firstAttempt: Date.now() };
    current.count += 1;
    if (current.count === 1) {
      current.firstAttempt = Date.now();
    }
    rateLimiter.set(rateLimitKey, current);
    throw new Error("Invalid email or password");
  }
  
  rateLimiter.delete(rateLimitKey);
  
  const token = createSession(user.id);
  
  const { password: _, ...userWithoutPassword } = user;
  
  return { user: userWithoutPassword, token };
}

export function logout(token) {
  if (!token) return;
  
  db.run("DELETE FROM sessions WHERE id = ?", [token]);
}

export function verifySession(token) {
  if (!token) return null;
  
  const session = db.query("SELECT user_id, expires_at FROM sessions WHERE id = ?").get(token);
  
  if (!session) return null;
  
  if (new Date(session.expires_at) < new Date()) {
    db.run("DELETE FROM sessions WHERE id = ?", [token]);
    return null;
  }
  
  const user = db.query("SELECT id, name, email, created_at FROM users WHERE id = ?").get(session.user_id);
  
  return user || null;
}

export function getUserById(userId) {
  if (!userId) return null;
  
  const user = db.query("SELECT id, name, email, created_at FROM users WHERE id = ?").get(userId);
  
  return user || null;
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "strict",
  path: "/",
  maxAge: 604800
};

// Cleanup expired sessions every 30 minutes
setInterval(() => {
  db.run("DELETE FROM sessions WHERE expires_at < datetime('now')");
}, 30 * 60 * 1000);