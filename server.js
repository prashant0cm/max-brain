// MAX BRAIN - Backend jo voice/text command samajhta hai aur action decide karta hai
// Flow: Tasker/Browser -> yeh server -> Gemini (function calling) -> action JSON -> wapas Tasker/Browser

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // Render.com env var me dalna
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

// ---- Yeh "tools" hain jo Max perform kar sakta hai ----
// Jab bhi naya action chahiye (jaise "alarm set karo"), yahan naya function add karo
const tools = [
  {
    functionDeclarations: [
      {
        name: "open_app",
        description: "Phone par koi app open karna, jaise WhatsApp, Camera, YouTube",
        parameters: {
          type: "object",
          properties: {
            app_name: { type: "string", description: "App ka naam, e.g. whatsapp, camera, youtube" },
          },
          required: ["app_name"],
        },
      },
      {
        name: "send_message",
        description: "Kisi contact ko WhatsApp ya SMS message bhejna",
        parameters: {
          type: "object",
          properties: {
            contact: { type: "string", description: "Contact ka naam" },
            message: { type: "string", description: "Bhejne wala message" },
            app: { type: "string", description: "whatsapp ya sms", enum: ["whatsapp", "sms"] },
          },
          required: ["contact", "message"],
        },
      },
      {
        name: "make_call",
        description: "Kisi contact ko call lagana",
        parameters: {
          type: "object",
          properties: {
            contact: { type: "string", description: "Contact ka naam" },
          },
          required: ["contact"],
        },
      },
      {
        name: "set_reminder",
        description: "Reminder ya alarm set karna",
        parameters: {
          type: "object",
          properties: {
            time: { type: "string", description: "Time, e.g. '5:30 PM' ya '2026-07-06T17:30:00'" },
            label: { type: "string", description: "Reminder ka message" },
          },
          required: ["time", "label"],
        },
      },
      {
        name: "general_chat",
        description: "Jab command koi phone action nahi hai, sirf normal baat-cheet ya sawal hai",
        parameters: {
          type: "object",
          properties: {
            reply: { type: "string", description: "Max ka spoken reply, Hinglish me casual" },
          },
          required: ["reply"],
        },
      },
    ],
  },
];

const SYSTEM_INSTRUCTION = `Tum "Max" ho — user ka personal Android AI assistant, Jarvis jaisa.
Tumhe user ke voice/text command milega. Tumhe decide karna hai konsa function call karna hai.
Agar command phone action hai (app kholna, message bhejna, call karna, reminder), uska matching function call karo.
Agar sirf normal chat/sawal hai, general_chat function call karo aur reply Hinglish me casual, short rakho.
Hamesha exactly ek function call karo.`;

app.post("/command", async (req, res) => {
  const userText = req.body.text;
  if (!userText) return res.status(400).json({ error: "text field chahiye" });

  try {
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts: [{ text: userText }] }],
        tools,
      }),
    });

    const data = await response.json();
    console.log("GEMINI RAW RESPONSE:", JSON.stringify(data));

    const part = data?.candidates?.[0]?.content?.parts?.find((p) => p.functionCall);

    if (!part) {
      return res.json({ action: "general_chat", params: { reply: "Samajh nahi paya, phir se bolo." } });
    }

    const { name, args } = part.functionCall;
    // Yeh JSON hi Tasker ko milega — Tasker isi ke hisaab se phone par action karega
    return res.json({ action: name, params: args });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Max ka brain abhi so raha hai (server error)" });
  }
});

app.get("/", (req, res) => res.send("Max brain is alive 🟣"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Max backend running on port ${PORT}`));
