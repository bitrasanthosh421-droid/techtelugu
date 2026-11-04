/**
 * Tech Telugu Hub • AI Assistant Bot Widget
 * Powered by Google Gemini & Curated Tech Knowledge
 */
(function() {
  // Prevent duplicate initialization
  if (window.__TT_AI_BOT_INITIALIZED__) return;
  window.__TT_AI_BOT_INITIALIZED__ = true;

  const STORAGE_KEY_CUSTOM_API = "tt_gemini_custom_key";
  const STORAGE_KEY_SOUND = "tt_ai_sound_enabled";
  
  let isOpen = false;
  let isSoundEnabled = localStorage.getItem(STORAGE_KEY_SOUND) === "1";
  let isSpeechListening = false;
  let recognitionInstance = null;
  let conversationHistory = [];

  // Helper: Sanitize & parse basic markdown
  function renderMarkdown(text) {
    if (!text) return "";
    let escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Bold **text**
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    // Italic *text*
    escaped = escaped.replace(/\*(.*?)\*/g, "<em>$1</em>");
    // Code `code`
    escaped = escaped.replace(/`([^`]+)`/g, "<code style=\"background:#e2e8f0;padding:2px 5px;border-radius:4px;font-size:11.5px;font-family:monospace\">$1</code>");
    // Markdown links [title](url)
    escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_self">$1</a>');
    
    // Bullet lists
    const lines = escaped.split("\n");
    let inList = false;
    let html = "";

    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith("• ") || trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        if (!inList) {
          html += "<ul>";
          inList = true;
        }
        html += `<li>${trimmed.substring(2)}</li>`;
      } else {
        if (inList) {
          html += "</ul>";
          inList = false;
        }
        if (trimmed) {
          html += `<p style="margin:4px 0">${line}</p>`;
        }
      }
    });

    if (inList) html += "</ul>";
    return html || escaped;
  }

  // Helper: Speak text with browser speech synthesis
  function speakReply(text) {
    if (!isSoundEnabled || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      // Strip markdown tags and urls for smooth audio
      const cleanText = text
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/[*#_`]/g, "")
        .replace(/https?:\/\/\S+/g, "");
      
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.lang = "en-US";
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech synthesis error:", e);
    }
  }

  // Build Widget DOM
  function createWidget() {
    // 1. Launcher Button
    const launcher = document.createElement("button");
    launcher.id = "tt-ai-launcher";
    launcher.setAttribute("aria-label", "Open Tech Telugu AI Assistant");
    launcher.innerHTML = `
      <div class="tt-ai-icon-pulse">
        <svg viewBox="0 0 24 24">
          <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5 2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5 2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5 2.5 2.5 0 0 0-2.5-2.5z"/>
        </svg>
        <span class="tt-ai-badge-dot"></span>
      </div>
      <span>Ask AI ✨</span>
    `;

    // 2. Chat Window
    const win = document.createElement("div");
    win.id = "tt-ai-window";
    win.innerHTML = `
      <!-- Header -->
      <div class="tt-ai-header">
        <div class="tt-ai-header-left">
          <div class="tt-ai-avatar">
            <svg viewBox="0 0 24 24">
              <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5 2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5 2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5 2.5 2.5 0 0 0-2.5-2.5z"/>
            </svg>
            <span class="tt-ai-online-indicator"></span>
          </div>
          <div class="tt-ai-title-wrap">
            <div class="tt-ai-title">Tech Telugu AI</div>
            <div class="tt-ai-subtitle">
              <span>● Online</span> &bull; <span>Gemini Brain</span>
            </div>
          </div>
        </div>
        <div class="tt-ai-header-actions">
          <button id="ttSoundToggle" class="tt-ai-btn-icon" title="Toggle Voice Responses" aria-label="Toggle Voice Responses">
            ${isSoundEnabled ? "🔊" : "🔇"}
          </button>
          <button id="ttSettingsToggle" class="tt-ai-btn-icon" title="AI Settings / API Key" aria-label="Settings">
            ⚙️
          </button>
          <button id="ttCloseBtn" class="tt-ai-btn-icon" title="Close Chat" aria-label="Close Chat">
            ✕
          </button>
        </div>
      </div>

      <!-- Settings Panel -->
      <div id="ttSettingsPanel" class="tt-ai-settings-panel">
        <div class="tt-ai-settings-title">⚙️ AI Assistant Settings</div>
        <div class="tt-ai-settings-desc">
          Add your free Google Gemini API Key for direct high-speed answers, or leave blank to use the site's default engine.
        </div>
        <div class="tt-ai-input-group">
          <input type="password" id="ttCustomApiKey" class="tt-ai-api-input" placeholder="Paste Gemini API Key (AIzaSy...)" />
          <button id="ttSaveKeyBtn" class="tt-ai-save-btn">Save</button>
        </div>
        <div style="margin-top:8px;font-size:11px;display:flex;justify-content:space-between;align-items:center;">
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" style="color:#4f46e5;text-decoration:underline;">Get a free Gemini API Key &rarr;</a>
          <button id="ttClearKeyBtn" style="background:none;border:none;color:#ef4444;font-size:11px;cursor:pointer;padding:0">Remove Key</button>
        </div>
      </div>

      <!-- Quick Suggestion Chips -->
      <div class="tt-ai-chips-wrap">
        <button class="tt-ai-chip" data-prompt="Tell me about Google Antigravity guide">🚀 Google Antigravity</button>
        <button class="tt-ai-chip" data-prompt="How to download and edit in CapCut?">🎬 Download CapCut</button>
        <button class="tt-ai-chip" data-prompt="What are the best AI tools in 2026?">🤖 Best AI Tools</button>
        <button class="tt-ai-chip" data-prompt="Recommend the top mobile productivity apps">📱 Top Apps</button>
        <button class="tt-ai-chip" data-prompt="How can I contact Tech Telugu?">✉️ Contact</button>
      </div>

      <!-- Messages Stream -->
      <div id="ttMessages" class="tt-ai-messages">
        <!-- Initial Welcome Bubble -->
        <div class="tt-ai-message tt-bot">
          <div class="tt-msg-avatar">
            <svg viewBox="0 0 24 24"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5 2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5 2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5 2.5 2.5 0 0 0-2.5-2.5z"/></svg>
          </div>
          <div>
            <div class="tt-msg-bubble">
              👋 <strong>Namaskaram! Welcome to Tech Telugu Hub!</strong><br><br>
              I'm your AI assistant powered by Google Gemini. Ask me anything about our curated mobile apps, video editing in CapCut, Google Antigravity guide, or student AI tools!
            </div>
            <div class="tt-msg-meta">
              <span>Just now</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer / Input Form -->
      <form id="ttChatForm" class="tt-ai-footer">
        <div class="tt-ai-input-wrap">
          <input type="text" id="ttChatInput" class="tt-ai-input" placeholder="Ask about apps, AI, guides..." autocomplete="off" />
          <button type="button" id="ttMicBtn" class="tt-ai-mic-btn" title="Voice Input (Speech-to-Text)" aria-label="Voice Input">
            🎤
          </button>
        </div>
        <button type="submit" id="ttSendBtn" class="tt-ai-send-btn" title="Send Message" aria-label="Send Message">
          <svg viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </form>
    `;

    document.body.appendChild(launcher);
    document.body.appendChild(win);

    setupEventListeners(launcher, win);
  }

  // Event Listeners & Logic
  function setupEventListeners(launcher, win) {
    const closeBtn = document.getElementById("ttCloseBtn");
    const settingsToggle = document.getElementById("ttSettingsToggle");
    const settingsPanel = document.getElementById("ttSettingsPanel");
    const customApiKeyInput = document.getElementById("ttCustomApiKey");
    const saveKeyBtn = document.getElementById("ttSaveKeyBtn");
    const clearKeyBtn = document.getElementById("ttClearKeyBtn");
    const soundToggle = document.getElementById("ttSoundToggle");
    const chatForm = document.getElementById("ttChatForm");
    const chatInput = document.getElementById("ttChatInput");
    const messagesContainer = document.getElementById("ttMessages");
    const micBtn = document.getElementById("ttMicBtn");
    const chipBtns = win.querySelectorAll(".tt-ai-chip");

    // Populate existing saved custom key
    const savedKey = localStorage.getItem(STORAGE_KEY_CUSTOM_API);
    if (savedKey) {
      customApiKeyInput.value = savedKey;
    }

    // Toggle Open / Close
    function toggleChat(state) {
      isOpen = typeof state === "boolean" ? state : !isOpen;
      if (isOpen) {
        win.classList.add("tt-open");
        launcher.style.display = "none";
        setTimeout(() => chatInput.focus(), 200);
      } else {
        win.classList.remove("tt-open");
        launcher.style.display = "flex";
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      }
    }

    launcher.addEventListener("click", () => toggleChat(true));
    closeBtn.addEventListener("click", () => toggleChat(false));

    // Sound Toggle
    soundToggle.addEventListener("click", () => {
      isSoundEnabled = !isSoundEnabled;
      localStorage.setItem(STORAGE_KEY_SOUND, isSoundEnabled ? "1" : "0");
      soundToggle.innerText = isSoundEnabled ? "🔊" : "🔇";
      if (!isSoundEnabled && ('speechSynthesis' in window)) {
        window.speechSynthesis.cancel();
      }
    });

    // Settings Toggle
    settingsToggle.addEventListener("click", () => {
      settingsPanel.classList.toggle("tt-show");
    });

    // Save Custom Key
    saveKeyBtn.addEventListener("click", () => {
      const val = customApiKeyInput.value.trim();
      if (val) {
        localStorage.setItem(STORAGE_KEY_CUSTOM_API, val);
        alert("✅ Gemini API Key saved locally! Your questions will now be processed directly through your Gemini key.");
      } else {
        localStorage.removeItem(STORAGE_KEY_CUSTOM_API);
        alert("Gemini API Key cleared. Default engine will be used.");
      }
      settingsPanel.classList.remove("tt-show");
    });

    clearKeyBtn.addEventListener("click", () => {
      localStorage.removeItem(STORAGE_KEY_CUSTOM_API);
      customApiKeyInput.value = "";
      alert("Custom Gemini key removed.");
      settingsPanel.classList.remove("tt-show");
    });

    // Quick Chips
    chipBtns.forEach(chip => {
      chip.addEventListener("click", () => {
        const prompt = chip.getAttribute("data-prompt");
        if (prompt) {
          submitUserMessage(prompt);
        }
      });
    });

    // Form Submit
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;
      chatInput.value = "";
      submitUserMessage(text);
    });

    // Voice Input Setup
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = "en-US";

      recognitionInstance.onstart = () => {
        isSpeechListening = true;
        micBtn.classList.add("tt-listening");
        chatInput.placeholder = "Listening... Speak now";
      };

      recognitionInstance.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          chatInput.value = transcript;
          submitUserMessage(transcript);
        }
      };

      recognitionInstance.onerror = (e) => {
        console.warn("Speech recognition error:", e);
        stopSpeech();
      };

      recognitionInstance.onend = () => {
        stopSpeech();
      };

      function stopSpeech() {
        isSpeechListening = false;
        micBtn.classList.remove("tt-listening");
        chatInput.placeholder = "Ask about apps, AI, guides...";
      }

      micBtn.addEventListener("click", () => {
        if (!isSpeechListening) {
          try {
            recognitionInstance.start();
          } catch (e) {
            console.warn(e);
          }
        } else {
          recognitionInstance.stop();
        }
      });
    } else {
      micBtn.style.display = "none";
    }

    // Append Message to UI
    function appendMessage(role, text) {
      const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const msgDiv = document.createElement("div");
      msgDiv.className = `tt-ai-message tt-${role}`;

      if (role === "bot") {
        msgDiv.innerHTML = `
          <div class="tt-msg-avatar">
            <svg viewBox="0 0 24 24"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5 2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5 2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5 2.5 2.5 0 0 0-2.5-2.5z"/></svg>
          </div>
          <div>
            <div class="tt-msg-bubble">${renderMarkdown(text)}</div>
            <div class="tt-msg-meta">
              <span>${timeStr}</span>
              <button class="tt-msg-copy-btn" title="Copy response">Copy</button>
            </div>
          </div>
        `;
        // Copy listener
        const copyBtn = msgDiv.querySelector(".tt-msg-copy-btn");
        copyBtn.addEventListener("click", () => {
          navigator.clipboard.writeText(text).then(() => {
            copyBtn.innerText = "Copied!";
            setTimeout(() => { copyBtn.innerText = "Copy"; }, 2000);
          });
        });
      } else {
        msgDiv.innerHTML = `
          <div>
            <div class="tt-msg-bubble">${renderMarkdown(text)}</div>
            <div class="tt-msg-meta">
              <span>${timeStr}</span>
            </div>
          </div>
        `;
      }

      messagesContainer.appendChild(msgDiv);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      return msgDiv;
    }

    // Show Typing Indicator
    function showTypingIndicator() {
      const typingDiv = document.createElement("div");
      typingDiv.className = "tt-typing-indicator";
      typingDiv.id = "ttTypingIndicator";
      typingDiv.innerHTML = `
        <span class="tt-typing-dot"></span>
        <span class="tt-typing-dot"></span>
        <span class="tt-typing-dot"></span>
      `;
      messagesContainer.appendChild(typingDiv);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function removeTypingIndicator() {
      const el = document.getElementById("ttTypingIndicator");
      if (el) el.remove();
    }

    // Send Message to Server
    async function submitUserMessage(messageText) {
      appendMessage("user", messageText);
      conversationHistory.push({ role: "user", text: messageText });
      showTypingIndicator();

      const customApiKey = localStorage.getItem(STORAGE_KEY_CUSTOM_API) || "";

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: messageText,
            history: conversationHistory,
            apiKey: customApiKey
          })
        });

        removeTypingIndicator();

        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }

        const data = await response.json();
        const replyText = data.reply || "Sorry, I couldn't process that right now. Please try again.";
        
        appendMessage("bot", replyText);
        conversationHistory.push({ role: "bot", text: replyText });
        speakReply(replyText);

      } catch (err) {
        removeTypingIndicator();
        console.error("Chatbot request failed:", err);
        const errorReply = "⚠️ Unable to reach the assistant service at the moment. Please check your internet connection or verify your server is running.";
        appendMessage("bot", errorReply);
      }
    }
  }

  // Auto initialize on DOM load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createWidget);
  } else {
    createWidget();
  }
})();
