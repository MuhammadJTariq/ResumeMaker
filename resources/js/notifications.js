const notificationMenu = document.getElementById("dashboard-notification-menu");
const notificationTrigger = document.getElementById("notification-trigger");
const notificationDropdown = document.getElementById("notification-dropdown");
const notificationList = document.getElementById("notification-list");
const notificationCount = document.getElementById("notification-count");
const notificationDot = document.getElementById("notification-dot");

const notificationState = {
  items: [],
  pollTimer: null,
  isOpen: false,
};

function setNotificationMenuOpen(isOpen) {
  if (!notificationDropdown || !notificationTrigger) {
    return;
  }

  notificationState.isOpen = isOpen;
  notificationDropdown.classList.toggle("hidden", !isOpen);
  notificationTrigger.setAttribute("aria-expanded", String(isOpen));
}

function formatNotificationTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function renderNotifications() {
  if (!notificationList || !notificationCount || !notificationDot) {
    return;
  }

  notificationCount.textContent = String(notificationState.items.length);
  notificationDot.classList.toggle("hidden", notificationState.items.length === 0);

  if (!notificationState.items.length) {
    notificationList.innerHTML = '<p class="notification-empty">No open notifications right now.</p>';
    return;
  }

  notificationList.innerHTML = notificationState.items
    .map((item) => {
      const actionMarkup = item.resumeId
        ? `<button class="notification-open-button" type="button" data-resume-id="${item.resumeId}">Open Resume</button>`
        : "";

      return `
        <article class="notification-item" data-notification-id="${item.id}">
          <h3>${item.title}</h3>
          <p>${item.message}</p>
          <div class="notification-item-footer">
            <span class="notification-meta">${formatNotificationTime(item.createdAt)}</span>
            ${actionMarkup}
          </div>
        </article>
      `;
    })
    .join("");

  notificationList.querySelectorAll("[data-resume-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const url = new URL(window.location.href);
      url.pathname = "/";
      url.searchParams.set("resume", button.dataset.resumeId);
      window.location.href = url.toString();
    });
  });
}

async function loadNotifications() {
  if (!notificationList) {
    return;
  }

  try {
    const response = await fetch("/api/notifications", {
      credentials: "same-origin",
    });

    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to load notifications.");
    }

    notificationState.items = Array.isArray(data.items) ? data.items : [];
    renderNotifications();
  } catch (_error) {
    notificationState.items = [];
    renderNotifications();
  }
}

function startNotificationCron() {
  if (!notificationMenu || notificationState.pollTimer) {
    return;
  }

  loadNotifications();
  notificationState.pollTimer = window.setInterval(loadNotifications, 60000);
}

if (notificationTrigger) {
  notificationTrigger.addEventListener("click", () => {
    setNotificationMenuOpen(!notificationState.isOpen);
  });
}

if (notificationMenu) {
  notificationMenu.addEventListener("mouseenter", () => {
    setNotificationMenuOpen(true);
  });

  notificationMenu.addEventListener("mouseleave", () => {
    setNotificationMenuOpen(false);
  });
}

document.addEventListener("click", (event) => {
  if (!notificationMenu || notificationMenu.contains(event.target)) {
    return;
  }

  setNotificationMenuOpen(false);
});

startNotificationCron();
