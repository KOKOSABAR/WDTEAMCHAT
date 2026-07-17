import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { User, Chat, Message, TypingStatus } from "./src/types.ts";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = 3000;

// Middleware for body parsing
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Ensure uploads directory exists safely
const uploadsDir = path.join(process.cwd(), "uploads");
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (e) {
  console.log("Uploads directory creation skipped (expected on read-only serverless filesystems)");
}
app.use("/uploads", express.static(uploadsDir));

// Database file path
const dbPath = path.join(process.cwd(), "db.json");

// Define structure of our DB
interface Database {
  users: User[];
  chats: Chat[];
  messages: Message[];
}

// Initial/Pre-seeded DB content
const initialDB = (): Database => {
  const users: User[] = [
    // Seed user account for quick login testing
    {
      id: "faisal",
      username: "faisalsabaryanto",
      email: "faisalsabaryanto44@gmail.com",
      name: "Faisal Sabaryanto",
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
      isOnline: false,
      lastSeen: new Date().toISOString(),
      statusMessage: "Line Dashboard is Awesome! ⚡",
      role: "CS LINE"
    }
  ];

  const chats: Chat[] = [];

  const messages: Message[] = [];

  return { users, chats, messages };
};

// Database state
let db: Database = initialDB();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";

let supabase: any = null;
if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false }
    });
    console.log("Supabase Client initialized successfully!");
  } catch (err) {
    console.error("Error initializing Supabase client:", err);
  }
}

// Sync database state to Supabase Cloud
const syncSaveToSupabase = async () => {
  if (!supabase) return;
  try {
    console.log("Syncing database to Supabase Cloud...");
    
    // Save to a unified store row for maximum reliability and ease-of-use
    const { error: storeErr } = await supabase
      .from("supabase_store")
      .upsert({ id: "line_dashboard_db", data: db });
      
    if (storeErr) {
      console.log("Supabase 'supabase_store' table not found or failed, trying individual tables...");
      
      // Fallback: try individual tables
      // 1. Users
      for (const u of db.users) {
        await supabase.from("users").upsert({
          id: u.id,
          username: u.username,
          email: u.email,
          name: u.name,
          avatar: u.avatar || "",
          is_online: u.isOnline,
          last_seen: u.lastSeen,
          status_message: u.statusMessage || "",
          role: u.role || "CS LINE",
          password: u.password || ""
        });
      }
      
      // 2. Chats
      for (const c of db.chats) {
        await supabase.from("chats").upsert({
          id: c.id,
          name: c.name,
          avatar: c.avatar || "",
          is_group: c.isGroup,
          created_by: c.createdBy,
          created_at: null,
          members: JSON.stringify(c.members),
          admins: JSON.stringify(c.admins),
          pinned_by: JSON.stringify(c.pinnedBy || []),
          muted_by: JSON.stringify(c.mutedBy || []),
          last_message_text: null,
          last_message_time: null,
          description: c.description || ""
        });
      }
      
      // 3. Messages
      for (const m of db.messages) {
        await supabase.from("messages").upsert({
          id: m.id,
          chat_id: m.chatId,
          sender_id: m.senderId,
          sender_name: m.senderName || "",
          sender_avatar: m.senderAvatar || "",
          text: m.text,
          type: m.type,
          created_at: m.createdAt,
          media_url: m.mediaUrl || "",
          file_name: m.fileName || "",
          file_size: m.fileSize || "",
          is_read: m.readBy && m.readBy.length > 0,
          deleted_for: JSON.stringify(m.deletedFor || []),
          read_by: JSON.stringify(m.readBy || []),
          reply_to: m.replyTo ? JSON.stringify(m.replyTo) : null,
          deleted_for_everyone: m.deletedForEveryone || false
        });
      }
    } else {
      console.log("Successfully backed up full DB state to Supabase store!");
    }
  } catch (err: any) {
    console.error("Error syncing to Supabase:", err.message || err);
  }
};

// Load database state from Supabase Cloud
const syncLoadFromSupabase = async () => {
  if (!supabase) return false;
  try {
    console.log("Loading database from Supabase Cloud...");
    
    // First, try loading from the unified store row
    const { data: storeData, error: storeErr } = await supabase
      .from("supabase_store")
      .select("data")
      .eq("id", "line_dashboard_db")
      .single();
      
    if (!storeErr && storeData && storeData.data) {
      db = storeData.data;
      console.log("Loaded full database successfully from Supabase unified store!");
      return true;
    }
    
    // If store row is empty or table doesn't exist, try individual tables
    console.log("Unified store load failed/empty, trying individual tables...");
    const { data: usersData, error: usersErr } = await supabase.from("users").select("*");
    const { data: chatsData } = await supabase.from("chats").select("*");
    const { data: messagesData } = await supabase.from("messages").select("*");
    
    if (usersErr || !usersData || usersData.length === 0) {
      console.log("No data found in Supabase individual tables.");
      return false;
    }
    
    db.users = usersData.map((u: any) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      name: u.name,
      avatar: u.avatar,
      isOnline: u.is_online !== undefined ? u.is_online : u.isOnline,
      lastSeen: u.last_seen || u.lastSeen,
      statusMessage: u.status_message || u.statusMessage,
      role: u.role,
      password: u.password
    }));
    
    if (chatsData) {
      db.chats = chatsData.map((c: any) => ({
        id: c.id,
        name: c.name,
        avatar: c.avatar,
        isGroup: c.is_group !== undefined ? c.is_group : c.isGroup,
        createdBy: c.created_by || c.createdBy,
        members: typeof c.members === "string" ? JSON.parse(c.members) : (c.members || []),
        admins: typeof c.admins === "string" ? JSON.parse(c.admins) : (c.admins || []),
        pinnedBy: typeof c.pinned_by === "string" ? JSON.parse(c.pinned_by) : (c.pinned_by || c.pinnedBy || []),
        mutedBy: typeof c.muted_by === "string" ? JSON.parse(c.muted_by) : (c.muted_by || c.mutedBy || []),
        description: c.description
      }));
    }
    
    if (messagesData) {
      db.messages = messagesData.map((m: any) => ({
        id: m.id,
        chatId: m.chat_id || m.chatId,
        senderId: m.sender_id || m.senderId,
        senderName: m.sender_name || m.senderName || "",
        senderAvatar: m.sender_avatar || m.senderAvatar || "",
        text: m.text,
        type: m.type,
        mediaUrl: m.media_url || m.mediaUrl,
        fileName: m.file_name || m.fileName,
        fileSize: m.file_size || m.fileSize,
        deletedFor: typeof m.deleted_for === "string" ? JSON.parse(m.deleted_for) : (m.deleted_for || m.deletedFor || []),
        readBy: typeof m.read_by === "string" ? JSON.parse(m.read_by) : (m.read_by || m.readBy || []),
        replyTo: typeof m.reply_to === "string" ? JSON.parse(m.reply_to) : (m.reply_to || m.replyTo || null),
        deletedForEveryone: m.deleted_for_everyone || false,
        createdAt: m.created_at || m.createdAt || new Date().toISOString()
      }));
    }
    
    console.log("Successfully loaded database from Supabase individual tables!");
    return true;
  } catch (err: any) {
    console.error("Error loading database from Supabase:", err.message || err);
    return false;
  }
};

