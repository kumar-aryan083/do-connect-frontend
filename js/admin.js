const adminSession = requireSession("ADMIN");
const adminStats = {
  users: [],
  admins: [],
  questions: [],
  answers: []
};

const adminResourceState = {
  users: { loaded: false, loading: false, error: null },
  admins: { loaded: false, loading: false, error: null },
  questions: { loaded: false, loading: false, error: null },
  answers: { loaded: false, loading: false, error: null }
};

const adminResourceConfig = {
  users: { path: "/api/users", renderer: renderFilteredUsers },
  admins: { path: "/api/admins", renderer: renderFilteredAdmins },
  questions: { path: "/api/questions/all", renderer: renderFilteredQuestions },
  answers: { path: "/api/answers/all", renderer: renderFilteredAnswers }
};

const adminFilterConfig = {
  questions: {
    searchId: "questionAdminSearch",
    statusId: "questionStatusFilter",
    fields: ["id", "title", "topic", "description", "userId"]
  },
  answers: {
    searchId: "answerAdminSearch",
    statusId: "answerStatusFilter",
    fields: ["id", "content", "questionId", "userId"]
  },
  users: {
    searchId: "userAdminSearch",
    statusId: "userStatusFilter",
    fields: ["id", "name", "email", "role"]
  },
  admins: {
    searchId: "adminAdminSearch",
    statusId: "adminStatusFilter",
    fields: ["id", "name", "email", "role"]
  }
};

if (adminSession) {
  setupNavigation();
  bootAdminDashboard();
}

async function bootAdminDashboard() {
  setText("adminEmail", adminSession.email || "Admin");
  bindAdminEvents();

  try {
    await resolveCurrentAccount("ADMIN");
  } catch {
    showToast("Admin profile ID could not be resolved yet.", "warning");
  }

  renderOverview();
  await loadOverview();
}

function bindAdminEvents() {
  document.getElementById("logoutBtn")?.addEventListener("click", () => logoutSession("ADMIN"));

  document.getElementById("refreshOverviewBtn")?.addEventListener("click", () => loadOverview());
  document.getElementById("openAdminQuestionModalBtn")?.addEventListener("click", openAdminQuestionCreateModal);
  document.getElementById("loadQuestionsBtn")?.addEventListener("click", () => loadQuestions());
  document.getElementById("loadAnswersBtn")?.addEventListener("click", () => loadAnswers());
  document.getElementById("openAdminUserModalBtn")?.addEventListener("click", openAdminUserCreateModal);
  document.getElementById("loadUsersBtn")?.addEventListener("click", () => loadUsers());
  document.getElementById("loadAdminsBtn")?.addEventListener("click", () => loadAdmins());
  document.getElementById("loadCommentsBtn")?.addEventListener("click", () => loadComments());
  document.getElementById("loadMessagesBtn")?.addEventListener("click", () => loadMessages());

  document.getElementById("questionsList")?.addEventListener("click", handleQuestionClick);
  document.getElementById("answersList")?.addEventListener("click", handleAnswerClick);
  document.getElementById("usersList")?.addEventListener("click", handleUserClick);
  document.getElementById("adminsList")?.addEventListener("click", handleAdminClick);
  document.getElementById("commentsList")?.addEventListener("click", handleCommentClick);

  bindAdminFilter("questions", renderFilteredQuestions);
  bindAdminFilter("answers", renderFilteredAnswers);
  bindAdminFilter("users", renderFilteredUsers);
  bindAdminFilter("admins", renderFilteredAdmins);

  document.querySelectorAll(".admin-shell .nav-btn").forEach(button => {
    button.addEventListener("click", () => handleAdminSectionOpen(button.dataset.section));
  });
}

async function loadOverview() {
  await refreshAdminData(["admins", "questions", "answers", "users"]);
  renderOverview();
}

async function refreshAdminData(resources) {
  await Promise.all(resources.map(resource => refreshAdminResource(resource)));
  renderOverview();
}

