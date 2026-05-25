const config = require("../config");
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

async function sendMessage(chatId, text) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
}

async function notifyOwners(message) {
  for (const id of config.owners) {
    await sendMessage(id, message);
  }
}

async function forwardPhotoToOwners(fileId, caption) {
  for (const id of config.owners) {
    await fetch(`${TELEGRAM_API}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: id, photo: fileId, caption, parse_mode: "Markdown" }),
    });
  }
}

async function getGeminiReply(userMessage, username) {
  const prompt = `তুমি Bangladesh Income Hub এর customer service assistant। Bangla তে কথা বলবে। ভদ্র হবে। "ভাইজান" এবং "আপনি" ব্যবহার করবে।\n\nতুমি জানো:\n- Indicator: ${config.indicator.name}\n- Price: ${config.indicator.price}\n- বৈশিষ্ট্য: ${config.indicator.features.join(", ")}\n- bKash: ${config.bkash.number} (${config.bkash.accountName}) - ${config.bkash.type}\n- Future: ${config.futureProducts.join(", ")}\n\nPayment হলে screenshot পাঠাতে বলবে। Complex সমস্যায় বলবে team যোগাযোগ করবে।\n\nUser (@${username}): ${userMessage}`;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "দুঃখিত ভাইজান, একটু সমস্যা হচ্ছে।";
  } catch {
    return "দুঃখিত ভাইজান, এই মুহূর্তে reply দিতে পারছি না।";
  }
}

async function handleCommand(chatId, command, username) {
  switch (command) {
    case "/start":
      await sendMessage(chatId, config.messages.welcome);
      await sendMessage(chatId, config.messages.menu);
      await notifyOwners(`👤 নতুন user: @${username}`);
      break;
    case "/indicator":
      await sendMessage(chatId, `📊 *${config.indicator.name}*\n\n${config.indicator.description}\n\n${config.indicator.features.join("\n")}\n\n💰 *Price: ${config.indicator.price}*\n\nকিনতে /buy লিখুন।`);
      break;
    case "/buy":
      await sendMessage(chatId, `🛒 *কেনার নিয়ম:*\n\n1️⃣ bKash ${config.bkash.type} করুন\n📱 *${config.bkash.number}*\n👤 ${config.bkash.accountName}\n💰 *${config.indicator.price}*\n\n2️⃣ Screenshot এই chat এ পাঠান\n3️⃣ Confirm হলে indicator পাঠাবো ✅`);
      break;
    case "/payment":
      await sendMessage(chatId, `💳 *Payment Info:*\n\n📱 bKash: *${config.bkash.number}*\n👤 ${config.bkash.accountName}\n💰 Type: ${config.bkash.type}\n\nPayment পর screenshot পাঠান ভাইজান।`);
      break;
    case "/products":
      await sendMessage(chatId, `🛍️ *আমাদের Products:*\n\n✅ ${config.indicator.name} — ${config.indicator.price}\n\n*আসছে:*\n${config.futureProducts.join("\n")}`);
      break;
    case "/support":
      await sendMessage(chatId, `🆘 আপনার সমস্যা লিখুন ভাইজান — আমি সাহায্য করবো।`);
      break;
    default:
      await sendMessage(chatId, config.messages.menu);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).json({ ok: true });
  try {
    const { message } = req.body;
    if (!message) return res.status(200).json({ ok: true });
    const chatId = message.chat.id;
    const username = message.from?.username || message.from?.first_name || "Unknown";
    const text = message.text || "";
    const photo = message.photo;
    if (photo) {
      const fileId = photo[photo.length - 1].file_id;
      await sendMessage(chatId, `✅ ধন্যবাদ ভাইজান! Screenshot পেয়েছি। Verify করে indicator পাঠাবো। 🙏`);
      await forwardPhotoToOwners(fileId, `💳 *Payment Screenshot!*\n👤 @${username}\n📱 Chat ID: ${chatId}`);
      return res.status(200).json({ ok: true });
    }
    if (text.startsWith("/")) {
      await handleCommand(chatId, text.split(" ")[0].toLowerCase(), username);
      if (!text.startsWith("/start")) await notifyOwners(`📌 @${username}: ${text}`);
    } else if (text) {
      await notifyOwners(`💬 *@${username}:* ${text}`);
      const reply = await getGeminiReply(text, username);
      await sendMessage(chatId, reply);
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(200).json({ ok: true });
  }
}