// Load from db.json if exists
const loadDB = async () => {
  try {
    let loadedFromSupabase = false;
    if (supabase) {
      loadedFromSupabase = await syncLoadFromSupabase();
    }
    
    if (!loadedFromSupabase && fs.existsSync(dbPath)) {
      const data = fs.readFileSync(dbPath, "utf8");
      db = JSON.parse(data);
      console.log("Loaded database from local db.json");
    }
    
    // Clean up sample / pre-seeded bot users
    db.users = db.users.filter(u => !["sally", "brown", "cony", "leonard"].includes(u.id));
    // Ensure all users have a role
    db.users.forEach(u => {
      if (!u.role) {
        if (u.id === "faisal") u.role = "CS LINE";
        else u.role = "CS LINE";
      }
    });
    
    // We don't call saveDB here to prevent initial load cycles pushing to Supabase unnecessarily
    try {
      fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf8");
    } catch (err) {
      console.error("Error writing database cache file:", err);
    }
  } catch (error) {
    console.error("Error loading database:", error);
  }
};

// List of pending Supabase save promises to await before completing requests in serverless environments
let pendingSaves: Promise<any>[] = [];

// Save to db.json and sync to Supabase
const saveDB = () => {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf8");
    if (supabase) {
      // Sync to Supabase asynchronously but keep track of the promise for serverless lifecycles
      const syncPromise = syncSaveToSupabase().catch(err => {
        console.error("Background Supabase sync failed:", err);
      });
      pendingSaves.push(syncPromise);
      syncPromise.finally(() => {
        pendingSaves = pendingSaves.filter(p => p !== syncPromise);
      });
    }
  } catch (error) {
    console.error("Error saving database:", error);
  }
};

let loadDBPromise: Promise<void> | null = null;
const ensureDBLoaded = async () => {
  if (!loadDBPromise) {
    loadDBPromise = loadDB();
  }
  await loadDBPromise;
};

// Start initial load immediately
ensureDBLoaded();

// --- SERVERLESS SYNCHRONIZATION MIDDLEWARES ---

// Interceptor middleware for waiting on background Supabase saves in serverless/Vercel
app.use(async (req, res, next) => {
  const originalJson = res.json;
  const originalSend = res.send;

  res.json = function (body) {
    if (pendingSaves.length > 0) {
      Promise.all(pendingSaves)
        .catch(err => console.error("Error waiting for pending saves in res.json:", err))
        .finally(() => {
          originalJson.call(res, body);
        });
      return res;
    }
    return originalJson.call(this, body);
  };

  res.send = function (body) {
    if (pendingSaves.length > 0) {
      Promise.all(pendingSaves)
        .catch(err => console.error("Error waiting for pending saves in res.send:", err))
        .finally(() => {
          originalSend.call(res, body);
        });
      return res;
    }
    return originalSend.call(this, body);
  };

  next();
});

// Cache variables for DB load synchronization
let lastLoadTime = Date.now();
const CACHE_TTL = 3000; // 3 seconds cache TTL to avoid hitting Supabase too aggressively

app.use("/api", async (req, res, next) => {
  // 1. Ensure DB has finished initial load
  await ensureDBLoaded();

  // 2. If warm start, check if we need to reload due to cache expiration
  if (supabase && Date.now() - lastLoadTime > CACHE_TTL) {
    try {
      await syncLoadFromSupabase();
      lastLoadTime = Date.now();
    } catch (err) {
      console.error("Error reloading database from Supabase in middleware:", err);
    }
  }
  next();
});

// Active SSE Connections
interface SSEClient {
  userId: string;
  res: any;
}
let sseClients: SSEClient[] = [];

// Helper to broadcast to specific clients or all
const broadcastEvent = (event: { type: string; payload: any }, targetUserIds?: string[]) => {
  const dataString = `data: ${JSON.stringify(event)}\n\n`;
  sseClients.forEach((client) => {
    if (!targetUserIds || targetUserIds.includes(client.userId)) {
      try {
        client.res.write(dataString);
      } catch (err) {
        console.error(`Error sending SSE to user ${client.userId}:`, err);
      }
    }
  });
};

