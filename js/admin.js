setupNavigation();

document.getElementById("adminEmail").textContent = localStorage.getItem("ADMIN_EMAIL") || "Admin";

document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("ADMIN_TOKEN");
  localStorage.removeItem("ADMIN_EMAIL");
  window.location.href = "index.html";
});

document.getElementById("loadUsersBtn").addEventListener("click", async () => {
  try {
    const data = await apiRequest("/api/users", {
      headers: getAuthHeaders("ADMIN")
    });

    renderCards("usersList", data, u => `
      <div class="card">
        <h3>User #${u.id}</h3>
        <p>${safe(u.name)} | ${safe(u.email)}</p>
        <div class="meta"><span>Role: ${u.role}</span><span>Active: ${u.active}</span></div>
      </div>
    `);
  } catch (err) {
    showToast(err.message, "error");
  }
});

document.getElementById("deactivateUserBtn").addEventListener("click", async () => {
  try {
    const id = deactivateUserId.value;
    await apiRequest(`/api/users/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders("ADMIN")
    });
    showToast("User deactivated.");
  } catch (err) {
    showToast(err.message, "error");
  }
});

document.getElementById("loadAllQuestionsBtn").addEventListener("click", loadAllQuestions);

async function loadAllQuestions() {
  try {
    const data = await apiRequest("/api/questions/all", {
      headers: getAuthHeaders("ADMIN")
    });

    renderCards("questionsList", data, q => `
      <div class="card">
        <h3>#${q.id} ${safe(q.title)}</h3>
        <div class="meta">
          <span class="badge">${safe(q.topic)}</span>
          <span>Approved: ${q.approved}</span>
          <span>Active: ${q.active}</span>
          <span>Resolved: ${q.resolved}</span>
        </div>
        <p>${safe(q.description)}</p>
      </div>
    `);
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function questionAction(action) {
  try {
    const id = questionActionId.value;
    const method = action === "delete" ? "DELETE" : "PUT";
    const path = action === "delete" ? `/api/questions/${id}` : `/api/questions/${id}/${action}`;

    await apiRequest(path, {
      method,
      headers: getAuthHeaders("ADMIN")
    });

    showToast(`Question ${action} completed.`);
    loadAllQuestions();
  } catch (err) {
    showToast(err.message, "error");
  }
}

approveQuestionBtn.addEventListener("click", () => questionAction("approve"));
rejectQuestionBtn.addEventListener("click", () => questionAction("reject"));
resolveQuestionBtn.addEventListener("click", () => questionAction("resolve"));
deleteQuestionBtn.addEventListener("click", () => questionAction("delete"));

document.getElementById("loadAllAnswersBtn").addEventListener("click", loadAllAnswers);

async function loadAllAnswers() {
  try {
    const data = await apiRequest("/api/answers/all", {
      headers: getAuthHeaders("ADMIN")
    });

    renderCards("answersList", data, a => `
      <div class="card">
        <h3>Answer #${a.id}</h3>
        <div class="meta">
          <span>Question: ${a.questionId}</span>
          <span>User: ${a.userId}</span>
          <span>Approved: ${a.approved}</span>
          <span>Active: ${a.active}</span>
        </div>
        <p>${safe(a.content)}</p>
      </div>
    `);
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function answerAction(action) {
  try {
    const id = answerActionId.value;
    const method = action === "delete" ? "DELETE" : "PUT";
    const path = action === "delete" ? `/api/answers/${id}` : `/api/answers/${id}/${action}`;

    await apiRequest(path, {
      method,
      headers: getAuthHeaders("ADMIN")
    });

    showToast(`Answer ${action} completed.`);
    loadAllAnswers();
  } catch (err) {
    showToast(err.message, "error");
  }
}

approveAnswerBtn.addEventListener("click", () => answerAction("approve"));
rejectAnswerBtn.addEventListener("click", () => answerAction("reject"));
deleteAnswerBtn.addEventListener("click", () => answerAction("delete"));

document.getElementById("loadAdminsBtn").addEventListener("click", async () => {
  try {
    const data = await apiRequest("/api/admins", {
      headers: getAuthHeaders("ADMIN")
    });

    renderCards("adminsList", data, a => `
      <div class="card">
        <h3>Admin #${a.id}</h3>
        <p>${safe(a.name)} | ${safe(a.email)}</p>
        <div class="meta"><span>Role: ${a.role}</span><span>Active: ${a.active}</span></div>
      </div>
    `);
  } catch (err) {
    showToast(err.message, "error");
  }
});

document.getElementById("deactivateAdminBtn").addEventListener("click", async () => {
  try {
    const id = deactivateAdminId.value;
    await apiRequest(`/api/admins/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders("ADMIN")
    });
    showToast("Admin deactivated.");
  } catch (err) {
    showToast(err.message, "error");
  }
});

document.getElementById("loadCommentsBtn").addEventListener("click", async () => {
  try {
    const answerId = commentAnswerId.value;
    const data = await apiRequest(`/api/interactions/comments/answer/${answerId}/all`, {
      headers: getAuthHeaders("ADMIN")
    });

    renderCards("commentsList", data, c => `
      <div class="card">
        <h3>Comment #${c.id}</h3>
        <div class="meta"><span>Answer: ${c.answerId}</span><span>User: ${c.userId}</span><span>Active: ${c.active}</span></div>
        <p>${safe(c.comment)}</p>
      </div>
    `);
  } catch (err) {
    showToast(err.message, "error");
  }
});

document.getElementById("deleteCommentBtn").addEventListener("click", async () => {
  try {
    const id = commentDeleteId.value;
    await apiRequest(`/api/interactions/comments/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders("ADMIN")
    });

    showToast("Comment deactivated.");
  } catch (err) {
    showToast(err.message, "error");
  }
});

document.getElementById("loadUserMessagesBtn").addEventListener("click", async () => {
  try {
    const id = chatUserId.value;
    const data = await apiRequest(`/api/chats/user/${id}`, {
      headers: getAuthHeaders("ADMIN")
    });

    renderCards("chatList", data, m => `
      <div class="card">
        <h3>Message #${m.id}</h3>
        <div class="meta"><span>${m.senderId} → ${m.receiverId}</span><span>Active: ${m.active}</span></div>
        <p>${safe(m.message)}</p>
      </div>
    `);
  } catch (err) {
    showToast(err.message, "error");
  }
});
