export class ChatView {
  constructor(doc = document) {
    this.doc = doc;
    this.isChatOpen = false;
  }

  toggleChat() {
    const chatWindow = this.doc.getElementById("ai-chat-window");
    if (!chatWindow) {
      return;
    }

    this.isChatOpen = !this.isChatOpen;

    if (this.isChatOpen) {
      chatWindow.classList.remove("hidden");
      chatWindow.classList.add("flex");
      setTimeout(() => {
        const input = this.doc.getElementById("chat-input");
        if (input) {
          input.focus();
        }
      }, 100);
      return;
    }

    chatWindow.classList.add("hidden");
    chatWindow.classList.remove("flex");
  }

  getInputMessage() {
    const input = this.doc.getElementById("chat-input");
    if (!input) {
      return "";
    }

    return input.value.trim();
  }

  clearInput() {
    const input = this.doc.getElementById("chat-input");
    if (input) {
      input.value = "";
    }
  }

  appendUserMessage(message) {
    const msgContainer = this.doc.getElementById("chat-messages");
    if (!msgContainer) {
      return;
    }

    const userDiv = this.doc.createElement("div");
    userDiv.className = "flex justify-end";
    userDiv.innerHTML = `<div class="bg-gray-200 text-gray-900 rounded-lg p-3 text-sm max-w-[80%]">${message}</div>`;
    msgContainer.appendChild(userDiv);
    this.scrollToBottom();
  }

  showLoading() {
    const msgContainer = this.doc.getElementById("chat-messages");
    if (!msgContainer) {
      return null;
    }

    const loadingDiv = this.doc.createElement("div");
    loadingDiv.className = "flex loading-indicator";
    loadingDiv.id = "chat-loading";
    loadingDiv.innerHTML = `<div class="bg-teal-100 text-teal-900 rounded-lg p-3 text-sm max-w-[80%]"><i class="fas fa-circle-notch fa-spin"></i> Processing...</div>`;
    msgContainer.appendChild(loadingDiv);
    this.scrollToBottom();

    return loadingDiv;
  }

  hideLoading(loadingElement) {
    if (loadingElement) {
      loadingElement.remove();
    }
  }

  appendAssistantMessage(message) {
    const msgContainer = this.doc.getElementById("chat-messages");
    if (!msgContainer) {
      return;
    }

    const aiDiv = this.doc.createElement("div");
    aiDiv.className = "flex";
    aiDiv.innerHTML = `<div class="bg-teal-100 text-teal-900 rounded-lg p-3 text-sm max-w-[80%]">${message}</div>`;
    msgContainer.appendChild(aiDiv);
    this.scrollToBottom();
  }

  scrollToBottom() {
    const msgContainer = this.doc.getElementById("chat-messages");
    if (!msgContainer) {
      return;
    }

    msgContainer.scrollTop = msgContainer.scrollHeight;
  }
}