// AI Character replies using Gemini API
const handleAIReplies = async (chatId: string, triggerMessage: Message) => {
  // Find chat
  const chat = db.chats.find(c => c.id === chatId);
  if (!chat) return;

  // Determine potential repliers (bots in the chat except the sender)
  const aiBotIds = ["sally", "brown", "cony", "leonard"];
  const presentBots = chat.members.filter(mId => aiBotIds.includes(mId) && mId !== triggerMessage.senderId);

  if (presentBots.length === 0) return;

  // For 1-to-1, bot is the other member. For Group, bot responds if mentioned or randomly (20% chance) or 100% if Faisal mentions "@" name.
  let activeBotId = "";
  if (!chat.isGroup) {
    activeBotId = presentBots[0];
  } else {
    // Check if any bot is mentioned
    const textLower = triggerMessage.text.toLowerCase();
    if (textLower.includes("@sally") || textLower.includes("sally")) {
      activeBotId = "sally";
    } else if (textLower.includes("@brown") || textLower.includes("brown")) {
      activeBotId = "brown";
    } else if (textLower.includes("@cony") || textLower.includes("cony")) {
      activeBotId = "cony";
    } else if (textLower.includes("@leonard") || textLower.includes("leonard")) {
      activeBotId = "leonard";
    } else {
      // 25% chance of a random bot chiming in
      if (Math.random() < 0.25) {
        activeBotId = presentBots[Math.floor(Math.random() * presentBots.length)];
      }
    }
  }

  if (!activeBotId) return;

  const botUser = db.users.find(u => u.id === activeBotId);
  if (!botUser) return;

  // Typing indicator starts
  broadcastEvent({
    type: "typing",
    payload: { chatId, userId: activeBotId, username: botUser.username, isTyping: true }
  });

  // Decide how long they take to "type"
  const delay = 1500 + Math.random() * 2000;
  setTimeout(async () => {
    let replyText = "";

    // Check for Gemini API key and get AI reply
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
      try {
        const ai = new GoogleGenAI({ apiKey });
        
        // Build character prompt based on identity
        let characterPrompt = "";
        if (activeBotId === "sally") {
          characterPrompt = "Kamu adalah Sally Chick, karakter anak ayam kuning dari LINE Friends. Sifatmu adalah sangat ceria, hiperaktif, agak usil, suka ngemil, dan menggemaskan. Jawablah dalam bahasa Indonesia dengan gaya bicara imut, santai, gunakan banyak emoji anak ayam (🐥, 🐣, 🐤) dan makanan. Jawab dengan singkat dan padat (maksimal 2-3 kalimat). Jangan kaku!";
        } else if (activeBotId === "brown") {
          characterPrompt = "Kamu adalah Brown Bear, karakter beruang cokelat dari LINE Friends. Sifatmu sangat pendiam, pemalu, berhati hangat, tenang, dan sangat setia kawan. Jawablah dalam bahasa Indonesia dengan gaya bicara yang sangat singkat, agak gugup atau banyak jeda titik-titik, gunakan emoji beruang (🐻, 🪵, 🍯) atau hati (❤️). Jawab maksimal 1-2 kalimat pendek saja.";
        } else if (activeBotId === "cony") {
          characterPrompt = "Kamu adalah Cony Bunny, karakter kelinci putih dari LINE Friends. Sifatmu sangat ekspresif, lincah, ceria, emosional (mudah senang dan mudah ngambek), romantis. Jawablah dalam bahasa Indonesia dengan gaya bicara bersemangat, ceria, gunakan banyak tanda seru, gunakan emoji kelinci, hati, dan bunga (🐰, 💖, 🌸, ✨, 🎉). Jawab maksimal 2 kalimat.";
        } else if (activeBotId === "leonard") {
          characterPrompt = "Kamu adalah Leonard Frog, karakter katak hijau pemusik dari LINE Friends. Sifatmu tenang, puitis, cinta rintik hujan, santai dan ramah. Jawablah dalam bahasa Indonesia dengan gaya bicara yang santai, puitis atau bernada lagu, gunakan emoji katak dan hujan (🐸, 🌧️, 🎵). Jawab maksimal 2 kalimat.";
        }

        // Get past chat context (last 6 messages)
        const chatMessages = db.messages
          .filter(m => m.chatId === chatId && !m.deletedForEveryone)
          .slice(-6);
        
        const contextStr = chatMessages.map(m => `${m.senderName}: ${m.text}`).join("\n");

        const prompt = `${characterPrompt}\n\nKonteks percakapan terakhir:\n${contextStr}\n\nPesan terbaru dari ${triggerMessage.senderName}: "${triggerMessage.text}"\n\nTulis jawabanmu sebagai ${botUser.name}:`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        });

        replyText = response.text?.trim() || "";
      } catch (err) {
        console.error("Gemini AI character reply error:", err);
      }
    }

    // Fallback if AI fails or API key not present
    if (!replyText) {
      if (activeBotId === "sally") {
        const sallyReplies = [
          "Iya Faisal! Aku lagi makan kentang goreng nih! Mau juga? 🐥🍟",
          "Hehe kamu lucu deh! Ayo main bersamaku! 🐥✨",
          "Piyooopiyoo! Jangan lupa bahagia hari ini ya Faisal! 🐣💛",
          "Ada gosip seru apa hari ini? Sally pengen tahu! 🐥👀"
        ];
        replyText = sallyReplies[Math.floor(Math.random() * sallyReplies.length)];
      } else if (activeBotId === "brown") {
        const brownReplies = [
          "Aku... setuju... 🐻👍",
          "Semangat ya... Aku selalu mendukungmu... 🐻❤️",
          "Hmm... 🐻💤",
          "Terima kasih... Faisal... 🐻"
        ];
        replyText = brownReplies[Math.floor(Math.random() * brownReplies.length)];
      } else if (activeBotId === "cony") {
        const conyReplies = [
          "KYAAAA! Seru banget!! Aku setuju sekali! 🐰🎉💖",
          "Jangan bikin aku ngambek ya Faisal! Hahaha bercanda! 🐰😜🌸",
          "Wahhh manis sekali! Love you Faisal! 🐰❤️❤️",
          "Ayo pergi berpetualang mencari wortel manis! 🐰🥕✨"
        ];
        replyText = conyReplies[Math.floor(Math.random() * conyReplies.length)];
      } else {
        const leonardReplies = [
          "Dengarkan rintik hujan ini... Sangat menenangkan 🐸🌧️🎵",
          "Bagaimana kalau kita menyanyi bersama sore ini? 🐸🎤🎶",
          "Hidup ini indah seperti kolam air yang jernih! 🐸💚"
        ];
        replyText = leonardReplies[Math.floor(Math.random() * leonardReplies.length)];
      }
    }

    // Create and save reply message
    const botMsg: Message = {
      id: "msg_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      chatId,
      senderId: activeBotId,
      senderName: botUser.name,
      senderAvatar: botUser.avatar,
      text: replyText,
      type: "text",
      readBy: [activeBotId],
      deletedFor: [],
      deletedForEveryone: false,
      createdAt: new Date().toISOString()
    };

    // If any member is currently looking at the chat (SSE online), mark read
    chat.members.forEach(mId => {
      const isOnlineInChat = sseClients.some(c => c.userId === mId);
      if (isOnlineInChat && !botMsg.readBy.includes(mId)) {
        botMsg.readBy.push(mId);
      }
    });

    db.messages.push(botMsg);
    saveDB();

    // Typing indicator stops
    broadcastEvent({
      type: "typing",
      payload: { chatId, userId: activeBotId, username: botUser.username, isTyping: false }
    });

    // Broadcast new message
    broadcastEvent({
      type: "message_new",
      payload: botMsg
    }, chat.members);

  }, delay);
};

