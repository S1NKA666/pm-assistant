// Создаем и внедряем стили для тоста и кнопки
const style = document.createElement('style');
style.textContent = `
  .pm-assistant-float-btn {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 99999;
    background: linear-gradient(135deg, #6366f1, #4f46e5);
    color: white;
    border: none;
    border-radius: 50px;
    padding: 12px 20px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .pm-assistant-float-btn:hover {
    transform: translateY(-3px) scale(1.03);
    box-shadow: 0 6px 20px rgba(99, 102, 241, 0.6);
  }
  .pm-assistant-float-btn:active {
    transform: translateY(0) scale(0.98);
  }
  
  .pm-toast {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 100000;
    background: rgba(15, 23, 42, 0.9);
    color: white;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 16px 24px;
    border-radius: 12px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
    transform: translateY(-50px);
    opacity: 0;
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    display: flex;
    align-items: center;
    gap: 10px;
    pointer-events: none;
  }
  .pm-toast.show {
    transform: translateY(0);
    opacity: 1;
  }
  .pm-toast-icon-success {
    color: #10b981;
    font-weight: bold;
  }
  .pm-toast-icon-error {
    color: #ef4444;
    font-weight: bold;
  }
`;
document.head.appendChild(style);

// Функция для отображения уведомления (Toast)
function showToast(message, isSuccess = true) {
  let toast = document.querySelector('.pm-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'pm-toast';
    document.body.appendChild(toast);
  }
  
  const icon = isSuccess 
    ? '<span class="pm-toast-icon-success">✓</span>' 
    : '<span class="pm-toast-icon-error">✗</span>';
    
  toast.innerHTML = `${icon} <span>${message}</span>`;
  
  // Анимация показа
  setTimeout(() => toast.classList.add('show'), 100);
  
  // Убрать через 3.5 секунды
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

// Слушаем сообщения из background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "showToast") {
    showToast(request.message, request.success);
  }
});

// Добавляем плавающую кнопку
function initFloatButton() {
  const btn = document.createElement('button');
  btn.className = 'pm-assistant-float-btn';
  btn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
    PM: Import Chat
  `;
  document.body.appendChild(btn);

  btn.addEventListener('click', async () => {
    // 1. Проверяем выделенный текст
    const selection = window.getSelection().toString().trim();
    if (selection) {
      sendChatData({ text: selection, title: "Manual Selection", messages: [] });
      return;
    }

    // 2. Ищем скролл-контейнер чата
    const mainChat = document.querySelector('#main, [role="region"], .two');
    let scroller = null;
    if (mainChat) {
      const anyMsg = mainChat.querySelector('[data-pre-plain-text], .message-in, .message-out');
      if (anyMsg) {
        scroller = findScroller(anyMsg);
      }
    }

    // 3. Если скроллер найден, делаем быструю подгрузку истории вверх
    if (scroller) {
      btn.disabled = true;
      btn.innerHTML = `Синхронизация...`;
      await scrollAndLoadHistory(scroller, 6); // 6 итераций скроллинга вверх (~2.4 сек)
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        PM: Import Chat
      `;
    }

    // 4. Пытаемся спарсить открытый чат
    const chatData = await parseActiveChat();
    if (chatData && chatData.messages && chatData.messages.length > 0) {
      sendChatData(chatData);
    } else {
      showToast("Select messages or open a conversation first!", false);
    }
  });
}

// Вспомогательная функция поиска скролл-контейнера
function findScroller(element) {
  let parent = element.parentElement;
  while (parent && parent !== document.body) {
    const style = window.getComputedStyle(parent);
    if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

// Плавный автоскроллинг чата вверх для загрузки истории
async function scrollAndLoadHistory(scroller, limit = 6) {
  showToast("Загружаем историю сообщений чата...", true);
  return new Promise((resolve) => {
    let count = 0;
    const interval = setInterval(() => {
      if (scroller && count < limit) {
        scroller.scrollTop = 0; // Скроллим в самый верх
        count++;
      } else {
        clearInterval(interval);
        resolve();
      }
    }, 400);
  });
}

// Хелпер для конвертации картинок (скриншотов) в base64 на лету
function getBase64Image(imgEl) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = imgEl.naturalWidth || imgEl.width;
    canvas.height = imgEl.naturalHeight || imgEl.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(imgEl, 0, 0);
    return canvas.toDataURL("image/png");
  } catch (e) {
    return null;
  }
}