async function refreshAdminResource(resource) {
  const config = adminResourceConfig[resource];
  const state = adminResourceState[resource];
  if (!config || !state) return [];

  state.loading = true;
  state.error = null;
  renderAdminResource(resource);

  try {
    const data = await apiRequest(config.path, {
      headers: getAuthHeaders("ADMIN")
    });
    adminStats[resource] = Array.isArray(data) ? data : [];
    state.loaded = true;
    state.loading = false;
    state.error = null;
  } catch (error) {
    adminStats[resource] = [];
    state.loaded = true;
    state.loading = false;
    state.error = error;

    showToast(error.message, "error");
  }

  updateAdminStats();
  renderAdminResource(resource);
  if (resource === "users") {
    renderNameAwareAdminResources();
  }
  return adminStats[resource];
}

function renderAdminResource(resource) {
  adminResourceConfig[resource]?.renderer?.();
}

function renderNameAwareAdminResources() {
  if (adminResourceState.questions.loaded) renderFilteredQuestions();
  if (adminResourceState.answers.loaded) renderFilteredAnswers();
}

async function ensureAdminUsersLoaded() {
  if (adminResourceState.users.loaded || adminResourceState.users.loading) return;
  await refreshAdminResource("users");
}

function handleAdminSectionOpen(sectionId) {
  const resourceBySection = {
    questionsSection: "questions",
    answersSection: "answers",
    usersSection: "users",
    adminsSection: "admins"
  };
  const resource = resourceBySection[sectionId];
  if (!resource) return;

  renderAdminResource(resource);
  if (!adminResourceState[resource]?.loaded) {
    refreshAdminResource(resource).then(() => renderOverview());
  }
}

function updateAdminStats(partial = {}) {
  Object.assign(adminStats, partial);
  updateStat("totalUsers", adminResourceState.users.error ? "--" : adminStats.users.length);
  updateStat("totalAdmins", adminStats.admins.length);
  updateStat("pendingQuestions", adminStats.questions.filter(isPendingModerationItem).length);
  updateStat("pendingAnswers", adminStats.answers.filter(isPendingModerationItem).length);
}

function renderAdminListState(containerId, resource, loadingText, unavailableText) {
  const container = document.getElementById(containerId);
  const state = adminResourceState[resource];
  if (!container || !state) return false;

  if (state.loading) {
    container.innerHTML = `<div class="empty-state">${escapeHtml(loadingText)}</div>`;
    return true;
  }

  if (state.error) {
    container.innerHTML = `<div class="empty-state error-text">${escapeHtml(state.error.message || unavailableText)}</div>`;
    return true;
  }

  return false;
}

function bindAdminFilter(key, renderer) {
  const config = adminFilterConfig[key];
  if (!config) return;

  document.getElementById(config.searchId)?.addEventListener("input", renderer);
  document.getElementById(config.statusId)?.addEventListener("change", renderer);
}

function getFilteredRecords(key, records) {
  const config = adminFilterConfig[key];
  if (!config) return records || [];

  const keyword = document.getElementById(config.searchId)?.value.trim().toLowerCase() || "";
  const status = document.getElementById(config.statusId)?.value || "all";

  return (records || []).filter(item => {
    return matchesAdminSearch(item, config.fields, keyword) && matchesAdminStatus(item, status);
  });
}

function matchesAdminSearch(item, fields, keyword) {
  if (!keyword) return true;
  const fieldMatch = fields.some(field => safe(item?.[field]).toLowerCase().includes(keyword));
  if (fieldMatch) return true;

  if (item?.userId === undefined || item?.userId === null) return false;
  const user = findUserById(adminStats.users, item.userId);
  const userHaystack = `${safe(user?.name)} ${safe(user?.email)} ${safe(user?.role)} User #${safe(item.userId)}`.toLowerCase();
  return userHaystack.includes(keyword);
}

function matchesAdminStatus(item, status) {
  if (status === "all") return true;
  if (status === "inactive") return item?.active === false;
  if (status === "active") return item?.active !== false;
  if (status === "pending") return isPendingModerationItem(item);
  if (status === "rejected") return item?.rejected === true && item?.active !== false;
  if (status === "approved") return item?.approved === true && item?.resolved !== true && item?.active !== false;
  if (status === "resolved") return item?.resolved === true && item?.active !== false;
  return true;
}

function isPendingModerationItem(item) {
  return item?.approved === false && item?.rejected !== true && item?.active !== false;
}

