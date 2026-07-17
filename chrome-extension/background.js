chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "sendToPMAssistant",
    title: "Send to PM Assistant",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "sendToPMAssistant" && info.selectionText) {
    const source = tab.url.includes("telegram.org") ? "telegram" : 
                   tab.url.includes("whatsapp.com") ? "whatsapp" : "web";
    
    const payload = {
      source: source,
      title: `${source.toUpperCase()} Chat Selection - ${new Date().toLocaleTimeString()}`,
      content: info.selectionText
    };

    fetch("http://localhost:5000/api/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    })
    .then(response => {
      if (!response.ok) throw new Error("Server error: " + response.statusText);
      return response.json();
    })
    .then(data => {
      // Отправим сообщение в content script, чтобы показать красивый toast
      chrome.tabs.sendMessage(tab.id, { action: "showToast", success: true, message: "Sent successfully to PM Assistant!" });
    })
    .catch(error => {
      console.error("Failed to send to PM Assistant:", error);
      chrome.tabs.sendMessage(tab.id, { action: "showToast", success: false, message: "Error: Cannot reach PM Assistant backend. Make sure the server is running." });
    });
  }
});
