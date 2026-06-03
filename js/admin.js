const adminSession = requireSession("ADMIN");
const adminStats = {
  users: [],
  admins: [],
  questions: [],
  answers: []
};

if (adminSession) {
  setupNavigation();
  bootAdminDashboard();
}

async function bootAdminDashboard() {
  setText("adminEmail", adminSession.email || "Admin");
  bindAdminEvents();

  try {
    await resolveCurrentAccount("ADMIN", true);
  } catch {
    showToast("Admin profile ID could not be resolved yet.", "warning");
  }

  await loadOverview();
}

function bindAdminEvents() {
  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    clearSession("ADMIN");
    window.location.href = "admin-login.html";
  });

  document.getElementById("refreshOverviewBtn")?.addEventListener("click", () => loadOverview());
  document.getElementById("loadQuestionsBtn")?.addEventListener("click", () => loadQuestions());
  document.getElementById("loadAnswersBtn")?.addEventListener("click", () => loadAnswers());
  document.getElementById("loadUsersBtn")?.addEventListener("click", () => loadUsers());
  document.getElementById("loadAdminsBtn")?.addEventListener("click", () => loadAdmins());
  document.getElementById("loadCommentsBtn")?.addEventListener("click", () => loadComments());
  document.getElementById("loadMessagesBtn")?.addEventListener("click", () => loadMessages());

  document.getElementById("questionsList")?.addEventListener("click", handleQuestionClick);
  document.getElementById("answersList")?.addEventListener("click", handleAnswerClick);
  document.getElementById("usersList")?.addEventListener("click", handleUserClick);
  document.getElementById("adminsList")?.addEventListener("click", handleAdminClick);
  document.getElementById("commentsList")?.addEventListener("click", handleCommentClick);

  document.getElementById("questionsList")?.addEventListener("submit", updateQuestion);
  document.getElementById("answersList")?.addEventListener("submit", updateAnswer);
  document.getElementById("usersList")?.addEventListener("submit", updateUser);
  document.getElementById("adminsList")?.addEventListener("submit", updateAdmin);
}

async function loadOverview() {
  try {
    const [users, admins, questions, answers] = await Promise.all([
      apiRequest("/api/users", { headers: getAuthHeaders("ADMIN") }),
      apiRequest("/api/admins", { headers: getAuthHeaders("ADMIN") }),
      apiRequest("/api/questions/all", { headers: getAuthHeaders("ADMIN") }),
      apiRequest("/api/answers/all", { headers: getAuthHeaders("ADMIN") })
    ]);

    updateAdminStats({ users, admins, questions, answers });
    renderOverview({ users, admins, questions, answers });
  } catch (error) {
    showToast(error.message, "error");
  }
}

function updateAdminStats(partial = {}) {
  Object.assign(adminStats, partial);
  updateStat("totalUsers", adminStats.users.length);
  updateStat("totalAdmins", adminStats.admins.length);
  updateStat("pendingQuestions", adminStats.questions.filter(item => item.approved === false && item.active !== false).length);
  updateStat("pendingAnswers", adminStats.answers.filter(item => item.approved === false && item.active !== false).length);
}

function renderOverview({ questions = [], answers = [] }) {
  const pendingQuestions = questions.filter(item => item.approved === false && item.active !== false).slice(0, 5);
  const pendingAnswers = answers.filter(item => item.approved === false && item.active !== false).slice(0, 5);

  document.getElementById("overviewList").innerHTML = `
    <article class="panel-card">
      <h3>Pending Questions</h3>
      ${pendingQuestions.length ? pendingQuestions.map(item => `
        <div class="review-row">
          <span>#${escapeHtml(item.id)} ${escapeHtml(item.title)}</span>
          ${statusBadge(item)}
        </div>
      `).join("") : `<div class="empty-state">No pending questions.</div>`}
    </article>
    <article class="panel-card">
      <h3>Pending Answers</h3>
      ${pendingAnswers.length ? pendingAnswers.map(item => `
        <div class="review-row">
          <span>#${escapeHtml(item.id)} Question #${escapeHtml(item.questionId)}</span>
          ${statusBadge(item)}
        </div>
      `).join("") : `<div class="empty-state">No pending answers.</div>`}
    </article>
  `;
}