function renderOverview() {
  const { questions = [], answers = [] } = adminStats;
  const pendingQuestions = questions.filter(isPendingModerationItem).slice(0, 5);
  const pendingAnswers = answers.filter(isPendingModerationItem).slice(0, 5);
  const userState = adminResourceState.users;

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
    ${userState.error ? `
      <article class="panel-card">
        <h3>User Directory</h3>
        <div class="empty-state error-text">${escapeHtml(userState.error.message || "User list is unavailable.")}</div>
      </article>
    ` : ""}
  `;
}

async function loadQuestions() {
  await refreshAdminResource("questions");
  renderOverview();
}

function openAdminQuestionCreateModal() {
  openModal({
    title: "Create question",
    eyebrow: "Question CRUD",
    tone: "admin",
    submitText: "Create Question",
    body: `
      <form class="form-stack">
        <label for="modalQuestionTitle">Title</label>
        <input id="modalQuestionTitle" name="title" placeholder="Title" required />
        <label for="modalQuestionTopic">Topic</label>
        <input id="modalQuestionTopic" name="topic" placeholder="Topic" required />
        <label for="modalQuestionUserId">Owner user ID</label>
        <input id="modalQuestionUserId" name="userId" type="number" min="1" placeholder="User ID" required />
        <label for="modalQuestionDescription">Description</label>
        <textarea id="modalQuestionDescription" name="description" required></textarea>
      </form>
    `,
    onSubmit: createAdminQuestion
  });
}

async function createAdminQuestion(event, modal) {
  event.preventDefault();
  const form = event.target;
  modal?.setBusy(true, "Creating...");

  try {
    await runAdminAction({
      method: "POST",
      path: "/api/questions",
      body: {
        title: form.elements.title.value.trim(),
        topic: form.elements.topic.value.trim(),
        description: form.elements.description.value.trim(),
        userId: Number(form.elements.userId.value)
      },
      message: "Question created."
    }, loadQuestions, { throwOnError: true });
    modal?.setBusy(false);
    modal?.close();
  } catch {
    modal?.setBusy(false);
  }
}

function renderFilteredQuestions() {
  if (renderAdminListState("questionsList", "questions", "Loading questions...", "Questions are unavailable.")) return;
  renderCards(
    "questionsList",
    getFilteredRecords("questions", adminStats.questions),
    renderQuestionModerationCard,
    "No questions match the current filters."
  );
}

function renderQuestionModerationCard(question) {
  const id = Number(question.id);
  const active = question.active !== false;
  const approved = question.approved === true;
  const resolved = question.resolved === true;
  const rejected = question.rejected === true;
  const canApproveReject = active && !approved && !resolved && !rejected;
  const canResolve = active && !resolved && !rejected;

  return `
    <article class="moderation-card">
      <div class="card-topline">
        <span class="topic-chip">${escapeHtml(question.topic)}</span>
        ${statusBadge(question)}
      </div>
      <h3>#${id} ${escapeHtml(question.title)}</h3>
      <p>${escapeHtml(question.description)}</p>
      <div class="meta">
        <span>${userIdentityLabel(question.userId, adminStats.users)}</span>
        <span>Active: ${escapeHtml(question.active)}</span>
        <span>Resolved: ${escapeHtml(question.resolved)}</span>
      </div>
      <div class="card-actions">
        <button data-action="approve-question" data-id="${id}" class="success-btn" ${canApproveReject ? "" : "disabled"}>${approved ? "Approved" : rejected ? "Rejected" : "Approve"}</button>
        <button data-action="reject-question" data-id="${id}" class="secondary-btn" ${canApproveReject ? "" : "disabled"}>${rejected ? "Rejected" : "Reject"}</button>
        <button data-action="resolve-question" data-id="${id}" class="secondary-btn" ${canResolve ? "" : "disabled"}>${resolved ? "Resolved" : "Resolve"}</button>
        <button data-action="edit-question" data-id="${id}" class="secondary-btn">Edit</button>
        ${active
          ? `<button data-action="delete-question" data-id="${id}" class="danger ghost-btn">Deactivate</button>`
          : `<button data-action="activate-question" data-id="${id}" class="success-btn">Reactivate</button>`}
      </div>
    </article>
  `;
}

async function handleQuestionClick(event) {
  const target = event.target.closest("[data-action]");
  const action = target?.dataset.action;
  const id = Number(target?.dataset.id);
  if (!action || !id) return;

  const paths = {
    "approve-question": { method: "PUT", path: `/api/questions/${id}/approve`, message: "Question approved." },
    "reject-question": { method: "PUT", path: `/api/questions/${id}/reject`, message: "Question rejected." },
    "resolve-question": { method: "PUT", path: `/api/questions/${id}/resolve`, message: "Question marked resolved." },
    "delete-question": { method: "DELETE", path: `/api/questions/${id}`, message: "Question deactivated." },
    "activate-question": { method: "PUT", path: `/api/questions/${id}/activate`, message: "Question reactivated." }
  };

  if (action === "edit-question") {
    openQuestionEditModal(adminStats.questions.find(question => Number(question.id) === id));
    return;
  }

  if (action === "delete-question") {
    confirmAdminAction({
      title: `Deactivate question #${id}`,
      message: "Deactivate this question and hide it from active workspaces?",
      config: paths[action],
      reload: loadQuestions
    });
    return;
  }

  if (action === "activate-question") {
    await runAdminAction(paths[action], loadQuestions);
    return;
  }

  if (action === "reject-question" || action === "resolve-question") {
    confirmAdminAction({
      title: action === "reject-question" ? `Reject question #${id}` : `Resolve question #${id}`,
      message: action === "reject-question"
        ? "Reject this question from the moderation queue?"
        : "Mark this question as resolved?",
      config: paths[action],
      reload: loadQuestions,
      danger: false,
      confirmText: action === "reject-question" ? "Reject Question" : "Mark Resolved"
    });
    return;
  }

  await runAdminAction(paths[action], loadQuestions);
}

