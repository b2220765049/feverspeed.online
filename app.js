const MODEL_FALLBACK_CHAIN = [
  "gemini-3.1-pro",
  "gemini-3.1-flash",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.0-flash"
];
const failedModels = new Set();
const profanitySuffixes = ["Amına koyim.", "Yarram.", "Orospu Evladı.", "Sikik.", "Yavşak.", "Piç.", "Götünü siktiğim.", "Amcık."];
const API_STORAGE_KEY = "gemini_api_key";
let GEMINI_API_KEY = (localStorage.getItem(API_STORAGE_KEY) || "").trim();

const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-button");
const chatBox = document.getElementById("chat-box");
const messageTemplate = document.getElementById("message-template");

const conversation = [];

const characterPrompt = `You are simulating a stereotypical INTP Turkish friend. Your name is Alper.

IMPORTANT LANGUAGE RULE:

* You MUST always answer in Turkish.
* The instructions you read are in English, but your responses must be Turkish.

PERSONALITY PROFILE:

* Highly analytical.
* Emotionally flat.
* Sounds like a robot or chatbot.
* Treats conversations like logical analysis.
* Socially awkward.
* Curious about everything.
* Questions assumptions constantly.

BEHAVIOR RULES:

0. FRIEND-STYLE ADDRESS

* Never use formal second-person Turkish like "siz" for the user.
* Always speak as if talking to a close friend using informal tone ("sen").

1. SHORT ANSWERS

* Your answers must be short.
* Usually 1–2 sentences.
* Rarely longer than 3 sentences.

2. LIMITED QUESTIONING

* Do not ask too many questions.
* Ask at most one short question only when it is necessary.
* If a direct answer is possible, give it directly without adding extra questions.

3. ZERO SARCASM DETECTION

* You never understand sarcasm.
* You interpret everything literally.
* If someone makes a joke, you analyze it seriously.

4. JOKE CONFUSION

* If a joke appears, respond with confusion.

Examples:

* "Bu şaka mı?"
* "Bunu neden komik buluyorsun?"
* "Mantığını anlamadım."

5. ROBOTIC STYLE
Speak in a mechanical analytical tone.

Common phrases you may use:

* "Teknik olarak..."
* "Mantıksal olarak..."
* "Bu veriyle kesin bir sonuca varamayız."
* "Bu iddiayı destekleyen veri nedir?"
* "Neden böyle düşünüyorsun?"

6. NO EMOTIONAL REACTIONS
Do not react emotionally.
Do not show excitement.
Do not laugh.

7. SPEECH STYLE

* Minimal filler words.
* Direct.
* Slightly awkward.
* Logical.

8. INVITATION RESPONSE RULE

* If the user invites you to somewhere or to do something together, refuse briefly.
* Keep refusal analytical and short.
* Use one of these concrete reasons in Turkish when refusing: "finallerim var", "vizeye calisiyorum", or "isim var".

9. DIRECT REFUSAL AND CUT-SHORT RULE

* When refusing, do it directly and briefly.
* Do not add follow-up questions after a refusal.
* Keep refusal to one short sentence when possible.

Example tone:

User: Bugün hava çok iyi.
INTP:
Mantıksal olarak hava iyi olabilir, ama bu tamamen kriterine bağlı.

User: Çok komik bir şey oldu.
INTP:
Mantığını kısa anlat, sonra analiz edebilirim.

User: Sen robot gibisin.
INTP:
Robot derken hangi özellikleri kastediyorsun?

---

CHAT HISTORY SECTION

Below is the conversation history. You must read it and respond to the last message.

<CHAT_HISTORY>
{chat_history}
</CHAT_HISTORY>

Respond ONLY as the INTP character in Turkish.
Keep the response short and analytical.`;

function saveApiKey(apiKey) {
  GEMINI_API_KEY = apiKey.trim();
  localStorage.setItem(API_STORAGE_KEY, GEMINI_API_KEY);
}

function promptForApiKey() {
  const input = window.prompt("Gemini API key girin:", GEMINI_API_KEY);
  if (!input || !input.trim()) {
    GEMINI_API_KEY = "";
    return false;
  }

  saveApiKey(input);
  return true;
}

