export class ChatView {
  constructor(doc = document) {
    this.doc = doc;
    this.isChatOpen = false;
  }

  getMessageContainer() {
    return this.doc.getElementById("chat-messages");
  }

  getInputElement() {
    return this.doc.getElementById("chat-input");
  }

  getSendButton() {
    return this.doc.querySelector('#ai-chat-window form button[type="submit"]');
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
        const input = this.getInputElement();
        if (input) {
          input.focus();
        }
        this.updateSendButtonState();
      }, 100);
      return;
    }

    chatWindow.classList.add("hidden");
    chatWindow.classList.remove("flex");
  }

  getInputMessage() {
    const input = this.getInputElement();
    if (!input) {
      return "";
    }

    return input.value.trim();
  }

  clearInput() {
    const input = this.getInputElement();
    if (input) {
      input.value = "";
    }

    this.updateSendButtonState();
  }

  renderConversation(history = []) {
    const msgContainer = this.getMessageContainer();
    if (!msgContainer) {
      return;
    }

    msgContainer.innerHTML = "";
    history.forEach((entry) => {
      if (!["user", "assistant"].includes(entry?.role) || typeof entry?.content !== "string") {
        return;
      }

      this.appendMessage(entry.role, entry.content, false);
    });

    this.scrollToBottom();
  }

  appendUserMessage(message) {
    this.appendMessage("user", message);
  }

  appendAssistantMessage(message) {
    this.appendMessage("assistant", message);
  }

  appendMessage(role, message, shouldScroll = true) {
    const msgContainer = this.getMessageContainer();
    if (!msgContainer) {
      return;
    }

    const normalizedRole = role === "user" ? "user" : "assistant";
    const text = String(message ?? "").trim();
    if (!text) {
      return;
    }

    const messageRow = this.doc.createElement("div");
    messageRow.className = normalizedRole === "user" ? "flex justify-end" : "flex";

    const bubble = this.doc.createElement("div");
    bubble.className =
      normalizedRole === "user"
        ? "bg-gray-200 text-gray-900 rounded-lg p-3 text-sm max-w-[80%]"
        : "bg-teal-100 text-teal-900 rounded-lg p-3 text-sm max-w-[80%]";
    bubble.textContent = text;

    messageRow.appendChild(bubble);
    msgContainer.appendChild(messageRow);
    if (shouldScroll) {
      this.scrollToBottom();
    }
  }

  showLoading() {
    const msgContainer = this.getMessageContainer();
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

  updateSendButtonState() {
    const sendButton = this.getSendButton();
    if (!sendButton) {
      return;
    }

    const hasMessage = this.getInputMessage().length > 0;
    sendButton.disabled = !hasMessage;
    sendButton.setAttribute("aria-disabled", String(!hasMessage));
  }

  scrollToBottom() {
    const msgContainer = this.getMessageContainer();
    if (!msgContainer) {
      return;
    }

    msgContainer.scrollTop = msgContainer.scrollHeight;
  }
}
