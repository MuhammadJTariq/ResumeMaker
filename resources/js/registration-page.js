const registrationForm = document.getElementById("registration-form");
const registrationStatus = document.getElementById("registration-status");

if (registrationForm) {
  registrationForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(registrationForm);
    const payload = Object.fromEntries(formData.entries());

    registrationStatus.textContent = "Creating account...";

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed.");
      }

      window.sessionStorage.setItem("resume-maker-session", JSON.stringify(data.user));
      registrationStatus.textContent = `Account created. User ID: ${data.user.userId}`;
      window.location.href = "/";
    } catch (error) {
      registrationStatus.textContent = error.message;
    }
  });
}
