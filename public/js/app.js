let appController = null;

const getDrawer = () => document.getElementById("mobile-drawer");
const getChatRoot = () => document.getElementById("ai-chat");
const getChatWindow = () => document.getElementById("ai-chat-window");

const isDrawerOpen = () => {
  const drawer = getDrawer();
  return Boolean(drawer && !drawer.classList.contains("hidden"));
};

const isChatOpen = () => {
  const chatWindow = getChatWindow();
  return Boolean(chatWindow && !chatWindow.classList.contains("hidden"));
};

const syncMobileLayers = () => {
  const chatRoot = getChatRoot();
  if (!chatRoot) {
    return;
  }

  if (isDrawerOpen()) {
    chatRoot.style.pointerEvents = "none";
    chatRoot.style.opacity = "0";
    return;
  }

  chatRoot.style.pointerEvents = "";
  chatRoot.style.opacity = "";
};

const fallbackToggleDrawer = () => {
  const drawer = getDrawer();
  if (drawer) {
    drawer.classList.toggle("hidden");
  }

  syncMobileLayers();
};

const fallbackToggleChat = () => {
  const chatWindow = getChatWindow();
  if (!chatWindow) {
    return;
  }

  const isHidden = chatWindow.classList.contains("hidden");
  if (isHidden) {
    chatWindow.classList.remove("hidden");
    chatWindow.classList.add("flex");
    return;
  }

  chatWindow.classList.add("hidden");
  chatWindow.classList.remove("flex");
};

const closeChatIfOpen = () => {
  if (!isChatOpen()) {
    return;
  }

  if (appController && typeof appController.toggleChat === "function") {
    appController.toggleChat();
    return;
  }

  fallbackToggleChat();
};

window.toggleDrawer = () => {
  const openingDrawer = !isDrawerOpen();
  if (openingDrawer) {
    closeChatIfOpen();
  }

  if (appController && typeof appController.toggleDrawer === "function") {
    appController.toggleDrawer();
  } else {
    fallbackToggleDrawer();
  }

  syncMobileLayers();
};

window.toggleChat = () => {
  if (isDrawerOpen()) {
    window.toggleDrawer();
  }

  if (appController && typeof appController.toggleChat === "function") {
    appController.toggleChat();
  } else {
    fallbackToggleChat();
  }
};

window.sendChat = () => {
  if (appController && typeof appController.sendChat === "function") {
    appController.sendChat();
    return;
  }
};

window.renderMapMarkers = (facilities) => {
  if (appController && typeof appController.renderMapMarkers === "function") {
    appController.renderMapMarkers(facilities);
  }
};

window.navigate = (route) => {
  if (appController && typeof appController.navigate === "function") {
    appController.navigate(route);
    return;
  }

  if (!route) {
    return;
  }

  const target = route.endsWith(".html") ? route : `${route}.html`;
  window.location.href = target;
};

const initApp = async () => {
  const drawer = getDrawer();
  if (drawer) {
    drawer.addEventListener("click", (event) => {
      if (event.target === drawer && isDrawerOpen()) {
        window.toggleDrawer();
      }
    });

    drawer.querySelectorAll("a[href]").forEach((link) => {
      link.addEventListener("click", () => {
        if (isDrawerOpen()) {
          window.toggleDrawer();
        }
      });
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isDrawerOpen()) {
      window.toggleDrawer();
    }
  });

  try {
    const module = await import("./controllers/AppController.js");
    appController = new module.AppController();
    await appController.init();
  } catch (error) {
    console.error("App controller failed to initialize.", error);
    const mapFeedback = document.getElementById("map-feedback");
    if (mapFeedback) {
      mapFeedback.textContent = "Map app failed to initialize. Check internet access for external libraries and refresh the page.";
      mapFeedback.classList.add("text-red-600");
      mapFeedback.classList.remove("text-teal-700");
    }
  }

  syncMobileLayers();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
