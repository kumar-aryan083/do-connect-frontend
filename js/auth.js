const authForm = document.getElementById("authForm");
const authRole = document.body.dataset.authRole || "USER";
const authMode = document.body.dataset.authMode || "login";
const submitBtn = document.getElementById("submitBtn");

function authEndpoint(role, mode) {
  if (role === "ADMIN") {
    return mode === "login" ? "/api/admins/login" : "/api/admins/register";
  }
  return mode === "login" ? "/api/users/login" : "/api/users/register";
}

function authPayload(mode) {
  const payload = {
    email: document.getElementById("email").value.trim(),
    password: document.getElementById("password").value
  };

  if (mode === "register") {
    payload.name = document.getElementById("name").value.trim();
  }

  return payload;
}

authForm?.addEventListener("submit", async event => {
  event.preventDefault();
  setButtonBusy(submitBtn, true, authMode === "login" ? "Signing in..." : "Creating...");

  try {
    const data = await apiRequest(authEndpoint(authRole, authMode), {
      method: "POST",
      body: JSON.stringify(authPayload(authMode))
    });

    if (authMode === "register") {
      showToast(`${authRole === "ADMIN" ? "Admin" : "User"} registered successfully. You can login now.`);
      window.setTimeout(() => {
        window.location.href = getRoleConfig(authRole).loginPage;
      }, 900);
      return;
    }

    setSession(authRole, data);

    try {
      await resolveCurrentAccount(authRole);
    } catch {
      showToast("Login worked, but profile ID could not be resolved yet.", "warning");
    }

    window.location.href = getRoleConfig(authRole).dashboardPage;
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setButtonBusy(submitBtn, false);
  }
});
