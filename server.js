const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const helmet = require("helmet");

const app = express();
const PORT = process.env.PORT || 3000;
const CREATOR_PASSWORD = process.env.CREATOR_PASSWORD || "TechTelugu@2026";
const ANALYTICS_FILE = path.join(__dirname, "analytics-data.json");

// Anti-Spam & Rate Limiter Store
const ipRequestCounts = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 120; // 120 requests per minute per IP

// Anti-Spam Rate Limiting Middleware
app.use((req, res, next) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
  const now = Date.now();

  let record = ipRequestCounts.get(ip);
  if (!record || (now - record.startTime) > RATE_LIMIT_WINDOW_MS) {
    record = { count: 1, startTime: now };
    ipRequestCounts.set(ip, record);
  } else {
    record.count++;
  }

  // Auto clean stale IPs every 5 minutes
  if (ipRequestCounts.size > 2000) {
    for (const [k, v] of ipRequestCounts.entries()) {
      if ((now - v.startTime) > RATE_LIMIT_WINDOW_MS) ipRequestCounts.delete(k);
    }
  }

  if (record.count > MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({ error: "Too many requests. Anti-spam throttle activated." });
  }

  next();
});

app.use(cors());

// Configure Helmet with loose CSP so AdSense & Google Fonts load freely
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Handle text/plain from navigator.sendBeacon
app.use(express.text());

// Disable caching for HTML pages to guarantee immediate updates
app.use((req, res, next) => {
  if (req.url.endsWith(".html") || req.url === "/" || !req.url.includes(".")) {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});

// Load Analytics Store from disk
function loadServerAnalytics() {
  try {
    if (fs.existsSync(ANALYTICS_FILE)) {
      return JSON.parse(fs.readFileSync(ANALYTICS_FILE, "utf8"));
    }
  } catch (e) {}
  return {
    totalViews: 0,
    uniqueVisitors: 0,
    totalClicks: 0,
    spamBlocked: 0,
    clicksByItem: {},
    recentActivity: []
  };
}

function saveServerAnalytics(data) {
  try {
    fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {}
}

let serverAnalytics = loadServerAnalytics();

// Analytics Tracking Endpoint (Beacon / Fetch)
app.post("/api/analytics/track", (req, res) => {
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }

  const { type, id, title } = body || {};

  if (type === "view") {
    serverAnalytics.totalViews = (serverAnalytics.totalViews || 0) + 1;
    saveServerAnalytics(serverAnalytics);
    return res.json({ status: "ok" });
  }

  if (type === "click" && id) {
    serverAnalytics.totalClicks = (serverAnalytics.totalClicks || 0) + 1;
    if (!serverAnalytics.clicksByItem) serverAnalytics.clicksByItem = {};
    if (!serverAnalytics.clicksByItem[id]) {
      serverAnalytics.clicksByItem[id] = { title: title || id, clicks: 0 };
    }
    serverAnalytics.clicksByItem[id].clicks += 1;
    serverAnalytics.clicksByItem[id].lastClicked = new Date().toISOString();

    if (!serverAnalytics.recentActivity) serverAnalytics.recentActivity = [];
    serverAnalytics.recentActivity.unshift({
      id,
      title: title || id,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      date: new Date().toLocaleDateString([], { month: "short", day: "numeric" })
    });
    if (serverAnalytics.recentActivity.length > 25) serverAnalytics.recentActivity.pop();

    saveServerAnalytics(serverAnalytics);
    return res.json({ status: "ok" });
  }

  res.json({ status: "ignored" });
});

// Analytics Auth Verification
app.post("/api/analytics/auth", (req, res) => {
  const { password } = req.body || {};
  if (password === CREATOR_PASSWORD) {
    return res.json({ success: true, token: "tt_valid_session" });
  }
  res.status(401).json({ success: false, error: "Invalid password" });
});

// Analytics Stats Endpoint (Password-Protected)
app.get("/api/analytics/stats", (req, res) => {
  const authHeader = req.headers["authorization"];
  if (authHeader !== `Bearer ${CREATOR_PASSWORD}` && req.query.pass !== CREATOR_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized. Creator password required." });
  }
  res.json(serverAnalytics);
});

// Serve static directory
app.use(express.static(__dirname, { etag: false, maxAge: 0 }));

// Clean routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/download-capcut", (req, res) => {
  res.sendFile(path.join(__dirname, "download-capcut.html"));
});

app.get(["/google-antigravity", "/google-antigravity.html", "/google-antigravity-prompt-to-app-guide.html", "/guides/google-antigravity-prompt-to-app-guide.html", "/guides/google-antigravity.html"], (req, res) => {
  res.sendFile(path.join(__dirname, "google-antigravity.html"));
});

app.get("/about", (req, res) => {
  res.sendFile(path.join(__dirname, "about.html"));
});

app.get("/contact", (req, res) => {
  res.sendFile(path.join(__dirname, "contact.html"));
});

app.get("/privacy", (req, res) => {
  res.sendFile(path.join(__dirname, "privacy.html"));
});

app.get("/terms", (req, res) => {
  res.sendFile(path.join(__dirname, "terms.html"));
});

app.get("/disclaimer", (req, res) => {
  res.sendFile(path.join(__dirname, "disclaimer.html"));
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", app: "Tech Telugu Hub", timestamp: new Date().toISOString() });
});

// Start Server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Tech Telugu Link Hub server running on port ${PORT}:`);
  console.log(`💻 Local computer:         http://localhost:${PORT}`);
  console.log(`📱 Other devices on Wi-Fi: http://localhost:${PORT}/index.html`);
  console.log(`🌐 Live Custom Domain:     https://mycoinrush.online`);
  console.log(`🛡️ Anti-Spam Shield:       Active (120 req/min limit)`);
  console.log(`📊 Analytics Engine:       Ready (Pass: TechTelugu@2026)`);
  console.log(`======================================================\n`);
});