// --- SUPABASE STATUS ENDPOINT ---
app.get("/api/supabase/status", (req, res) => {
  res.json({
    isConnected: !!supabase,
    supabaseUrl: supabaseUrl || "Tidak dikonfigurasi",
    usingFallback: !supabase
  });
});

// --- AUTH API ENDPOINTS ---

// Register
app.post("/api/auth/register", (req, res) => {
  const { username, email, password, name, avatar, statusMessage } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "Kolom username, email, dan password wajib diisi." });
  }

  const emailLower = email.toLowerCase().trim();
  const userExists = db.users.find(u => u.email.toLowerCase() === emailLower || u.username === username);

  if (userExists) {
    return res.status(400).json({ error: "Email atau Username sudah terdaftar." });
  }

  const newUser: User = {
    id: "user_" + Date.now(),
    username,
    email: emailLower,
    password,
    name: name || username,
    avatar: avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    isOnline: false,
    lastSeen: new Date().toISOString(),
    statusMessage: statusMessage || "Available",
    role: "CS LINE"
  };

  db.users.push(newUser);

  // Auto-join group chat "group-line-friends"
  const defaultGroup = db.chats.find(c => c.id === "group-line-friends");
  if (defaultGroup) {
    defaultGroup.members.push(newUser.id);
  }

  saveDB();
  res.json({ success: true, user: newUser });
});

// Login
app.post("/api/auth/login", (req, res) => {
  const { emailOrUsername, password } = req.body;

  if (!emailOrUsername || !password) {
    return res.status(400).json({ error: "Kolom email/username dan password wajib diisi." });
  }

  const searchStr = emailOrUsername.toLowerCase().trim();
  const user = db.users.find(u => u.email.toLowerCase() === searchStr || u.username.toLowerCase() === searchStr);

  if (!user) {
    return res.status(400).json({ error: "User tidak ditemukan." });
  }

  // Verifikasi kata sandi
  if (!user.password || user.password !== password) {
    return res.status(400).json({ error: "Kata sandi salah." });
  }

  res.json({ success: true, user });
});

// QR Login Simulation
app.get("/api/auth/qr-code", (req, res) => {
  // Generate a mock login token
  const qrToken = "token_" + Math.floor(Math.random() * 1000000);
  res.json({ success: true, qrToken });
});

app.post("/api/auth/qr-login", (req, res) => {
  const { qrToken, targetUserId } = req.body;
  const user = db.users.find(u => u.id === (targetUserId || "faisal"));
  if (user) {
    res.json({ success: true, user });
  } else {
    res.status(400).json({ error: "Gagal login via QR." });
  }
});

// Google Authentication Simulation
app.post("/api/auth/google", (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email Google wajib diisi." });
  }

  const emailLower = email.toLowerCase().trim();
  let user = db.users.find(u => u.email.toLowerCase() === emailLower);

  if (!user) {
    // Register new user automatically with Google credentials
    const baseUsername = emailLower.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
    let username = baseUsername || "google_user";
    // Check if username already exists, append random suffix if needed
    let suffix = 1;
    while (db.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
      username = `${baseUsername}${suffix}`;
      suffix++;
    }

    user = {
      id: "user_google_" + Date.now(),
      username,
      email: emailLower,
      name: emailLower.split("@")[0],
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
      isOnline: false,
      lastSeen: new Date().toISOString(),
      statusMessage: "Masuk via Google Account",
      role: "KASIR"
    };

    db.users.push(user);
    saveDB();
  }

  res.json({ success: true, user });
});

