import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import nodemailer from "nodemailer";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import Database from "better-sqlite3";

const JWT_SECRET = process.env.JWT_SECRET || "marketing-neural-plan-secret-key-2026";

// Initialize SQLite Database
const db = new Database('data.db');

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS edges (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );
`);

// Prepared statements
const insertNode = db.prepare('INSERT OR REPLACE INTO nodes (id, data) VALUES (?, ?)');
const deleteNode = db.prepare('DELETE FROM nodes WHERE id = ?');
const getNode = db.prepare('SELECT data FROM nodes WHERE id = ?');
const getAllNodes = db.prepare('SELECT data FROM nodes');

const insertEdge = db.prepare('INSERT OR REPLACE INTO edges (id, data) VALUES (?, ?)');
const deleteEdge = db.prepare('DELETE FROM edges WHERE id = ?');
const deleteEdgesByNode = db.prepare('DELETE FROM edges WHERE data LIKE ? OR data LIKE ?');
const getAllEdges = db.prepare('SELECT data FROM edges');

const insertTag = db.prepare('INSERT OR REPLACE INTO tags (id, data) VALUES (?, ?)');
const deleteTag = db.prepare('DELETE FROM tags WHERE id = ?');
const getAllTags = db.prepare('SELECT data FROM tags');

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  
  const server = createServer(app);
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  const PORT = 3000;

  let activeUsers = 0;

  // Email transporter setup
  let transporter: nodemailer.Transporter;
  
  async function setupMailer() {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      // Fallback to Ethereal for testing
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log("Using Ethereal Email for testing. Check console for preview URLs when emails are sent.");
    }
  }
  setupMailer();

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    activeUsers++;
    io.emit("users:count", activeUsers);

    // Send initial state from DB
    const nodes = getAllNodes.all().map((row: any) => JSON.parse(row.data));
    const edges = getAllEdges.all().map((row: any) => JSON.parse(row.data));
    const tags = getAllTags.all().map((row: any) => JSON.parse(row.data));
    
    socket.emit("init", { nodes, edges, tags });

    socket.on("nodes:change", (changes) => {
      // We handle specific add/update/delete events for DB persistence, 
      // but we still broadcast the raw changes for smooth UI updates (like dragging)
      socket.broadcast.emit("nodes:change", changes);
      
      // Also persist position changes
      changes.forEach((change: any) => {
        if (change.type === 'position' && change.position) {
          if (change.dragging === false || change.dragging === undefined) {
            const row = getNode.get(change.id) as any;
            if (row) {
              const node = JSON.parse(row.data);
              node.position = change.position;
              insertNode.run(node.id, JSON.stringify(node));
            }
          }
        }
      });
    });

    socket.on("edges:change", (changes) => {
      socket.broadcast.emit("edges:change", changes);
    });

    socket.on("node:add", (node) => {
      insertNode.run(node.id, JSON.stringify(node));
      socket.broadcast.emit("node:add", node);
    });

    socket.on("node:update", (updatedNode) => {
      insertNode.run(updatedNode.id, JSON.stringify(updatedNode));
      socket.broadcast.emit("node:update", updatedNode);
    });

    socket.on("node:delete", (nodeId) => {
      deleteNode.run(nodeId);
      // Delete associated edges
      deleteEdgesByNode.run(`%"source":"${nodeId}"%`, `%"target":"${nodeId}"%`);
      socket.broadcast.emit("node:delete", nodeId);
    });

    socket.on("edge:add", (edge) => {
      insertEdge.run(edge.id, JSON.stringify(edge));
      socket.broadcast.emit("edge:add", edge);
    });

    socket.on("edge:delete", (edgeId) => {
      deleteEdge.run(edgeId);
      socket.broadcast.emit("edge:delete", edgeId);
    });

    socket.on("graph:sync", (state) => {
      // Clear current nodes and edges in DB
      db.exec('DELETE FROM nodes');
      db.exec('DELETE FROM edges');
      
      // Insert new state
      if (state.nodes && Array.isArray(state.nodes)) {
        state.nodes.forEach((n: any) => insertNode.run(n.id, JSON.stringify(n)));
      }
      if (state.edges && Array.isArray(state.edges)) {
        state.edges.forEach((e: any) => insertEdge.run(e.id, JSON.stringify(e)));
      }
      
      socket.broadcast.emit("graph:sync", state);
    });

    // Tags management
    socket.on("tag:add", (tag) => {
      insertTag.run(tag.id, JSON.stringify(tag));
      socket.broadcast.emit("tag:add", tag);
    });

    socket.on("tag:delete", (tagId) => {
      deleteTag.run(tagId);
      socket.broadcast.emit("tag:delete", tagId);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
      activeUsers--;
      io.emit("users:count", activeUsers);
    });
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // --- AUTHENTICATION ROUTES ---
  app.get('/api/auth/url', (req, res) => {
    const origin = req.query.origin as string;
    if (!origin) return res.status(400).json({ error: 'Origin required' });

    const redirectUri = `${origin}/auth/callback`;
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'email profile',
      state: origin,
      prompt: 'select_account'
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    res.json({ url: authUrl });
  });

  app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
    const { code, state } = req.query;
    const origin = state as string;

    if (!code || !origin) {
      return res.send(`
        <html><body><script>
          if (window.opener) { window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: 'Missing code or state' }, '*'); window.close(); }
        </script></body></html>
      `);
    }

    const redirectUri = `${origin}/auth/callback`;

    try {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID || '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
          code: code as string,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        })
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        throw new Error(tokenData.error_description || 'Failed to get token');
      }

      const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const userData = await userResponse.json();

      if (!userData.email || !userData.email.endsWith('@shareid.ai')) {
        return res.send(`
          <html><body>
            <div style="font-family: sans-serif; padding: 20px; text-align: center;">
              <h2 style="color: #e11d48;">Accès refusé</h2>
              <p>Seules les adresses @shareid.ai sont autorisées.</p>
            </div>
            <script>
            setTimeout(() => {
              if (window.opener) { window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: 'Unauthorized domain' }, '*'); window.close(); }
            }, 3000);
          </script></body></html>
        `);
      }

      const token = jwt.sign({ email: userData.email, name: userData.name, picture: userData.picture }, JWT_SECRET, { expiresIn: '7d' });
      res.cookie('auth_token', token, {
        secure: true,
        sameSite: 'none',
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.send(`
        <html><body><script>
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
            window.close();
          } else {
            window.location.href = '/';
          }
        </script>
        <p>Authentification réussie. Cette fenêtre va se fermer.</p>
        </body></html>
      `);
    } catch (error: any) {
      console.error('OAuth error:', error);
      res.send(`
        <html><body><script>
          if (window.opener) { window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: '${error.message}' }, '*'); window.close(); }
        </script></body></html>
      `);
    }
  });

  app.get('/api/auth/me', (req, res) => {
    const token = req.cookies.auth_token;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      res.json({ user: decoded });
    } catch (err) {
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('auth_token', {
      secure: true,
      sameSite: 'none',
      httpOnly: true,
    });
    res.json({ success: true });
  });
  // --- END AUTHENTICATION ROUTES ---

  app.post("/api/send-email", async (req, res) => {
    try {
      const { to, subject, text, html } = req.body;
      
      if (!transporter) {
        return res.status(500).json({ error: "Mailer not initialized" });
      }

      const info = await transporter.sendMail({
        from: '"Marketing Neural Plan" <noreply@neuralplan.com>',
        to,
        subject,
        text,
        html,
      });

      console.log("Message sent: %s", info.messageId);
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log("Preview URL: %s", previewUrl);
      }

      res.json({ success: true, messageId: info.messageId, previewUrl });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
