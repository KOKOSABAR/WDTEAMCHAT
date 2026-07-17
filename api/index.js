var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// api/_handler.ts
var handler_exports = {};
__export(handler_exports, {
  default: () => handler_default
});
module.exports = __toCommonJS(handler_exports);
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_supabase_js = require("@supabase/supabase-js");
var import_genai = require("@google/genai");
var app = (0, import_express.default)();
app.use(import_express.default.json({ limit: "50mb" }));
app.use(import_express.default.urlencoded({ extended: true, limit: "50mb" }));
var isVercel = !!process.env.VERCEL;
var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseKey = process.env.SUPABASE_ANON_KEY || "";
var supabase = null;
if (supabaseUrl && supabaseKey) {
  try {
    supabase = (0, import_supabase_js.createClient)(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
    console.log("Supabase initialized.");
  } catch (e) {
    console.error("Supabase init error:", e);
  }
}
var initialDB = () => ({
  users: [{
    id: "faisal",
    username: "faisalsabaryanto",
    email: "faisalsabaryanto44@gmail.com",
    password: "@Aa291217@",
    name: "Faisal Sabaryanto",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    isOnline: false,
    lastSeen: (/* @__PURE__ */ new Date()).toISOString(),
    statusMessage: "Line Dashboard is Awesome! \u26A1",
    role: "CS LINE"
  }],
  chats: [],
  messages: []
});
var db = initialDB();
var loadFromSupabase = async () => {
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.from("supabase_store").select("data").eq("id", "line_dashboard_db").single();
    if (!error && data?.data) {
      db = data.data;
      return true;
    }
  } catch (e) {
    console.error("loadFromSupabase:", e.message);
  }
  return false;
};
var saveToSupabase = async () => {
  if (!supabase) return;
  try {
    await supabase.from("supabase_store").upsert({ id: "line_dashboard_db", data: db });
  } catch (e) {
    console.error("saveToSupabase:", e.message);
  }
};
var dbPath = import_path.default.join(process.cwd(), "db.json");
var loadLocalDB = () => {
  if (isVercel) return;
  try {
    if (import_fs.default.existsSync(dbPath)) {
      db = JSON.parse(import_fs.default.readFileSync(dbPath, "utf8"));
    }
  } catch (e) {
    console.error("loadLocalDB:", e);
  }
};
var saveLocalDB = () => {
  if (isVercel) return;
  try {
    import_fs.default.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error("saveLocalDB:", e);
  }
};
var saveDB = () => {
  saveLocalDB();
  if (supabase) saveToSupabase().catch(console.error);
};
var initDB = async () => {
  const ok = await loadFromSupabase();
  if (!ok) loadLocalDB();
  db.users = db.users.filter((u) => !["sally", "brown", "cony", "leonard"].includes(u.id));
  db.users.forEach((u) => {
    if (!u.role) u.role = "CS LINE";
  });
  saveDB();
};
initDB();
var sseClients = [];
var broadcast = (event, targets) => {
  const data = `data: ${JSON.stringify(event)}

`;
  sseClients.forEach((c) => {
    if (!targets || targets.includes(c.userId)) try {
      c.res.write(data);
    } catch {
    }
  });
};
var handleAI = async (chatId, trigger) => {
  const chat = db.chats.find((c) => c.id === chatId);
  if (!chat) return;
  const bots = ["sally", "brown", "cony", "leonard"].filter((b) => chat.members.includes(b) && b !== trigger.senderId);
  if (!bots.length) return;
  let botId = "";
  if (!chat.isGroup) botId = bots[0];
  else {
    const t = trigger.text.toLowerCase();
    if (t.includes("sally")) botId = "sally";
    else if (t.includes("brown")) botId = "brown";
    else if (t.includes("cony")) botId = "cony";
    else if (t.includes("leonard")) botId = "leonard";
    else if (Math.random() < 0.25) botId = bots[Math.floor(Math.random() * bots.length)];
  }
  if (!botId) return;
  const bot = db.users.find((u) => u.id === botId);
  if (!bot) return;
  broadcast({ type: "typing", payload: { chatId, userId: botId, username: bot.username, isTyping: true } });
  setTimeout(async () => {
    let text = "";
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
      try {
        const ai = new import_genai.GoogleGenAI({ apiKey });
        const ctx = db.messages.filter((m) => m.chatId === chatId && !m.deletedForEveryone).slice(-6).map((m) => `${m.senderName}: ${m.text}`).join("\n");
        const chars = {
          sally: "Kamu Sally Chick LINE Friends. Ceria, hiperaktif. Jawab Indonesia singkat, pakai \u{1F425}.",
          brown: "Kamu Brown Bear LINE Friends. Pendiam, hangat. Jawab Indonesia sangat singkat, pakai \u{1F43B}.",
          cony: "Kamu Cony Bunny LINE Friends. Ekspresif, ceria. Jawab Indonesia bersemangat, pakai \u{1F430}\u{1F496}.",
          leonard: "Kamu Leonard Frog LINE Friends. Santai, puitis. Jawab Indonesia puitis, pakai \u{1F438}\u{1F3B5}."
        };
        const res = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: `${chars[botId]}
Konteks:
${ctx}
Pesan dari ${trigger.senderName}: "${trigger.text}"
Jawab sebagai ${bot.name}:` });
        text = res.text?.trim() || "";
      } catch {
      }
    }
    if (!text) {
      const fb = { sally: ["Hehe ayo main! \u{1F425}\u2728", "Piyoo bahagia! \u{1F423}\u{1F49B}"], brown: ["Semangat ya... \u{1F43B}\u2764\uFE0F", "Hmm... \u{1F43B}\u{1F4A4}"], cony: ["KYAAAA seru! \u{1F430}\u{1F389}\u{1F496}", "Love you! \u{1F430}\u2764\uFE0F"], leonard: ["Dengarkan hujan... \u{1F438}\u{1F327}\uFE0F\u{1F3B5}", "Hidup indah! \u{1F438}\u{1F49A}"] };
      const arr = fb[botId] || ["..."];
      text = arr[Math.floor(Math.random() * arr.length)];
    }
    const botMsg = { id: "msg_" + Date.now() + "_" + Math.floor(Math.random() * 1e3), chatId, senderId: botId, senderName: bot.name, senderAvatar: bot.avatar, text, type: "text", readBy: [botId], deletedFor: [], deletedForEveryone: false, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
    chat.members.forEach((m) => {
      if (sseClients.some((c) => c.userId === m) && !botMsg.readBy.includes(m)) botMsg.readBy.push(m);
    });
    db.messages.push(botMsg);
    saveDB();
    broadcast({ type: "typing", payload: { chatId, userId: botId, username: bot.username, isTyping: false } });
    broadcast({ type: "message_new", payload: botMsg }, chat.members);
  }, 1500 + Math.random() * 2e3);
};
app.options("*", (req, res) => {
  res.sendStatus(200);
});
app.get("/api/supabase/status", (_req, res) => res.json({ isConnected: !!supabase, supabaseUrl: supabaseUrl || "Not configured" }));
app.post("/api/auth/register", (req, res) => {
  const { username, email, password, name, avatar, statusMessage } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: "Kolom username, email, dan password wajib diisi." });
  const el = email.toLowerCase().trim();
  if (db.users.find((u) => u.email.toLowerCase() === el || u.username === username)) return res.status(400).json({ error: "Email atau Username sudah terdaftar." });
  const newUser = { id: "user_" + Date.now(), username, email: el, password, name: name || username, avatar: avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80", isOnline: false, lastSeen: (/* @__PURE__ */ new Date()).toISOString(), statusMessage: statusMessage || "Available", role: "CS LINE" };
  db.users.push(newUser);
  const g = db.chats.find((c) => c.id === "group-line-friends");
  if (g) g.members.push(newUser.id);
  saveDB();
  res.json({ success: true, user: newUser });
});
app.post("/api/auth/login", (req, res) => {
  const { emailOrUsername, password } = req.body;
  if (!emailOrUsername || !password) return res.status(400).json({ error: "Kolom email/username dan password wajib diisi." });
  const s = emailOrUsername.toLowerCase().trim();
  const user = db.users.find((u) => u.email.toLowerCase() === s || u.username.toLowerCase() === s);
  if (!user) return res.status(400).json({ error: "User tidak ditemukan." });
  if (!user.password || user.password !== password) return res.status(400).json({ error: "Kata sandi salah." });
  res.json({ success: true, user });
});
app.get("/api/auth/qr-code", (_req, res) => res.json({ success: true, qrToken: "token_" + Math.floor(Math.random() * 1e6) }));
app.post("/api/auth/qr-login", (req, res) => {
  const user = db.users.find((u) => u.id === (req.body.targetUserId || "faisal"));
  user ? res.json({ success: true, user }) : res.status(400).json({ error: "Gagal login via QR." });
});
app.post("/api/auth/google", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email Google wajib diisi." });
  const el = email.toLowerCase().trim();
  let user = db.users.find((u) => u.email.toLowerCase() === el);
  if (!user) {
    const base = el.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
    let username = base || "google_user";
    let n = 1;
    while (db.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) username = `${base}${n++}`;
    user = { id: "user_google_" + Date.now(), username, email: el, name: el.split("@")[0], avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80", isOnline: false, lastSeen: (/* @__PURE__ */ new Date()).toISOString(), statusMessage: "Masuk via Google Account", role: "KASIR" };
    db.users.push(user);
    saveDB();
  }
  res.json({ success: true, user });
});
var googleRedirectUri = () => `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/auth/callback/google`;
app.get("/api/auth/google/config", (_req, res) => res.json({ enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), clientId: process.env.GOOGLE_CLIENT_ID || "" }));
app.get("/api/auth/google/url", (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(400).json({ error: "Google OAuth not configured." });
  const p = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: googleRedirectUri(), response_type: "code", scope: "openid email profile", access_type: "offline", prompt: "consent" });
  res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${p}` });
});
app.get(["/auth/callback/google", "/auth/callback/google/"], async (req, res) => {
  const { code, error } = req.query;
  const close = (type, payload) => res.send(`<html><body><script>if(window.opener){window.opener.postMessage(${JSON.stringify({ type, ...payload })},'*');window.close();}else{window.location.href='/';}</script></body></html>`);
  if (error) return close("OAUTH_AUTH_FAILURE", { error });
  if (!code) return res.status(400).send("No code.");
  try {
    const tok = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: googleRedirectUri(), grant_type: "authorization_code" }).toString() });
    if (!tok.ok) throw new Error(await tok.text());
    const { access_token } = await tok.json();
    const info = await (await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${access_token}` } })).json();
    const el = info.email.toLowerCase().trim();
    let user = db.users.find((u) => u.email.toLowerCase() === el);
    if (!user) {
      const base = el.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
      let username = base || "google_user";
      let n = 1;
      while (db.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) username = `${base}${n++}`;
      user = { id: "user_google_" + Date.now(), username, email: el, name: info.name || base, avatar: info.picture || "", isOnline: false, lastSeen: (/* @__PURE__ */ new Date()).toISOString(), statusMessage: "Masuk via Google Account", role: "KASIR" };
      db.users.push(user);
      saveDB();
    } else {
      user.lastSeen = (/* @__PURE__ */ new Date()).toISOString();
      saveDB();
    }
    close("OAUTH_AUTH_SUCCESS", { user });
  } catch (e) {
    close("OAUTH_AUTH_FAILURE", { error: e.message });
  }
});
app.get("/api/users", (_req, res) => res.json(db.users));
app.put("/api/users/:userId", (req, res) => {
  const user = db.users.find((u) => u.id === req.params.userId);
  if (!user) return res.status(404).json({ error: "Pengguna tidak ditemukan." });
  const { name, avatar, statusMessage, role, password } = req.body;
  if (name) user.name = name;
  if (avatar) user.avatar = avatar;
  if (statusMessage !== void 0) user.statusMessage = statusMessage;
  if (role) user.role = role;
  if (password) user.password = password;
  saveDB();
  broadcast({ type: "user_profile_updated", payload: user });
  res.json({ success: true, user });
});
app.get("/api/chats", (req, res) => {
  const uid = req.query.userId;
  if (!uid) return res.status(400).json({ error: "userId diperlukan." });
  res.json(db.chats.filter((c) => c.members.includes(uid)));
});
app.post("/api/chats", (req, res) => {
  const { name, isGroup, avatar, description, members, createdBy } = req.body;
  if (!createdBy || !members?.length) return res.status(400).json({ error: "Pembuat chat dan anggota wajib disertakan." });
  if (!isGroup) {
    const other = members.find((m) => m !== createdBy);
    if (other) {
      const ex = db.chats.find((c) => !c.isGroup && c.members.includes(createdBy) && c.members.includes(other));
      if (ex) return res.json(ex);
    }
  }
  const ou = !isGroup ? db.users.find((u) => u.id === members.find((m) => m !== createdBy)) : null;
  const nc = { id: "chat_" + Date.now(), name: isGroup ? name || "Grup Baru" : ou?.name || "Personal Chat", isGroup: !!isGroup, avatar: isGroup ? avatar || "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=150&auto=format&fit=crop&q=80" : ou?.avatar || "", description: description || "", createdBy, admins: [createdBy], members: Array.from(/* @__PURE__ */ new Set([...members, createdBy])), archivedBy: [], mutedBy: [] };
  db.chats.push(nc);
  saveDB();
  broadcast({ type: "chat_new", payload: nc }, nc.members);
  res.json(nc);
});
app.put("/api/chats/:chatId", (req, res) => {
  const chat = db.chats.find((c) => c.id === req.params.chatId);
  if (!chat) return res.status(404).json({ error: "Chat tidak ditemukan." });
  const ed = db.users.find((u) => u.id === req.body.userId);
  if (!ed) return res.status(404).json({ error: "Pengguna tidak ditemukan." });
  if (chat.isGroup && ed.role !== "CS LINE" && ed.role !== "KAPTEN KASIR") return res.status(403).json({ error: "Hanya CS LINE dan KAPTEN KASIR yang dapat mengubah info grup ini." });
  const { name, avatar, description } = req.body;
  if (name) chat.name = name;
  if (avatar) chat.avatar = avatar;
  if (description !== void 0) chat.description = description;
  const sys = { id: "sys_" + Date.now(), chatId: chat.id, senderId: "system", senderName: "Sistem", senderAvatar: "", text: `${ed.name} mengubah info grup.`, type: "text", readBy: chat.members, deletedFor: [], deletedForEveryone: false, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
  db.messages.push(sys);
  saveDB();
  broadcast({ type: "chat_updated", payload: chat }, chat.members);
  broadcast({ type: "message_new", payload: sys }, chat.members);
  res.json(chat);
});
app.delete("/api/chats/:chatId", (req, res) => {
  const idx = db.chats.findIndex((c) => c.id === req.params.chatId);
  if (idx === -1) return res.status(404).json({ error: "Grup tidak ditemukan." });
  const chat = db.chats[idx];
  if (!chat.isGroup) return res.status(400).json({ error: "Bukan grup chat." });
  if (!chat.admins.includes(req.body.userId)) return res.status(403).json({ error: "Hanya Admin yang dapat menghapus grup ini." });
  const mems = chat.members;
  db.chats.splice(idx, 1);
  db.messages = db.messages.filter((m) => m.chatId !== req.params.chatId);
  saveDB();
  broadcast({ type: "chat_deleted", payload: { chatId: req.params.chatId } }, mems);
  res.json({ success: true });
});
app.post("/api/chats/:chatId/members", (req, res) => {
  const chat = db.chats.find((c) => c.id === req.params.chatId);
  if (!chat) return res.status(404).json({ error: "Grup tidak ditemukan." });
  const added = [];
  req.body.memberIds.forEach((id) => {
    if (!chat.members.includes(id)) {
      chat.members.push(id);
      added.push(id);
    }
  });
  if (added.length) {
    const adder = db.users.find((u) => u.id === req.body.userId);
    const names = added.map((id) => db.users.find((u) => u.id === id)?.name || id).join(", ");
    const sys = { id: "sys_" + Date.now(), chatId: chat.id, senderId: "system", senderName: "Sistem", senderAvatar: "", text: `${adder?.name || "Seseorang"} mengundang ${names} bergabung.`, type: "text", readBy: chat.members, deletedFor: [], deletedForEveryone: false, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
    db.messages.push(sys);
    saveDB();
    broadcast({ type: "chat_updated", payload: chat }, chat.members);
    broadcast({ type: "message_new", payload: sys }, chat.members);
  }
  res.json(chat);
});
app.delete("/api/chats/:chatId/members", (req, res) => {
  const chat = db.chats.find((c) => c.id === req.params.chatId);
  if (!chat) return res.status(404).json({ error: "Grup tidak ditemukan." });
  const { targetMemberId, userId } = req.body;
  if (targetMemberId !== userId && !chat.admins.includes(userId)) return res.status(403).json({ error: "Hanya Admin yang dapat mengeluarkan anggota." });
  const idx = chat.members.indexOf(targetMemberId);
  if (idx !== -1) {
    chat.members.splice(idx, 1);
    const ai = chat.admins.indexOf(targetMemberId);
    if (ai !== -1) chat.admins.splice(ai, 1);
    if (!chat.members.length) db.chats = db.chats.filter((c) => c.id !== chat.id);
    else if (!chat.admins.length && chat.isGroup) chat.admins.push(chat.members[0]);
    const tu = db.users.find((u) => u.id === targetMemberId);
    const ac = db.users.find((u) => u.id === userId);
    const sys = { id: "sys_" + Date.now(), chatId: chat.id, senderId: "system", senderName: "Sistem", senderAvatar: "", text: targetMemberId === userId ? `${tu?.name} telah keluar dari grup.` : `${tu?.name} dikeluarkan oleh ${ac?.name}.`, type: "text", readBy: chat.members, deletedFor: [], deletedForEveryone: false, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
    db.messages.push(sys);
    saveDB();
    broadcast({ type: "chat_removed", payload: { chatId: chat.id, userId: targetMemberId } }, [targetMemberId]);
    broadcast({ type: "chat_updated", payload: chat }, chat.members);
    broadcast({ type: "message_new", payload: sys }, chat.members);
  }
  res.json({ success: true, chat });
});
app.post("/api/chats/:chatId/admins", (req, res) => {
  const chat = db.chats.find((c) => c.id === req.params.chatId);
  if (!chat) return res.status(404).json({ error: "Grup tidak ditemukan." });
  if (!chat.admins.includes(req.body.userId)) return res.status(403).json({ error: "Hanya Admin yang dapat menyetel admin baru." });
  const { targetMemberId, userId } = req.body;
  if (!chat.admins.includes(targetMemberId)) {
    chat.admins.push(targetMemberId);
    const pro = db.users.find((u) => u.id === userId);
    const tar = db.users.find((u) => u.id === targetMemberId);
    const sys = { id: "sys_" + Date.now(), chatId: chat.id, senderId: "system", senderName: "Sistem", senderAvatar: "", text: `${tar?.name} dijadikan Admin oleh ${pro?.name}.`, type: "text", readBy: chat.members, deletedFor: [], deletedForEveryone: false, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
    db.messages.push(sys);
    saveDB();
    broadcast({ type: "chat_updated", payload: chat }, chat.members);
    broadcast({ type: "message_new", payload: sys }, chat.members);
  }
  res.json(chat);
});
app.post("/api/chats/:chatId/archive", (req, res) => {
  const chat = db.chats.find((c) => c.id === req.params.chatId);
  if (!chat) return res.status(404).json({ error: "Chat tidak ditemukan." });
  const i = chat.archivedBy.indexOf(req.body.userId);
  i === -1 ? chat.archivedBy.push(req.body.userId) : chat.archivedBy.splice(i, 1);
  saveDB();
  res.json({ success: true, chat });
});
app.post("/api/chats/:chatId/mute", (req, res) => {
  const chat = db.chats.find((c) => c.id === req.params.chatId);
  if (!chat) return res.status(404).json({ error: "Chat tidak ditemukan." });
  const i = chat.mutedBy.indexOf(req.body.userId);
  i === -1 ? chat.mutedBy.push(req.body.userId) : chat.mutedBy.splice(i, 1);
  saveDB();
  res.json({ success: true, chat });
});
app.post("/api/chats/:chatId/pin", (req, res) => {
  const chat = db.chats.find((c) => c.id === req.params.chatId);
  if (!chat) return res.status(404).json({ error: "Chat tidak ditemukan." });
  if (!chat.pinnedBy) chat.pinnedBy = [];
  const i = chat.pinnedBy.indexOf(req.body.userId);
  i === -1 ? chat.pinnedBy.push(req.body.userId) : chat.pinnedBy.splice(i, 1);
  saveDB();
  res.json({ success: true, chat });
});
app.get("/api/chats/:chatId/messages", (req, res) => {
  const uid = req.query.userId;
  if (!uid) return res.status(400).json({ error: "userId diperlukan." });
  res.json(db.messages.filter((m) => m.chatId === req.params.chatId && !m.deletedFor.includes(uid)));
});
app.post("/api/chats/:chatId/messages", (req, res) => {
  const chat = db.chats.find((c) => c.id === req.params.chatId);
  if (!chat) return res.status(404).json({ error: "Chat tidak ditemukan." });
  const sender = db.users.find((u) => u.id === req.body.senderId);
  if (!sender) return res.status(404).json({ error: "Pengirim tidak ditemukan." });
  const { senderId, text, type, mediaUrl, fileName, fileSize, replyTo } = req.body;
  const msg = { id: "msg_" + Date.now() + "_" + Math.floor(Math.random() * 1e3), chatId: req.params.chatId, senderId, senderName: sender.name, senderAvatar: sender.avatar, text: text || "", type: type || "text", mediaUrl, fileName, fileSize, replyTo, readBy: [senderId], deletedFor: [], deletedForEveryone: false, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
  chat.members.forEach((m) => {
    if (sseClients.some((c) => c.userId === m) && !msg.readBy.includes(m)) msg.readBy.push(m);
  });
  db.messages.push(msg);
  saveDB();
  broadcast({ type: "message_new", payload: msg }, chat.members);
  if (chat.archivedBy.length) {
    chat.archivedBy = [];
    saveDB();
    broadcast({ type: "chat_updated", payload: chat }, chat.members);
  }
  res.json(msg);
  handleAI(req.params.chatId, msg);
});
app.post("/api/chats/:chatId/read", (req, res) => {
  const chat = db.chats.find((c) => c.id === req.params.chatId);
  if (!chat) return res.status(404).json({ error: "Chat tidak ditemukan." });
  let updated = false;
  db.messages.forEach((m) => {
    if (m.chatId === req.params.chatId && !m.readBy.includes(req.body.userId)) {
      m.readBy.push(req.body.userId);
      updated = true;
    }
  });
  if (updated) {
    saveDB();
    broadcast({ type: "chat_read", payload: { chatId: req.params.chatId, userId: req.body.userId } }, chat.members);
  }
  res.json({ success: true });
});
app.post("/api/chats/:chatId/delete-message", (req, res) => {
  const chat = db.chats.find((c) => c.id === req.params.chatId);
  if (!chat) return res.status(404).json({ error: "Chat tidak ditemukan." });
  const msg = db.messages.find((m) => m.id === req.body.messageId);
  if (!msg) return res.status(404).json({ error: "Pesan tidak ditemukan." });
  const { userId, deleteForEveryone } = req.body;
  if (deleteForEveryone) {
    if (msg.senderId !== userId) return res.status(403).json({ error: "Hanya pengirim yang bisa menghapus untuk semua." });
    msg.deletedForEveryone = true;
    msg.text = "Pesan ini telah dihapus";
    msg.mediaUrl = void 0;
    msg.fileName = void 0;
    msg.fileSize = void 0;
  } else if (!msg.deletedFor.includes(userId)) msg.deletedFor.push(userId);
  saveDB();
  broadcast({ type: "message_deleted", payload: { messageId: msg.id, chatId: req.params.chatId, deletedFor: msg.deletedFor, deletedForEveryone: msg.deletedForEveryone } }, chat.members);
  res.json({ success: true, message: msg });
});
app.post("/api/chats/:chatId/messages/:messageId/react", (req, res) => {
  const chat = db.chats.find((c) => c.id === req.params.chatId);
  if (!chat) return res.status(404).json({ error: "Chat tidak ditemukan." });
  const msg = db.messages.find((m) => m.id === req.params.messageId);
  if (!msg) return res.status(404).json({ error: "Pesan tidak ditemukan." });
  if (!msg.reactions) msg.reactions = {};
  const { userId, emoji } = req.body;
  emoji ? msg.reactions[userId] = emoji : delete msg.reactions[userId];
  saveDB();
  broadcast({ type: "message_reaction", payload: { chatId: req.params.chatId, messageId: msg.id, reactions: msg.reactions } }, chat.members);
  res.json({ success: true, message: msg });
});
app.post("/api/chats/:chatId/typing", (req, res) => {
  const chat = db.chats.find((c) => c.id === req.params.chatId);
  if (!chat) return res.status(404).json({ error: "Chat tidak ditemukan." });
  const user = db.users.find((u) => u.id === req.body.userId);
  if (!user) return res.status(404).json({ error: "User tidak ditemukan." });
  broadcast({ type: "typing", payload: { chatId: req.params.chatId, userId: req.body.userId, username: user.username, isTyping: req.body.isTyping } }, chat.members.filter((m) => m !== req.body.userId));
  res.json({ success: true });
});
app.post("/api/upload", async (req, res) => {
  const { fileName, fileType, fileData } = req.body;
  if (!fileName || !fileData) return res.status(400).json({ error: "Nama file dan data wajib diisi." });
  if (supabase) {
    try {
      const buf = Buffer.from(fileData.replace(/^data:.*;base64,/, ""), "base64");
      const ext = fileName.split(".").pop() || "bin";
      const uName = `uploads/${Date.now()}_${Math.floor(Math.random() * 1e4)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("chat-uploads").upload(uName, buf, { contentType: fileType || "application/octet-stream", upsert: false });
      if (!upErr) {
        const { data: urlData } = supabase.storage.from("chat-uploads").getPublicUrl(uName);
        return res.json({ success: true, fileUrl: urlData.publicUrl });
      }
    } catch (e) {
      console.warn("Supabase storage error:", e.message);
    }
  }
  if (isVercel) return res.status(500).json({ error: "Upload gagal: Supabase Storage belum dikonfigurasi." });
  try {
    const buf = Buffer.from(fileData.replace(/^data:.*;base64,/, ""), "base64");
    const ext = import_path.default.extname(fileName) || ".png";
    const uName = `file_${Date.now()}_${Math.floor(Math.random() * 1e4)}${ext}`;
    const uploadsDir = import_path.default.join(process.cwd(), "uploads");
    if (!import_fs.default.existsSync(uploadsDir)) import_fs.default.mkdirSync(uploadsDir, { recursive: true });
    import_fs.default.writeFileSync(import_path.default.join(uploadsDir, uName), buf);
    res.json({ success: true, fileUrl: `/uploads/${uName}` });
  } catch (e) {
    console.error("Local upload error:", e);
    res.status(500).json({ error: "Gagal menyimpan file." });
  }
});
app.get("/api/realtime", (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).send("userId required");
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" });
  res.write("retry: 3000\n\n");
  const client = { userId, res };
  sseClients.push(client);
  const user = db.users.find((u) => u.id === userId);
  if (user) {
    user.isOnline = true;
    user.lastSeen = (/* @__PURE__ */ new Date()).toISOString();
    saveDB();
    broadcast({ type: "user_status", payload: { userId, isOnline: true, lastSeen: user.lastSeen } });
  }
  const ping = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
    }
  }, 25e3);
  req.on("close", () => {
    clearInterval(ping);
    sseClients = sseClients.filter((c) => c !== client);
    if (!sseClients.some((c) => c.userId === userId)) {
      const u = db.users.find((x) => x.id === userId);
      if (u) {
        u.isOnline = false;
        u.lastSeen = (/* @__PURE__ */ new Date()).toISOString();
        saveDB();
        broadcast({ type: "user_status", payload: { userId, isOnline: false, lastSeen: u.lastSeen } });
      }
    }
  });
});
var handler_default = app;

// Vercel requires module.exports to be the handler function directly
if (typeof module.exports === "object" && module.exports.default) {
  module.exports = module.exports.default;
}