// Google OAuth Real Flow Configuration & Endpoints
const getGoogleRedirectUri = () => {
  const base = process.env.APP_URL || "http://localhost:3000";
  const cleaned = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${cleaned}/auth/callback/google`;
};

app.get("/api/auth/google/config", (req, res) => {
  res.json({
    enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    clientId: process.env.GOOGLE_CLIENT_ID || ""
  });
});

app.get("/api/auth/google/url", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(400).json({ error: "Google OAuth is not configured on the server." });
  }

  const redirectUri = getGoogleRedirectUri();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent"
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.json({ url: authUrl });
});

app.get(["/auth/callback/google", "/auth/callback/google/"], async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_FAILURE', error: "${error}" }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication failed: ${error}</p>
        </body>
      </html>
    `);
  }

  if (!code) {
    return res.status(400).send("No authorization code provided.");
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = getGoogleRedirectUri();

    // Exchange code for token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        code: code as string,
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      }).toString()
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${errText}`);
    }

    const tokenData = await tokenResponse.json() as any;
    const accessToken = tokenData.access_token;

    // Fetch user info
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!userInfoResponse.ok) {
      throw new Error("Failed to fetch Google user info.");
    }

    const userInfo = await userInfoResponse.json() as any;
    const email = userInfo.email;
    const name = userInfo.name || userInfo.given_name || email.split("@")[0];
    const picture = userInfo.picture || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80";

    const emailLower = email.toLowerCase().trim();
    let user = db.users.find(u => u.email.toLowerCase() === emailLower);

    if (!user) {
      // Register user
      const baseUsername = emailLower.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
      let username = baseUsername || "google_user";
      let suffix = 1;
      while (db.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
        username = `${baseUsername}${suffix}`;
        suffix++;
      }

      user = {
        id: "user_google_" + Date.now(),
        username,
        email: emailLower,
        name,
        avatar: picture,
        isOnline: false,
        lastSeen: new Date().toISOString(),
        statusMessage: "Masuk via Google Account",
        role: "KASIR"
      };

      db.users.push(user);
      saveDB();
    } else {
      user.lastSeen = new Date().toISOString();
      saveDB();
    }

    // Success response to postMessage back to parent window
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', user: ${JSON.stringify(user)} }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Login Google berhasil! Jendela ini akan tertutup otomatis...</p>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error("Google OAuth Callback Error:", err);
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_FAILURE', error: "${err.message || 'Unknown error'}" }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Terjadi kesalahan saat otentikasi Google: ${err.message}</p>
        </body>
      </html>
    `);
  }
});

// Update Profile
app.put("/api/users/:userId", (req, res) => {
  const { userId } = req.params;
  const { name, avatar, statusMessage, role, password } = req.body;

  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: "Pengguna tidak ditemukan." });

  if (name) user.name = name;
  if (avatar) user.avatar = avatar;
  if (statusMessage !== undefined) user.statusMessage = statusMessage;
  if (role) user.role = role;
  if (password) user.password = password;

  saveDB();

  // Notify other clients about profile change
  broadcastEvent({
    type: "user_profile_updated",
    payload: user
  });

  res.json({ success: true, user });
});

// Get all users
app.get("/api/users", (req, res) => {
  res.json(db.users);
});

// --- CHAT API ENDPOINTS ---

// Get all chats of a user
app.get("/api/chats", (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) return res.status(400).json({ error: "userId diperlukan." });

  const userChats = db.chats.filter(c => c.members.includes(userId));
  res.json(userChats);
});

// Create a Chat (Personal or Group)
app.post("/api/chats", (req, res) => {
  const { name, isGroup, avatar, description, members, createdBy } = req.body;

  if (!createdBy || !members || !Array.isArray(members) || members.length === 0) {
    return res.status(400).json({ error: "Pembuat chat dan anggota wajib disertakan." });
  }

  // For personal chats, check if it already exists
  if (!isGroup) {
    const otherMemberId = members.find(mId => mId !== createdBy);
    if (otherMemberId) {
      const existingChat = db.chats.find(c => !c.isGroup && c.members.includes(createdBy) && c.members.includes(otherMemberId));
      if (existingChat) {
        return res.json(existingChat);
      }
    }
  }

  const chatId = "chat_" + Date.now();
  let chatName = name;
  let chatAvatar = avatar;

  if (!isGroup) {
    // If personal, set name and avatar to the other member's info
    const otherMemberId = members.find(mId => mId !== createdBy) || createdBy;
    const otherUser = db.users.find(u => u.id === otherMemberId);
    chatName = otherUser ? otherUser.name : "Personal Chat";
    chatAvatar = otherUser ? otherUser.avatar : "";
  }

  const newChat: Chat = {
    id: chatId,
    name: chatName || "Grup Baru",
    isGroup: !!isGroup,
    avatar: chatAvatar || "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=150&auto=format&fit=crop&q=80",
    description: description || "",
    createdBy,
    admins: [createdBy],
    members: Array.from(new Set([...members, createdBy])),
    archivedBy: [],
    mutedBy: []
  };

  db.chats.push(newChat);
  saveDB();

  // Broadcast to all participants that a new chat room was created
  broadcastEvent({
    type: "chat_new",
    payload: newChat
  }, newChat.members);

  res.json(newChat);
});

// Update Chat (Name, Avatar, Description)
app.put("/api/chats/:chatId", (req, res) => {
  const { chatId } = req.params;
  const { name, avatar, description, userId } = req.body;

  const chat = db.chats.find(c => c.id === chatId);
  if (!chat) return res.status(404).json({ error: "Chat tidak ditemukan." });

  const editor = db.users.find(u => u.id === userId);
  if (!editor) {
    return res.status(404).json({ error: "Pengguna tidak ditemukan." });
  }

  if (chat.isGroup) {
    const role = editor.role;
    if (role !== "CS LINE" && role !== "KAPTEN KASIR") {
      return res.status(403).json({ error: "Hanya CS LINE dan KAPTEN KASIR yang dapat mengubah info grup ini." });
    }
  }

  if (name) chat.name = name;
  if (avatar) chat.avatar = avatar;
  if (description !== undefined) chat.description = description;

  saveDB();

  // Create system log message about edit
  const editorName = editor.name;
  const systemMsg: Message = {
    id: "sys_" + Date.now(),
    chatId,
    senderId: "system",
    senderName: "Sistem",
    senderAvatar: "",
    text: `${editorName} mengubah info grup.`,
    type: "text",
    readBy: chat.members,
    deletedFor: [],
    deletedForEveryone: false,
    createdAt: new Date().toISOString()
  };
  db.messages.push(systemMsg);
  saveDB();

  broadcastEvent({
    type: "chat_updated",
    payload: chat
  }, chat.members);

  broadcastEvent({
    type: "message_new",
    payload: systemMsg
  }, chat.members);

  res.json(chat);
});