function openQuestionEditModal(question) {
  if (!question) return;
  const id = Number(question.id);
  openModal({
    title: `Edit question #${id}`,
    eyebrow: "Question CRUD",
    tone: "admin",
    submitText: "Save Question",
    body: `
      <form class="form-stack" data-id="${id}" data-user-id="${escapeHtml(question.userId)}">
        <label for="modalQuestionTitle">Title</label>
        <input id="modalQuestionTitle" name="title" value="${escapeHtml(question.title)}" placeholder="Title" required />
        <label for="modalQuestionTopic">Topic</label>
        <input id="modalQuestionTopic" name="topic" value="${escapeHtml(question.topic)}" placeholder="Topic" required />
        <label for="modalQuestionDescription">Description</label>
        <textarea id="modalQuestionDescription" name="description" required>${escapeHtml(question.description)}</textarea>
      </form>
    `,
    onSubmit: updateQuestion
  });
}

async function updateQuestion(event, modal) {
  event.preventDefault();

  const form = event.target;
  const id = Number(form.dataset.id);
  modal?.setBusy(true, "Saving...");
  try {
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
    }, loadQuestions, { throwOnError: true });
    modal?.setBusy(false);
    modal?.close();
  } catch {
    modal?.setBusy(false);
  }
}

async function loadAnswers() {
  await refreshAdminResource("answers");
  renderOverview();
}

function renderFilteredAnswers() {
  if (renderAdminListState("answersList", "answers", "Loading answers...", "Answers are unavailable.")) return;
  renderCards(
    "answersList",
    getFilteredRecords("answers", adminStats.answers),
    renderAnswerModerationCard,
    "No answers match the current filters."
  );
}

function renderAnswerModerationCard(answer) {
  const id = Number(answer.id);
  const active = answer.active !== false;
  const approved = answer.approved === true;
  const rejected = answer.rejected === true;
  const canApproveReject = active && !approved && !rejected;

  return `
    <article class="moderation-card">
      <div class="card-topline">
        <strong>Answer #${id}</strong>
        ${statusBadge(answer)}
      </div>
      <p>${escapeHtml(answer.content)}</p>
      <div class="meta">
        <span>Question #${escapeHtml(answer.questionId)}</span>
        <span>${userIdentityLabel(answer.userId, adminStats.users)}</span>
        <span>Active: ${escapeHtml(answer.active)}</span>
      </div>
      <div class="card-actions">
        <button data-action="approve-answer" data-id="${id}" class="success-btn" ${canApproveReject ? "" : "disabled"}>${approved ? "Approved" : rejected ? "Rejected" : "Approve"}</button>
        <button data-action="reject-answer" data-id="${id}" class="secondary-btn" ${canApproveReject ? "" : "disabled"}>${rejected ? "Rejected" : "Reject"}</button>
        <button data-action="edit-answer" data-id="${id}" class="secondary-btn">Edit</button>
        ${active
          ? `<button data-action="delete-answer" data-id="${id}" class="danger ghost-btn">Deactivate</button>`
          : `<button data-action="activate-answer" data-id="${id}" class="success-btn">Reactivate</button>`}
      </div>
    </article>
  `;
}

