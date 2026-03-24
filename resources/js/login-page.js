const loginForm = document.getElementById("login-form");
const loginStatus = document.getElementById("login-status");

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(loginForm);
    const payload = Object.fromEntries(formData.entries());

    loginStatus.textContent = "Signing in...";

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed.");
      }

      loginStatus.textContent = `Welcome back, ${data.user.firstName} ${data.user.lastName}.`;
      window.sessionStorage.setItem("resume-maker-session", JSON.stringify(data.user));
      window.location.href = "/";
    } catch (error) {
      loginStatus.textContent = error.message;
    }
  });
}