// Delete Group Chat (Admin Only)
app.delete("/api/chats/:chatId", (req, res) => {
  const { chatId } = req.params;
  const { userId } = req.body;

  const chatIdx = db.chats.findIndex(c => c.id === chatId);
  if (chatIdx === -1) return res.status(404).json({ error: "Grup tidak ditemukan." });

  const chat = db.chats[chatIdx];
  if (!chat.isGroup) return res.status(400).json({ error: "Bukan grup chat." });

  if (!chat.admins.includes(userId)) {
    return res.status(403).json({ error: "Hanya Admin yang dapat menghapus grup ini." });
  }

  // Remove chat and messages
  const members = chat.members;
  db.chats.splice(chatIdx, 1);
  db.messages = db.messages.filter(m => m.chatId !== chatId);
  saveDB();

  broadcastEvent({
    type: "chat_deleted",
    payload: { chatId }
  }, members);

  res.json({ success: true });
});

// Add members to group
app.post("/api/chats/:chatId/members", (req, res) => {
  const { chatId } = req.params;
  const { memberIds, userId } = req.body; // memberIds: array of strings to add

  const chat = db.chats.find(c => c.id === chatId);
  if (!chat) return res.status(404).json({ error: "Grup tidak ditemukan." });

  const addedUsers: string[] = [];
  memberIds.forEach((mId: string) => {
    if (!chat.members.includes(mId)) {
      chat.members.push(mId);
      addedUsers.push(mId);
    }
  });

  if (addedUsers.length > 0) {
    saveDB();

    const adder = db.users.find(u => u.id === userId);
    const adderName = adder ? adder.name : "Seseorang";
    const names = addedUsers.map(id => db.users.find(u => u.id === id)?.name || id).join(", ");

    const systemMsg: Message = {
      id: "sys_" + Date.now(),
      chatId,
      senderId: "system",
      senderName: "Sistem",
      senderAvatar: "",
      text: `${adderName} mengundang ${names} bergabung ke grup.`,
      type: "text",
      readBy: chat.members,
      deletedFor: [],
      deletedForEveryone: false,
      createdAt: new Date().toISOString()
    };
    db.messages.push(systemMsg);
    saveDB();

    broadcastEvent({
      type: "chat_updated",
      payload: chat
    }, chat.members);

    broadcastEvent({
      type: "message_new",
      payload: systemMsg
    }, chat.members);
  }

  res.json(chat);
});

// Leave / Remove Member from group
app.delete("/api/chats/:chatId/members", (req, res) => {
  const { chatId } = req.params;
  const { targetMemberId, userId } = req.body; // targetMemberId can be self (leave) or another (kick)

  const chat = db.chats.find(c => c.id === chatId);
  if (!chat) return res.status(404).json({ error: "Grup tidak ditemukan." });

  const isSelf = targetMemberId === userId;
  if (!isSelf && !chat.admins.includes(userId)) {
    return res.status(403).json({ error: "Hanya Admin yang dapat mengeluarkan anggota." });
  }

  const memberIdx = chat.members.indexOf(targetMemberId);
  if (memberIdx !== -1) {
    chat.members.splice(memberIdx, 1);

    // If admins list includes target, remove
    const adminIdx = chat.admins.indexOf(targetMemberId);
    if (adminIdx !== -1) chat.admins.splice(adminIdx, 1);

    // If group is now empty, delete
    if (chat.members.length === 0) {
      db.chats = db.chats.filter(c => c.id !== chatId);
    } else {
      // If leaving user was the only admin, assign admin to someone else
      if (chat.admins.length === 0 && chat.isGroup) {
        chat.admins.push(chat.members[0]);
      }
    }

    saveDB();

    const targetUser = db.users.find(u => u.id === targetMemberId);
    const targetName = targetUser ? targetUser.name : "Seseorang";
    const actor = db.users.find(u => u.id === userId);
    const actorName = actor ? actor.name : "Seseorang";

    const systemMsg: Message = {
      id: "sys_" + Date.now(),
      chatId,
      senderId: "system",
      senderName: "Sistem",
      senderAvatar: "",
      text: isSelf ? `${targetName} telah keluar dari grup.` : `${targetName} dikeluarkan dari grup oleh ${actorName}.`,
      type: "text",
      readBy: chat.members,
      deletedFor: [],
      deletedForEveryone: false,
      createdAt: new Date().toISOString()
    };
    db.messages.push(systemMsg);
    saveDB();

    // Broadcast to left user that they were removed
    broadcastEvent({
      type: "chat_removed",
      payload: { chatId, userId: targetMemberId }
    }, [targetMemberId]);

    // Broadcast update to remaining members
    broadcastEvent({
      type: "chat_updated",
      payload: chat
    }, chat.members);

    broadcastEvent({
      type: "message_new",
      payload: systemMsg
    }, chat.members);
  }

  res.json({ success: true, chat });
});

// Assign / Revoke Admin Roles
app.post("/api/chats/:chatId/admins", (req, res) => {
  const { chatId } = req.params;
  const { targetMemberId, userId } = req.body;

  const chat = db.chats.find(c => c.id === chatId);
  if (!chat) return res.status(404).json({ error: "Grup tidak ditemukan." });

  if (!chat.admins.includes(userId)) {
    return res.status(403).json({ error: "Hanya Admin yang dapat menyetel admin baru." });
  }

  if (!chat.admins.includes(targetMemberId)) {
    chat.admins.push(targetMemberId);
    saveDB();

    const promoter = db.users.find(u => u.id === userId);
    const promoterName = promoter ? promoter.name : "Seseorang";
    const target = db.users.find(u => u.id === targetMemberId);
    const targetName = target ? target.name : "Seseorang";

    const systemMsg: Message = {
      id: "sys_" + Date.now(),
      chatId,
      senderId: "system",
      senderName: "Sistem",
      senderAvatar: "",
      text: `${targetName} sekarang dijadikan Admin grup oleh ${promoterName}.`,
      type: "text",
      readBy: chat.members,
      deletedFor: [],
      deletedForEveryone: false,
      createdAt: new Date().toISOString()
    };
    db.messages.push(systemMsg);
    saveDB();

    broadcastEvent({
      type: "chat_updated",
      payload: chat
    }, chat.members);

    broadcastEvent({
      type: "message_new",
      payload: systemMsg
    }, chat.members);
  }

  res.json(chat);
});

