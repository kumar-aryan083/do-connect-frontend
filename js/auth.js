document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".auth-form").forEach(f => f.classList.remove("active"));

    tab.classList.add("active");
    document.getElementById(tab.dataset.target).classList.add("active");
  });
});

function setMessage(message, type = "success") {
  const box = document.getElementById("message");
  box.textContent = message;
  box.className = `message ${type}`;
}

document.getElementById("user-register").addEventListener("submit", async e => {
  e.preventDefault();

  try {
    const data = await apiRequest("/api/users/register", {
      method: "POST",
      body: JSON.stringify({
        name: document.getElementById("userRegisterName").value,
        email: document.getElementById("userRegisterEmail").value,
        password: document.getElementById("userRegisterPassword").value
      })
    });

    setMessage(`User registered successfully. User ID: ${data.id}`);
  } catch (err) {
    setMessage(err.message, "error");
  }
});

document.getElementById("admin-register").addEventListener("submit", async e => {
  e.preventDefault();

  try {
    const data = await apiRequest("/api/admins/register", {
      method: "POST",
      body: JSON.stringify({
        name: document.getElementById("adminRegisterName").value,
        email: document.getElementById("adminRegisterEmail").value,
        password: document.getElementById("adminRegisterPassword").value
      })
    });

    setMessage(`Admin registered successfully. Admin ID: ${data.id}`);
  } catch (err) {
    setMessage(err.message, "error");
  }
});

document.getElementById("user-login").addEventListener("submit", async e => {
  e.preventDefault();

  try {
    const data = await apiRequest("/api/users/login", {
      method: "POST",
      body: JSON.stringify({
        email: document.getElementById("userLoginEmail").value,
        password: document.getElementById("userLoginPassword").value
      })
    });

    localStorage.setItem("USER_TOKEN", data.token);
    localStorage.setItem("USER_EMAIL", data.email);
    localStorage.setItem("USER_ROLE", data.role);

    window.location.href = "user.html";
  } catch (err) {
    setMessage(err.message, "error");
  }
});

document.getElementById("admin-login").addEventListener("submit", async e => {
  e.preventDefault();

  try {
    const data = await apiRequest("/api/admins/login", {
      method: "POST",
      body: JSON.stringify({
        email: document.getElementById("adminLoginEmail").value,
        password: document.getElementById("adminLoginPassword").value
      })
    });

    localStorage.setItem("ADMIN_TOKEN", data.token);
    localStorage.setItem("ADMIN_EMAIL", data.email);
    localStorage.setItem("ADMIN_ROLE", data.role);

    window.location.href = "admin.html";
  } catch (err) {
    setMessage(err.message, "error");
  }
});