async function handleAnswerClick(event) {
  const target = event.target.closest("[data-action]");
  const action = target?.dataset.action;
  const id = Number(target?.dataset.id);
  if (!action || !id) return;

  const paths = {
    "approve-answer": { method: "PUT", path: `/api/answers/${id}/approve`, message: "Answer approved." },
    "reject-answer": { method: "PUT", path: `/api/answers/${id}/reject`, message: "Answer rejected." },
    "delete-answer": { method: "DELETE", path: `/api/answers/${id}`, message: "Answer deactivated." },
    "activate-answer": { method: "PUT", path: `/api/answers/${id}/activate`, message: "Answer reactivated." }
  };

  if (action === "edit-answer") {
    openAnswerEditModal(adminStats.answers.find(answer => Number(answer.id) === id));
    return;
  }

  if (action === "delete-answer") {
    confirmAdminAction({
      title: `Deactivate answer #${id}`,
      message: "Deactivate this answer and hide it from active answer lists?",
      config: paths[action],
      reload: loadAnswers
    });
    return;
  }

  if (action === "activate-answer") {
    await runAdminAction(paths[action], loadAnswers);
    return;
  }

  if (action === "reject-answer") {
    confirmAdminAction({
      title: `Reject answer #${id}`,
      message: "Reject this answer from the moderation queue?",
      config: paths[action],
      reload: loadAnswers,
      danger: false,
      confirmText: "Reject Answer"
    });
    return;
  }

  await runAdminAction(paths[action], loadAnswers);
}

function openAnswerEditModal(answer) {
  if (!answer) return;
  const id = Number(answer.id);
  openModal({
    title: `Edit answer #${id}`,
    eyebrow: "Answer moderation",
    tone: "admin",
    submitText: "Save Answer",
    body: `
      <form class="form-stack" data-id="${id}" data-question-id="${escapeHtml(answer.questionId)}" data-user-id="${escapeHtml(answer.userId)}">
        <label for="modalAnswerContent">Answer</label>
        <textarea id="modalAnswerContent" name="content" required>${escapeHtml(answer.content)}</textarea>
      </form>
    `,
    onSubmit: updateAnswer
  });
}

async function updateAnswer(event, modal) {
  event.preventDefault();

  const form = event.target;
  const id = Number(form.dataset.id);
  modal?.setBusy(true, "Saving...");
  try {
    await runAdminAction({
      method: "PUT",
      path: `/api/answers/${id}`,
      body: {
        questionId: Number(form.dataset.questionId),
        userId: Number(form.dataset.userId),
        content: form.elements.content.value.trim()
      },
      message: "Answer updated."
    }, loadAnswers, { throwOnError: true });
    modal?.setBusy(false);
    modal?.close();
  } catch {
    modal?.setBusy(false);
  }
}

async function loadUsers() {
  await refreshAdminResource("users");
  renderOverview();
}

function openAdminUserCreateModal() {
  openModal({
    title: "Create user",
    eyebrow: "User CRUD",
    tone: "admin",
    submitText: "Create User",
    body: `
      <form class="form-stack">
        <label for="modalAccountName">Name</label>
        <input id="modalAccountName" name="name" placeholder="Name" required />
        <label for="modalAccountEmail">Email</label>
        <input id="modalAccountEmail" name="email" type="email" placeholder="user@example.com" required />
        <label for="modalAccountPassword">Password</label>
        <input id="modalAccountPassword" name="password" type="password" placeholder="At least 6 characters" required minlength="6" />
      </form>
    `,
    onSubmit: createAdminUser
  });
}