// Archive Chat toggle
app.post("/api/chats/:chatId/archive", (req, res) => {
  const { chatId } = req.params;
  const { userId } = req.body;

  const chat = db.chats.find(c => c.id === chatId);
  if (!chat) return res.status(404).json({ error: "Chat tidak ditemukan." });

  const idx = chat.archivedBy.indexOf(userId);
  if (idx === -1) {
    chat.archivedBy.push(userId);
  } else {
    chat.archivedBy.splice(idx, 1);
  }

  saveDB();
  res.json({ success: true, chat });
});

// Toggle Mute Group
app.post("/api/chats/:chatId/mute", (req, res) => {
  const { chatId } = req.params;
  const { userId } = req.body;

  const chat = db.chats.find(c => c.id === chatId);
  if (!chat) return res.status(404).json({ error: "Chat tidak ditemukan." });

  const idx = chat.mutedBy.indexOf(userId);
  if (idx === -1) {
    chat.mutedBy.push(userId);
  } else {
    chat.mutedBy.splice(idx, 1);
  }

  saveDB();
  res.json({ success: true, chat });
});

// Toggle Pin Chat
app.post("/api/chats/:chatId/pin", (req, res) => {
  const { chatId } = req.params;
  const { userId } = req.body;

  const chat = db.chats.find(c => c.id === chatId);
  if (!chat) return res.status(404).json({ error: "Chat tidak ditemukan." });

  if (!chat.pinnedBy) {
    chat.pinnedBy = [];
  }

  const idx = chat.pinnedBy.indexOf(userId);
  if (idx === -1) {
    chat.pinnedBy.push(userId);
  } else {
    chat.pinnedBy.splice(idx, 1);
  }

  saveDB();
  res.json({ success: true, chat });
});

// --- MESSAGES API ENDPOINTS ---

// Get messages for a chat
app.get("/api/chats/:chatId/messages", (req, res) => {
  const { chatId } = req.params;
  const userId = req.query.userId as string;

  if (!userId) return res.status(400).json({ error: "userId diperlukan." });

  // Filter messages for this chat and filter out messages deleted for this user
  const chatMessages = db.messages.filter(m => m.chatId === chatId && !m.deletedFor.includes(userId));
  res.json(chatMessages);
});

// Send Message
app.post("/api/chats/:chatId/messages", (req, res) => {
  const { chatId } = req.params;
  const { senderId, text, type, mediaUrl, fileName, fileSize, replyTo } = req.body;

  const chat = db.chats.find(c => c.id === chatId);
  if (!chat) return res.status(404).json({ error: "Chat tidak ditemukan." });

  const sender = db.users.find(u => u.id === senderId);
  if (!sender) return res.status(404).json({ error: "Pengirim tidak ditemukan." });

  const newMsg: Message = {
    id: "msg_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    chatId,
    senderId,
    senderName: sender.name,
    senderAvatar: sender.avatar,
    text: text || "",
    type: type || "text",
    mediaUrl,
    fileName,
    fileSize,
    replyTo,
    readBy: [senderId],
    deletedFor: [],
    deletedForEveryone: false,
    createdAt: new Date().toISOString()
  };

  // Auto-read by other online users viewing the chat
  chat.members.forEach(mId => {
    const isOnlineInChat = sseClients.some(c => c.userId === mId);
    if (isOnlineInChat && !newMsg.readBy.includes(mId)) {
      newMsg.readBy.push(mId);
    }
  });

  db.messages.push(newMsg);
  saveDB();

  // Broadcast new message to all chat members
  broadcastEvent({
    type: "message_new",
    payload: newMsg
  }, chat.members);

  // If chat is archived, unarchive it automatically when a new message arrives
  if (chat.archivedBy.length > 0) {
    chat.archivedBy = [];
    saveDB();
    broadcastEvent({
      type: "chat_updated",
      payload: chat
    }, chat.members);
  }

  res.json(newMsg);

  // Handle AI Character responses
  handleAIReplies(chatId, newMsg);
});

// Mark messages as read
app.post("/api/chats/:chatId/read", (req, res) => {
  const { chatId } = req.params;
  const { userId } = req.body;

  const chat = db.chats.find(c => c.id === chatId);
  if (!chat) return res.status(404).json({ error: "Chat tidak ditemukan." });

  let updated = false;
  db.messages.forEach(msg => {
    if (msg.chatId === chatId && !msg.readBy.includes(userId)) {
      msg.readBy.push(userId);
      updated = true;
    }
  });

  if (updated) {
    saveDB();
    // Broadcast read update
    broadcastEvent({
      type: "chat_read",
      payload: { chatId, userId }
    }, chat.members);
  }

  res.json({ success: true });
});

// Delete message
app.post("/api/chats/:chatId/delete-message", (req, res) => {
  const { chatId } = req.params;
  const { messageId, userId, deleteForEveryone } = req.body;

  const chat = db.chats.find(c => c.id === chatId);
  if (!chat) return res.status(404).json({ error: "Chat tidak ditemukan." });

  const msg = db.messages.find(m => m.id === messageId);
  if (!msg) return res.status(404).json({ error: "Pesan tidak ditemukan." });

  if (deleteForEveryone) {
    if (msg.senderId !== userId) {
      return res.status(403).json({ error: "Hanya pengirim pesan yang bisa menghapus untuk semua orang." });
    }
    msg.deletedForEveryone = true;
    msg.text = "Pesan ini telah dihapus";
    msg.mediaUrl = undefined;
    msg.fileName = undefined;
    msg.fileSize = undefined;
  } else {
    if (!msg.deletedFor.includes(userId)) {
      msg.deletedFor.push(userId);
    }
  }

  saveDB();

  broadcastEvent({
    type: "message_deleted",
    payload: { messageId, chatId, deletedFor: msg.deletedFor, deletedForEveryone: msg.deletedForEveryone }
  }, chat.members);

  res.json({ success: true, message: msg });
});