async function loadQuestions() {
  try {
    const questions = await apiRequest("/api/questions/all", {
      headers: getAuthHeaders("ADMIN")
    });
    renderCards("questionsList", questions, renderQuestionModerationCard, "No questions found.");
    updateAdminStats({ questions });
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderQuestionModerationCard(question) {
  const id = Number(question.id);
  return `
    <article class="moderation-card">
      <div class="card-topline">
        <span class="topic-chip">${escapeHtml(question.topic)}</span>
        ${statusBadge(question)}
      </div>
      <h3>#${id} ${escapeHtml(question.title)}</h3>
      <p>${escapeHtml(question.description)}</p>
      <div class="meta">
        <span>User #${escapeHtml(question.userId)}</span>
        <span>Active: ${escapeHtml(question.active)}</span>
        <span>Resolved: ${escapeHtml(question.resolved)}</span>
      </div>
      <div class="card-actions">
        <button data-action="approve-question" data-id="${id}" class="success-btn">Approve</button>
        <button data-action="reject-question" data-id="${id}" class="secondary-btn">Reject</button>
        <button data-action="resolve-question" data-id="${id}" class="secondary-btn">Resolve</button>
        <button data-action="delete-question" data-id="${id}" class="danger ghost-btn">Deactivate</button>
      </div>
      <details class="edit-box">
        <summary>Edit question</summary>
        <form class="question-edit-form form-stack" data-id="${id}" data-user-id="${escapeHtml(question.userId)}">
          <input name="title" value="${escapeHtml(question.title)}" placeholder="Title" required />
          <input name="topic" value="${escapeHtml(question.topic)}" placeholder="Topic" required />
          <textarea name="description" required>${escapeHtml(question.description)}</textarea>
          <button type="submit" class="admin-tone">Save Question</button>
        </form>
      </details>
    </article>
  `;
}

async function handleQuestionClick(event) {
  const action = event.target.dataset.action;
  const id = Number(event.target.dataset.id);
  if (!action || !id) return;

  const paths = {
    "approve-question": { method: "PUT", path: `/api/questions/${id}/approve`, message: "Question approved." },
    "reject-question": { method: "PUT", path: `/api/questions/${id}/reject`, message: "Question rejected." },
    "resolve-question": { method: "PUT", path: `/api/questions/${id}/resolve`, message: "Question marked resolved." },
    "delete-question": { method: "DELETE", path: `/api/questions/${id}`, message: "Question deactivated." }
  };

  await runAdminAction(paths[action], loadQuestions);
}

async function updateQuestion(event) {
  if (!event.target.classList.contains("question-edit-form")) return;
  event.preventDefault();

  const form = event.target;
  const id = Number(form.dataset.id);
  await runAdminAction({
    method: "PUT",
    path: `/api/questions/${id}`,
    body: {
      title: form.elements.title.value.trim(),
      topic: form.elements.topic.value.trim(),
      description: form.elements.description.value.trim(),
      userId: Number(form.dataset.userId)
    },
    message: "Question updated."
  }, loadQuestions);
}

async function loadAnswers() {
  try {
    const answers = await apiRequest("/api/answers/all", {
      headers: getAuthHeaders("ADMIN")
    });
    renderCards("answersList", answers, renderAnswerModerationCard, "No answers found.");
    updateAdminStats({ answers });
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderAnswerModerationCard(answer) {
  const id = Number(answer.id);
  return `
    <article class="moderation-card">
      <div class="card-topline">
        <strong>Answer #${id}</strong>
        ${statusBadge(answer)}
      </div>
      <p>${escapeHtml(answer.content)}</p>
      <div class="meta">
        <span>Question #${escapeHtml(answer.questionId)}</span>
        <span>User #${escapeHtml(answer.userId)}</span>
        <span>Active: ${escapeHtml(answer.active)}</span>
      </div>
      <div class="card-actions">
        <button data-action="approve-answer" data-id="${id}" class="success-btn">Approve</button>
        <button data-action="reject-answer" data-id="${id}" class="secondary-btn">Reject</button>
        <button data-action="delete-answer" data-id="${id}" class="danger ghost-btn">Deactivate</button>
      </div>
      <details class="edit-box">
        <summary>Edit answer</summary>
        <form class="answer-edit-form form-stack" data-id="${id}" data-question-id="${escapeHtml(answer.questionId)}" data-user-id="${escapeHtml(answer.userId)}">
          <textarea name="content" required>${escapeHtml(answer.content)}</textarea>
          <button type="submit" class="admin-tone">Save Answer</button>
        </form>
      </details>
    </article>
  `;
}

async function handleAnswerClick(event) {
  const action = event.target.dataset.action;
  const id = Number(event.target.dataset.id);
  if (!action || !id) return;

  const paths = {
    "approve-answer": { method: "PUT", path: `/api/answers/${id}/approve`, message: "Answer approved." },
    "reject-answer": { method: "PUT", path: `/api/answers/${id}/reject`, message: "Answer rejected." },
    "delete-answer": { method: "DELETE", path: `/api/answers/${id}`, message: "Answer deactivated." }
  };

  await runAdminAction(paths[action], loadAnswers);
}

async function updateAnswer(event) {
  if (!event.target.classList.contains("answer-edit-form")) return;
  event.preventDefault();

  const form = event.target;
  const id = Number(form.dataset.id);
  await runAdminAction({
    method: "PUT",
    path: `/api/answers/${id}`,
    body: {
      questionId: Number(form.dataset.questionId),
      userId: Number(form.dataset.userId),
      content: form.elements.content.value.trim()
    },
    message: "Answer updated."
  }, loadAnswers);
}

async function loadUsers() {
  try {
    const users = await apiRequest("/api/users", {
      headers: getAuthHeaders("ADMIN")
    });
    renderCards("usersList", users, user => renderAccountCard(user, "user"), "No users found.");
    updateAdminStats({ users });
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function loadAdmins() {
  try {
    const admins = await apiRequest("/api/admins", {
      headers: getAuthHeaders("ADMIN")
    });
    renderCards("adminsList", admins, admin => renderAccountCard(admin, "admin"), "No admins found.");
    updateAdminStats({ admins });
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderAccountCard(account, type) {
  const id = Number(account.id);
  const isAdmin = type === "admin";
  return `
    <article class="moderation-card">
      <div class="card-topline">
        <strong>#${id} ${accountLabel(account, isAdmin ? "Admin" : "User")}</strong>
        ${statusBadge(account)}
      </div>
      <p>${escapeHtml(account.email)}</p>
      <div class="meta">
        <span>Role: ${escapeHtml(account.role)}</span>
        <span>Created: ${formatDate(account.createdAt)}</span>
      </div>
      <div class="card-actions">
        <button data-action="delete-${type}" data-id="${id}" class="danger ghost-btn">Deactivate</button>
      </div>
      <details class="edit-box">
        <summary>Edit ${isAdmin ? "admin" : "user"}</summary>
        <form class="${type}-edit-form form-stack" data-id="${id}">
          <input name="name" value="${escapeHtml(account.name)}" placeholder="Name" required />
          <input name="email" type="email" value="${escapeHtml(account.email)}" placeholder="Email" required />
          <input name="password" type="password" placeholder="New password required by API" required minlength="6" />
          <button type="submit" class="admin-tone">Save ${isAdmin ? "Admin" : "User"}</button>
        </form>
      </details>
    </article>
  `;
}

async function handleUserClick(event) {
  if (event.target.dataset.action !== "delete-user") return;
  const id = Number(event.target.dataset.id);
  await runAdminAction({
    method: "DELETE",
    path: `/api/users/${id}`,
    message: "User deactivated."
  }, loadUsers);
}

async function handleAdminClick(event) {
  if (event.target.dataset.action !== "delete-admin") return;
  const id = Number(event.target.dataset.id);
  await runAdminAction({
    method: "DELETE",
    path: `/api/admins/${id}`,
    message: "Admin deactivated."
  }, loadAdmins);
}

async function updateUser(event) {
  if (!event.target.classList.contains("user-edit-form")) return;
  event.preventDefault();
  const form = event.target;
  await updateAccount(form, "users", loadUsers);
}

async function updateAdmin(event) {
  if (!event.target.classList.contains("admin-edit-form")) return;
  event.preventDefault();
  const form = event.target;
  await updateAccount(form, "admins", loadAdmins);
}

async function updateAccount(form, resource, reload) {
  const id = Number(form.dataset.id);
  await runAdminAction({
    method: "PUT",
    path: `/api/${resource}/${id}`,
    body: {
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      password: form.elements.password.value
    },
    message: `${resource === "admins" ? "Admin" : "User"} updated.`
  }, reload);
}

async function loadComments() {
  try {
    const answerId = Number(document.getElementById("commentAnswerId").value);
    if (!answerId) throw new Error("Enter an answer ID to load comments.");

    const comments = await apiRequest(`/api/interactions/comments/answer/${answerId}/all`, {
      headers: getAuthHeaders("ADMIN")
    });

    renderCards("commentsList", comments, comment => `
      <article class="moderation-card">
        <div class="card-topline">
          <strong>Comment #${escapeHtml(comment.id)}</strong>
          ${statusBadge(comment)}
        </div>
        <p>${escapeHtml(comment.comment)}</p>
        <div class="meta">
          <span>Answer #${escapeHtml(comment.answerId)}</span>
          <span>User #${escapeHtml(comment.userId)}</span>
        </div>
        <div class="card-actions">
          <button data-action="delete-comment" data-id="${escapeHtml(comment.id)}" class="danger ghost-btn">Deactivate</button>
        </div>
      </article>
    `, "No comments found for this answer.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function handleCommentClick(event) {
  if (event.target.dataset.action !== "delete-comment") return;
  const id = Number(event.target.dataset.id);
  await runAdminAction({
    method: "DELETE",
    path: `/api/interactions/comments/${id}`,
    message: "Comment deactivated."
  }, loadComments);
}

async function loadMessages() {
  try {
    const userId = Number(document.getElementById("chatUserId").value);
    if (!userId) throw new Error("Enter a user ID to load messages.");

    const messages = await apiRequest(`/api/chats/user/${userId}`, {
      headers: getAuthHeaders("ADMIN")
    });

    renderCards("chatList", messages, message => `
      <article class="chat-bubble">
        <div class="meta">
          <span>${escapeHtml(message.senderId)} to ${escapeHtml(message.receiverId)}</span>
          <span>${formatDate(message.createdAt)}</span>
          <span>${getStatusLabel(message)}</span>
        </div>
        <p>${escapeHtml(message.message)}</p>
      </article>
    `, "No messages found for this user.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function runAdminAction(config, reload) {
  if (!config) return;

  try {
    await apiRequest(config.path, {
      method: config.method,
      headers: getAuthHeaders("ADMIN"),
      body: config.body ? JSON.stringify(config.body) : undefined
    });
    showToast(config.message || "Action completed.");
    if (reload) await reload();
    await loadOverview();
  } catch (error) {
    showToast(error.message, "error");
  }
}