async function createAdminUser(event, modal) {
  event.preventDefault();
  const form = event.target;
  modal?.setBusy(true, "Creating...");

  try {
    await runAdminAction({
      method: "POST",
      path: "/api/users/register",
      body: {
        name: form.elements.name.value.trim(),
        email: form.elements.email.value.trim(),
        password: form.elements.password.value
      },
      message: "User created."
    }, loadUsers, { throwOnError: true });
    modal?.setBusy(false);
    modal?.close();
  } catch {
    modal?.setBusy(false);
  }
}

async function loadAdmins() {
  await refreshAdminResource("admins");
  renderOverview();
}

function renderFilteredUsers() {
  if (renderAdminListState("usersList", "users", "Loading users...", "User list is not available for this admin account.")) return;
  renderCards(
    "usersList",
    getFilteredRecords("users", adminStats.users),
    user => renderAccountCard(user, "user"),
    "No users match the current filters."
  );
}

function renderFilteredAdmins() {
  if (renderAdminListState("adminsList", "admins", "Loading admins...", "Admins are unavailable.")) return;
  renderCards(
    "adminsList",
    getFilteredRecords("admins", adminStats.admins),
    admin => renderAccountCard(admin, "admin"),
    "No admins match the current filters."
  );
}

function renderAccountCard(account, type) {
  const id = Number(account.id);
  const isAdmin = type === "admin";
  const active = account.active !== false;

  return `
    <article class="moderation-card">
      <div class="card-topline">
        <strong>${accountLabel(account, isAdmin ? "Admin" : "User")}</strong>
        ${statusBadge(account)}
      </div>
      <p>${escapeHtml(account.email)}</p>
      <div class="meta">
        <span>${isAdmin ? "Admin" : "User"} #${id}</span>
        <span>Role: ${escapeHtml(account.role)}</span>
        <span>Created: ${formatDate(account.createdAt)}</span>
      </div>
      <div class="card-actions">
        <button data-action="edit-${type}" data-id="${id}" class="secondary-btn">Edit</button>
        ${active
          ? `<button data-action="delete-${type}" data-id="${id}" class="danger ghost-btn">Deactivate</button>`
          : `<button data-action="activate-${type}" data-id="${id}" class="success-btn">Reactivate</button>`}
      </div>
    </article>
  `;
}

async function handleUserClick(event) {
  const target = event.target.closest("[data-action]");
  const action = target?.dataset.action;
  const id = Number(target?.dataset.id);
  if (!action || !id) return;

  if (action === "edit-user") {
    openAccountEditModal(adminStats.users.find(user => Number(user.id) === id), "user");
    return;
  }

  if (action === "delete-user") {
    confirmAdminAction({
      title: `Deactivate user #${id}`,
      message: "Deactivate this user account?",
      config: {
        method: "DELETE",
        path: `/api/users/${id}`,
        message: "User deactivated."
      },
      reload: loadUsers
    });
  }

  if (action === "activate-user") {
    await runAdminAction({
      method: "PUT",
      path: `/api/users/${id}/activate`,
      message: "User reactivated."
    }, loadUsers);
  }
}

async function handleAdminClick(event) {
  const target = event.target.closest("[data-action]");
  const action = target?.dataset.action;
  const id = Number(target?.dataset.id);
  if (!action || !id) return;

  if (action === "edit-admin") {
    openAccountEditModal(adminStats.admins.find(admin => Number(admin.id) === id), "admin");
    return;
  }

  if (action === "delete-admin") {
    confirmAdminAction({
      title: `Deactivate admin #${id}`,
      message: "Deactivate this admin account?",
      config: {
        method: "DELETE",
        path: `/api/admins/${id}`,
        message: "Admin deactivated."
      },
      reload: loadAdmins
    });
  }

  if (action === "activate-admin") {
    await runAdminAction({
      method: "PUT",
      path: `/api/admins/${id}/activate`,
      message: "Admin reactivated."
    }, loadAdmins);
  }
}

