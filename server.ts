import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";

const isProd = process.env.NODE_ENV === "production";
const db = new Database("voxstory.db");
const JWT_SECRET = process.env.JWT_SECRET || "voxstory-secret-key";

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password_hash TEXT,
    favorite_genre TEXT DEFAULT 'Fantasy',
    favorite_voice TEXT DEFAULT 'Kore',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT,
    content TEXT,
    audio_data TEXT,
    image_data TEXT,
    genre TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(cookieParser());

  // Auth Middleware
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.userId = decoded.userId;
      next();
    } catch (err) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // Auth Routes
  app.post("/api/auth/signup", async (req, res) => {
    const { email, password } = req.body;
    const id = crypto.randomUUID();
    const hash = await bcrypt.hash(password, 10);
    try {
      db.prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)").run(id, email, hash);
      const token = jwt.sign({ userId: id }, JWT_SECRET);
      res.cookie("token", token, { httpOnly: true, secure: true, sameSite: 'none' });
      res.json({ user: { id, email, favorite_genre: 'Fantasy', favorite_voice: 'Kore' } });
    } catch (err) {
      res.status(400).json({ error: "User already exists" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ userId: user.id }, JWT_SECRET);
    res.cookie("token", token, { httpOnly: true, secure: true, sameSite: 'none' });
    res.json({ user: { id: user.id, email: user.email, favorite_genre: user.favorite_genre, favorite_voice: user.favorite_voice } });
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("token");
    res.json({ success: true });
  });

  app.get("/api/auth/me", authenticate, (req: any, res) => {
    const user = db.prepare("SELECT id, email, favorite_genre, favorite_voice FROM users WHERE id = ?").get(req.userId) as any;
    res.json({ user });
  });

  app.post("/api/auth/preferences", authenticate, (req: any, res) => {
    const { favorite_genre, favorite_voice } = req.body;
    db.prepare("UPDATE users SET favorite_genre = ?, favorite_voice = ? WHERE id = ?").run(favorite_genre, favorite_voice, req.userId);
    res.json({ success: true });
  });

  // Project Routes
  app.get("/api/projects", authenticate, (req: any, res) => {
    const projects = db.prepare("SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC").all(req.userId);
    res.json(projects);
  });

  app.post("/api/projects", authenticate, (req: any, res) => {
    const { id, title, content, audio_data, image_data, genre } = req.body;
    const stmt = db.prepare(`
      INSERT INTO projects (id, user_id, title, content, audio_data, image_data, genre)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, req.userId, title, content, audio_data, image_data, genre);
    res.json({ success: true });
  });

  app.delete("/api/projects/:id", authenticate, (req: any, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM projects WHERE id = ? AND user_id = ?").run(id, req.userId);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve("dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