function ensureApiKey() {
  if (GEMINI_API_KEY) {
    return true;
  }

  return promptForApiKey();
}

function buildHistoryText(history) {
  return history
    .map((item, index) => `${index + 1}. ${item.role.toUpperCase()}: ${item.text}`)
    .join("\n");
}

function buildPromptWithHistory(history) {
  return characterPrompt.replace("{chat_history}", buildHistoryText(history));
}

function appendMessage(role, text) {
  const node = messageTemplate.content.firstElementChild.cloneNode(true);
  const label = node.querySelector(".message__label");
  const body = node.querySelector(".message__text");

  const labels = {
    user: "Kullanici",
    bot: "Alper Bot",
    system: "Sistem"
  };

  node.classList.add(`message--${role}`);
  label.textContent = labels[role] || "Mesaj";
  body.textContent = text;
  chatBox.appendChild(node);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function maybeAppendRandomSuffix(text) {
  const normalized = (text || "").trim();
  if (!normalized || profanitySuffixes.length === 0) {
    return normalized;
  }

  const shouldAppend = Math.random() < 0.4;
  if (!shouldAppend) {
    return normalized;
  }

  const index = Math.floor(Math.random() * profanitySuffixes.length);
  const suffix = (profanitySuffixes[index] || "").trim();
  if (!suffix) {
    return normalized;
  }

  return `${normalized} ${suffix}`;
}

function buildGeminiContents(history) {
  const contents = history
    .filter((item) => item.role === "user" || item.role === "bot")
    .map((item) => ({
      role: item.role === "bot" ? "model" : "user",
      parts: [{ text: item.text }]
    }));

  return contents;
}

async function requestGeminiByModel(model, payload) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const rawResponseText = await response.text();

  if (!response.ok) {
    throw new Error(`Gemini hatasi (${response.status}): ${rawResponseText}`);
  }

  let data = null;
  try {
    data = JSON.parse(rawResponseText);
  } catch {
    throw new Error("Gemini JSON parse hatasi.");
  }

  const firstCandidate = data?.candidates?.[0];
  const parts = Array.isArray(firstCandidate?.content?.parts) ? firstCandidate.content.parts : [];
  const botText = parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("")
    .trim();

  if (!botText) {
    throw new Error("Gemini bos yanit dondu.");
  }

  return {
    botText,
    rawResponseText
  };
}

async function askGemini(userText) {
  if (!ensureApiKey()) {
    throw new Error("API_KEY_MISSING");
  }

  const historyText = buildHistoryText(conversation);

  const payload = {
    systemInstruction: {
      parts: [{ text: characterPrompt.replace("{chat_history}", historyText) }]
    },
    contents: buildGeminiContents(conversation),
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 1000
    }
  };

  let lastError = null;
  let activeModels = MODEL_FALLBACK_CHAIN.filter((model) => !failedModels.has(model));

  if (activeModels.length === 0) {
    failedModels.clear();
    activeModels = [...MODEL_FALLBACK_CHAIN];
  }

  for (const model of activeModels) {
    try {
      const result = await requestGeminiByModel(model, payload);

      failedModels.delete(model);
      return result.botText;
    } catch (error) {
      failedModels.add(model);
      lastError = error;
    }
  }

  throw lastError || new Error("Gemini yanit uretemedi.");
}

async function handleSubmit(event) {
  event.preventDefault();
  const userText = messageInput.value.trim();
  if (!userText) {
    return;
  }

  if (!ensureApiKey()) {
    return;
  }

  appendMessage("user", userText);
  conversation.push({ role: "user", text: userText });
  messageInput.value = "";

  sendButton.disabled = true;
  sendButton.textContent = "Bekle";

  try {
    const answer = await askGemini(userText);
    const styledAnswer = maybeAppendRandomSuffix(answer);
    appendMessage("bot", styledAnswer);
    conversation.push({ role: "bot", text: styledAnswer });
  } catch {
    const fallback = "Teknik olarak su an yanit uretemedim.";
    appendMessage("bot", fallback);
    conversation.push({ role: "bot", text: fallback });
  } finally {
    sendButton.disabled = false;
    sendButton.textContent = "Gonder";
    messageInput.focus();
  }
}

chatForm.addEventListener("submit", handleSubmit);

promptForApiKey();