// Парсинг переписки на страницах Telegram Web / WhatsApp Web
async function parseActiveChat() {
  const url = window.location.href;
  let messages = [];
  let title = "Chat Import";

  console.log("PM Flow Copilot: Starting chat parsing...");

  if (url.includes("web.whatsapp.com")) {
    title = "WhatsApp Chat";
    const headerTitle = document.querySelector('header span[title], header [role="button"] span, header span[dir="auto"]');
    if (headerTitle) {
      title = `WhatsApp: ${headerTitle.getAttribute('title') || headerTitle.innerText}`;
    }

    const mainChat = document.querySelector('#main, [role="region"], .two');
    console.log("WhatsApp Web: mainChat container found:", !!mainChat);

    if (mainChat) {
      const copyableElements = mainChat.querySelectorAll('[data-pre-plain-text]');
      console.log("WhatsApp Web: copyable elements found:", copyableElements.length);
      
      copyableElements.forEach(el => {
        const senderInfo = el.getAttribute('data-pre-plain-text'); // e.g. "[16:22, 16.07.2026] Cristina: "
        let text = el.innerText || "";
        text = text.replace(/\s*\d{2}:\d{2}\s*$/, '').trim();
        
        // Получаем уникальный ID сообщения из родительских нод
        let parentWithId = el;
        while (parentWithId && !parentWithId.getAttribute('data-id')) {
          parentWithId = parentWithId.parentElement;
        }
        const msgId = parentWithId ? parentWithId.getAttribute('data-id') : 'wa_msg_' + Math.random().toString(36).substr(2, 9);
        
        // Сбор скриншотов/картинок
        let media = [];
        const imgElements = el.querySelectorAll('img');
        imgElements.forEach(img => {
          const isEmoji = img.src.includes('emoji') || img.classList.contains('wa') || (img.width < 45 && img.height < 45);
          if (!isEmoji) {
            const base64 = getBase64Image(img);
            if (base64) media.push(base64);
          }
        });

        if (text || media.length > 0) {
          messages.push({
            id: msgId,
            text: `${senderInfo}${text}`,
            media: media
          });
        }
      });
    }

    // Резервный вариант, если ничего не нашлось
    if (messages.length === 0) {
      console.log("WhatsApp Web: running fallback parser...");
      const fallbackElements = document.querySelectorAll('.message-in, .message-out, div[data-id], .selectable-text');
      fallbackElements.forEach(el => {
        const textEl = el.querySelector('.selectable-text, span');
        const text = textEl ? textEl.innerText.trim() : el.innerText.trim();
        const msgId = el.getAttribute('data-id') || 'wa_fallback_' + Math.random().toString(36).substr(2, 9);
        
        if (text && text.length > 1) {
          const isOut = el.classList.contains('message-out') || el.innerHTML.includes('message-out');
          const senderInfo = isOut ? "[Me]: " : "[Partner]: ";
          
          messages.push({
            id: msgId,
            text: `${senderInfo}${text}`,
            media: []
          });
        }
      });
    }
  } else if (url.includes("web.telegram.org")) {
    title = "Telegram Chat";
    const headerTitle = document.querySelector('.chat-info .title, .sidebar-header .title, .top-info .title');
    if (headerTitle) title = `Telegram: ${headerTitle.innerText}`;

    const messageElements = document.querySelectorAll('.message, .bubble-content, .message-content-wrapper');
    messageElements.forEach(el => {
      const msgId = el.getAttribute('data-message-id') || el.getAttribute('data-mid') || 'tg_msg_' + Math.random().toString(36).substr(2, 9);
      const peerNameEl = el.querySelector('.peer-title, .name, .message-title');
      const sender = peerNameEl ? peerNameEl.innerText.trim() : "User";
      
      const textEl = el.querySelector('.text, .message-text, .text-content');
      let text = "";
      if (textEl) {
        text = `[${sender}]: ${textEl.innerText}`;
      } else {
        const fallbackText = el.innerText.trim();
        if (fallbackText) text = fallbackText;
      }
      
      // Сбор картинок в Telegram
      let media = [];
      const imgElements = el.querySelectorAll('img');
      imgElements.forEach(img => {
        if (img.width > 50 && img.height > 50 && !img.src.includes('emoji')) {
          const base64 = getBase64Image(img);
          if (base64) media.push(base64);
        }
      });

      if (text || media.length > 0) {
        messages.push({
          id: msgId,
          text: text,
          media: media
        });
      }
    });
  }

  console.log(`PM Flow Copilot: Extracted ${messages.length} messages.`);
  return {
    title: `${title} - ${new Date().toLocaleTimeString()}`,
    messages: messages // Передаем структурированный список
  };
}

// Отправка в локальный бэкенд
function sendChatData(chatData) {
  const source = window.location.href.includes("telegram.org") ? "telegram" : 
                 window.location.href.includes("whatsapp.com") ? "whatsapp" : "web";

  const payload = {
    source,
    title: chatData.title,
    messages: chatData.messages, // структурированный список сообщений
    content: chatData.text || "" // для совместимости
  };

  fetch("http://localhost:5000/api/ingest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  })
  .then(response => {
    if (!response.ok) throw new Error("HTTP error: " + response.statusText);
    return response.json();
  })
  .then(data => {
    showToast(`Импортировано сообщений: ${data.addedCount || 0}. Дубликаты отсеяны.`);
  })
  .catch(error => {
    console.error("Ingestion failed:", error);
    showToast("Error connecting to server. Is backend running?", false);
  });
}

// Инициализация при загрузке страницы
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initFloatButton();
} else {
  window.addEventListener('DOMContentLoaded', initFloatButton);
}
