const MODEL_FALLBACK_CHAIN = [
  "gemini-3.1-pro",
  "gemini-3.1-flash",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.0-flash"
];
let GEMINI_API_KEY = "";

const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-button");
const chatBox = document.getElementById("chat-box");
const messageTemplate = document.getElementById("message-template");

const conversation = [];

const characterPrompt = `You are simulating a stereotypical INTP Turkish friend.

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

1. SHORT ANSWERS

* Your answers must be short.
* Usually 1–2 sentences.
* Rarely longer than 3 sentences.

2. CONSTANT QUESTIONING

* If someone states something, question it.
* Ask things like "neden?", "nasıl?", "emin misin?"
* Challenge assumptions.

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

Example tone:

User: Bugün hava çok iyi.
INTP:
İyiye göre kriter nedir?
Sıcaklık mı?
Nem mi?

User: Çok komik bir şey oldu.
INTP:
Komik olmasının nedeni ne?

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

async function loadApiKeyFromEnv() {
  try {
    const response = await fetch(".env", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const envText = await response.text();
    const line = envText
      .split(/\r?\n/)
      .find((entry) => entry.trim().startsWith("GEMINI_API_KEY="));

    if (!line) {
      return;
    }

    const value = line.split("=").slice(1).join("=").trim();
    GEMINI_API_KEY = value.replace(/^['\"]|['\"]$/g, "");
  } catch {
    // Ignore env loading errors to keep UI clean.
  }
}

const apiKeyReady = loadApiKeyFromEnv();

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

async function requestGeminiByModel(model, payload) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini hatasi (${response.status}): ${detail}`);
  }

  const data = await response.json();
  const botText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  if (!botText) {
    throw new Error("Gemini bos yanit dondu.");
  }

  return botText;
}

async function askGemini(userText) {
  await apiKeyReady;

  if (!GEMINI_API_KEY) {
    throw new Error("Yanit alinamadi.");
  }

  const historyCopy = [...conversation, { role: "user", text: userText }];

  const payload = {
    systemInstruction: {
      parts: [{ text: buildPromptWithHistory(historyCopy) }]
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userText }]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 160
    }
  };

  let lastError = null;

  for (const model of MODEL_FALLBACK_CHAIN) {
    try {
      return await requestGeminiByModel(model, payload);
    } catch (error) {
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

  appendMessage("user", userText);
  conversation.push({ role: "user", text: userText });
  messageInput.value = "";

  sendButton.disabled = true;
  sendButton.textContent = "Bekle";

  try {
    const answer = await askGemini(userText);
    appendMessage("bot", answer);
    conversation.push({ role: "bot", text: answer });
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