// React to message (give emotion)
app.post("/api/chats/:chatId/messages/:messageId/react", (req, res) => {
  const { chatId, messageId } = req.params;
  const { userId, emoji } = req.body;

  const chat = db.chats.find(c => c.id === chatId);
  if (!chat) return res.status(404).json({ error: "Chat tidak ditemukan." });

  const msg = db.messages.find(m => m.id === messageId);
  if (!msg) return res.status(404).json({ error: "Pesan tidak ditemukan." });

  if (!msg.reactions) {
    msg.reactions = {};
  }

  if (!emoji) {
    // Remove reaction if empty
    delete msg.reactions[userId];
  } else {
    // Set reaction
    msg.reactions[userId] = emoji;
  }

  saveDB();

  broadcastEvent({
    type: "message_reaction",
    payload: { chatId, messageId, reactions: msg.reactions }
  }, chat.members);

  res.json({ success: true, message: msg });
});

// Typing indicator broadcast
app.post("/api/chats/:chatId/typing", (req, res) => {
  const { chatId } = req.params;
  const { userId, isTyping } = req.body;

  const chat = db.chats.find(c => c.id === chatId);
  if (!chat) return res.status(404).json({ error: "Chat tidak ditemukan." });

  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: "User tidak ditemukan." });

  broadcastEvent({
    type: "typing",
    payload: { chatId, userId, username: user.username, isTyping }
  }, chat.members.filter(mId => mId !== userId));

  res.json({ success: true });
});

// File upload handler
app.post("/api/upload", async (req, res) => {
  const { fileName, fileType, fileData } = req.body;

  if (!fileName || !fileData) {
    return res.status(400).json({ error: "Gagal upload: Nama file dan data wajib diisi." });
  }

  try {
    // Strip base64 prefix
    const base64Data = fileData.replace(/^data:.*;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    
    // Create unique filename
    const ext = path.extname(fileName) || ".png";
    const uniqueName = `file_${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`;

    // Try uploading to Supabase Storage first if the supabase client is initialized
    let supabaseSuccess = false;
    let fileUrl = "";

    if (supabase) {
      try {
        // Try to ensure the "uploads" bucket exists
        await supabase.storage.createBucket("uploads", {
          public: true,
          fileSizeLimit: 52428800 // 50MB
        });
      } catch (bucketErr) {
        // Ignore errors if the bucket already exists
      }

      try {
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("uploads")
          .upload(uniqueName, buffer, {
            contentType: fileType || "application/octet-stream",
            upsert: true
          });

        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage
            .from("uploads")
            .getPublicUrl(uniqueName);
          
          if (urlData?.publicUrl) {
            console.log("Uploaded successfully to Supabase Storage:", urlData.publicUrl);
            fileUrl = urlData.publicUrl;
            supabaseSuccess = true;
          }
        } else {
          console.error("Supabase Storage upload error:", uploadError);
        }
      } catch (storageErr) {
        console.error("Failed to upload to Supabase Storage:", storageErr);
      }
    }

    if (supabaseSuccess) {
      return res.json({ success: true, fileUrl });
    }

    // Require Supabase Storage if running in cloud production (e.g., Vercel) or if Supabase is initialized
    if (process.env.VERCEL || process.env.NODE_ENV === "production" || supabase) {
      return res.status(400).json({
        error: "⚠️ Upload gagal: Supabase Storage belum dikonfigurasi. Silakan buat bucket bernama 'uploads' di dashboard Supabase Anda dan aktifkan kebijakan akses publik (RLS/Policies) agar file dapat diunggah."
      });
    }

    // Fallback: Local filesystem (only for local development / offline use)
    try {
      const filePath = path.join(uploadsDir, uniqueName);
      fs.writeFileSync(filePath, buffer);

      const localUrl = `/uploads/${uniqueName}`;
      res.json({ success: true, fileUrl: localUrl });
    } catch (fsErr) {
      console.warn("Failed to save file locally:", fsErr);
      res.status(500).json({ error: "Gagal menyimpan file secara lokal." });
    }
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Gagal menyimpan file." });
  }
});

// --- REALTIME SSE ENDPOINT ---

app.get("/api/realtime", (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) {
    res.status(400).send("userId query parameter required");
    return;
  }

  // Setup SSE Headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  });
  res.write("retry: 3000\n\n"); // Auto retry every 3s if disconnected

  // Save connection
  const newClient: SSEClient = { userId, res };
  sseClients.push(newClient);

  // Set user online
  const user = db.users.find(u => u.id === userId);
  if (user) {
    user.isOnline = true;
    user.lastSeen = new Date().toISOString();
    saveDB();

    // Broadcast user online status
    broadcastEvent({
      type: "user_status",
      payload: { userId, isOnline: true, lastSeen: user.lastSeen }
    });
  }

  // Keep alive ping every 25 seconds
  const keepAlive = setInterval(() => {
    res.write(": ping\n\n");
  }, 25000);

  // Client disconnects
  req.on("close", () => {
    clearInterval(keepAlive);
    sseClients = sseClients.filter(c => c !== newClient);

    // Set user offline if they don't have any other open connections
    const stillConnected = sseClients.some(c => c.userId === userId);
    if (!stillConnected) {
      const u = db.users.find(usr => usr.id === userId);
      if (u) {
        u.isOnline = false;
        u.lastSeen = new Date().toISOString();
        saveDB();

        broadcastEvent({
          type: "user_status",
          payload: { userId, isOnline: false, lastSeen: u.lastSeen }
        });
      }
    }
  });
});

// --- VITE MIDDLEWARE SETUP ---

async function startServer() {
  if (process.env.VERCEL) {
    // In Vercel serverless environment, we don't need app.listen or static file serving
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

export default app;