function openAccountEditModal(account, type) {
  if (!account) return;
  const isAdmin = type === "admin";
  const id = Number(account.id);
  openModal({
    title: `Edit ${isAdmin ? "admin" : "user"} #${id}`,
    eyebrow: isAdmin ? "Admin CRUD" : "User CRUD",
    tone: "admin",
    submitText: `Save ${isAdmin ? "Admin" : "User"}`,
    body: `
      <form class="form-stack" data-id="${id}" data-resource="${isAdmin ? "admins" : "users"}">
        <label for="modalAccountName">Name</label>
        <input id="modalAccountName" name="name" value="${escapeHtml(account.name)}" placeholder="Name" required />
        <label for="modalAccountEmail">Email</label>
        <input id="modalAccountEmail" name="email" type="email" value="${escapeHtml(account.email)}" placeholder="Email" required />
        <label for="modalAccountPassword">New password</label>
        <input id="modalAccountPassword" name="password" type="password" placeholder="Leave blank to keep current password" minlength="6" />
      </form>
    `,
    onSubmit: updateAccount
  });
}

async function updateAccount(event, modal) {
  event.preventDefault();
  const form = event.target;
  const id = Number(form.dataset.id);
  const resource = form.dataset.resource;
  const body = {
    name: form.elements.name.value.trim(),
    email: form.elements.email.value.trim()
  };

  if (form.elements.password.value) {
    body.password = form.elements.password.value;
  }

  modal?.setBusy(true, "Saving...");
  try {
    await runAdminAction({
      method: "PUT",
      path: `/api/${resource}/${id}`,
      body,
      message: `${resource === "admins" ? "Admin" : "User"} updated.`
    }, resource === "admins" ? loadAdmins : loadUsers, { throwOnError: true });
    modal?.setBusy(false);
    modal?.close();
  } catch {
    modal?.setBusy(false);
  }
}

async function loadComments() {
  try {
    await ensureAdminUsersLoaded();
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
          <span>${userIdentityLabel(comment.userId, adminStats.users)}</span>
        </div>
        <div class="card-actions">
          ${comment.active !== false
            ? `<button data-action="delete-comment" data-id="${escapeHtml(comment.id)}" class="danger ghost-btn">Deactivate</button>`
            : `<button data-action="activate-comment" data-id="${escapeHtml(comment.id)}" class="success-btn">Reactivate</button>`}
        </div>
      </article>
    `, "No comments found for this answer.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function handleCommentClick(event) {
  const target = event.target.closest("[data-action]");
  const action = target?.dataset.action;
  if (action !== "delete-comment" && action !== "activate-comment") return;
  const id = Number(target.dataset.id);

  if (action === "activate-comment") {
    await runAdminAction({
      method: "PUT",
      path: `/api/interactions/comments/${id}/activate`,
      message: "Comment reactivated."
    }, loadComments);
    return;
  }

  confirmAdminAction({
    title: `Deactivate comment #${id}`,
    message: "Deactivate this comment and remove it from active comment lists?",
    config: {
      method: "DELETE",
      path: `/api/interactions/comments/${id}`,
      message: "Comment deactivated."
    },
    reload: loadComments
  });
}

async function loadMessages() {
  try {
    await ensureAdminUsersLoaded();
    const userId = Number(document.getElementById("chatUserId").value);
    if (!userId) throw new Error("Enter a user ID to load messages.");

    const messages = await apiRequest(`/api/chats/user/${userId}`, {
      headers: getAuthHeaders("ADMIN")
    });

    renderCards("chatList", messages, message => `
      <article class="chat-bubble">
        <div class="meta">
          <span>${userIdentityLabel(message.senderId, adminStats.users)} to ${userIdentityLabel(message.receiverId, adminStats.users)}</span>
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

async function runAdminAction(config, reload, options = {}) {
  if (!config) return;

  try {
    await apiRequest(config.path, {
      method: config.method,
      headers: getAuthHeaders("ADMIN"),
      body: config.body ? JSON.stringify(config.body) : undefined
    });
    showToast(config.message || "Action completed.");
    if (reload) await reload();
    return true;
  } catch (error) {
    showToast(error.message, "error");
    error.toastShown = true;
    if (options.throwOnError) throw error;
    return false;
  }
}

function confirmAdminAction({ title, message, config, reload, danger = true, confirmText = "Deactivate" }) {
  openConfirmModal({
    title,
    eyebrow: danger ? "Destructive action" : "Confirm action",
    message,
    confirmText,
    busyText: "Working...",
    danger,
    tone: "admin",
    onConfirm: () => runAdminAction(config, reload, { throwOnError: true })
  });
}
