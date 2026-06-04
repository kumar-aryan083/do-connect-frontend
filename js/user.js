const userSession = requireSession("USER");
let userDirectory = [];
let selectedChatUserId = null;

if (userSession) {
  setupNavigation();
  bootUserDashboard();
}

async function bootUserDashboard() {
  setText("userEmail", userSession.email || "User");
  bindUserEvents();

  try {
    await resolveCurrentAccount("USER");
  } catch {
    showToast("Profile ID could not be resolved. User actions may need backend data loaded first.", "warning");
  }

  await loadUsers();
  await Promise.allSettled([
    loadQuestions(),
    loadProfile(),
    loadAnswerStats()
  ]);
}

function bindUserEvents() {
  document.getElementById("logoutBtn")?.addEventListener("click", () => logoutSession("USER"));

  document.getElementById("openQuestionModalBtn")?.addEventListener("click", openQuestionModal);
  document.getElementById("openMessageModalBtn")?.addEventListener("click", () => openMessageModal());
  document.getElementById("refreshQuestionsBtn")?.addEventListener("click", () => loadQuestions());
  document.getElementById("searchBtn")?.addEventListener("click", () => searchQuestions());
  document.getElementById("loadUsersBtn")?.addEventListener("click", () => loadUsers());
  document.getElementById("loadConversationBtn")?.addEventListener("click", () => loadConversation());
  document.getElementById("reloadProfileBtn")?.addEventListener("click", () => loadProfile(true));
  document.getElementById("contactSearch")?.addEventListener("input", renderUserContacts);
  document.getElementById("chatComposerForm")?.addEventListener("submit", sendSelectedMessage);

  document.getElementById("questionsList")?.addEventListener("click", event => {
    const target = event.target.closest("[data-action]");
    const action = target?.dataset.action;
    if (action === "load-answers") {
      toggleAnswers(Number(target.dataset.questionId), target);
    }
    if (action === "submit-answer") {
      openAnswerModal(Number(target.dataset.questionId));
    }
    if (action === "toggle-answer-like") {
      toggleAnswerLike(
        Number(target.dataset.answerId),
        Number(target.dataset.questionId),
        target.dataset.liked === "true"
      );
    }
    if (action === "load-comments") {
      toggleComments(Number(target.dataset.answerId), target);
    }
    if (action === "add-comment") {
      openCommentModal(Number(target.dataset.answerId), Number(target.dataset.questionId));
    }
  });

  document.getElementById("usersList")?.addEventListener("click", event => {
    const target = event.target.closest("[data-action]");
    if (target?.dataset.action === "select-user") {
      selectChatUser(Number(target.dataset.userId));
    }
  });
}

async function ensureCurrentUserId() {
  let id = getCurrentId("USER");
  if (!id) {
    await resolveCurrentAccount("USER", true);
    id = getCurrentId("USER");
  }
  if (!id) throw new Error("Could not resolve your user ID. Please login again after the backend is running.");
  return id;
}

function openQuestionModal() {
  openModal({
    title: "Ask a question",
    eyebrow: "New thread",
    submitText: "Submit for Approval",
    body: `
      <form id="questionModalForm" class="form-stack">
        <label for="modalQuestionTitle">Title</label>
        <input id="modalQuestionTitle" name="title" placeholder="Example: How does JWT validation work?" required />
        <label for="modalQuestionTopic">Topic</label>
        <input id="modalQuestionTopic" name="topic" placeholder="Java, Spring Boot, SQL..." required />
        <label for="modalQuestionDescription">Description</label>
        <textarea id="modalQuestionDescription" name="description" placeholder="Describe your issue clearly for other users." required></textarea>
      </form>
    `,
    onSubmit: createQuestion
  });
}

async function createQuestion(event, modal) {
  event.preventDefault();
  const form = event.target;
  modal?.setBusy(true, "Submitting...");

  try {
    const userId = await ensureCurrentUserId();
    const data = await apiRequest("/api/questions", {
      method: "POST",
      headers: getAuthHeaders("USER"),
      body: JSON.stringify({
        title: form.elements.title.value.trim(),
        description: form.elements.description.value.trim(),
        topic: form.elements.topic.value.trim(),
        userId
      })
    });

    form.reset();
    modal?.setBusy(false);
    modal?.close();
    showToast(`Question submitted for admin approval. ID: ${data.id}`);
    await loadQuestions();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    modal?.setBusy(false);
  }
}

async function loadQuestions(keyword = "") {
  try {
    const path = keyword
      ? `/api/questions/search?keyword=${encodeURIComponent(keyword)}`
      : "/api/questions";
    const questions = await apiRequest(path, {
      headers: getAuthHeaders("USER")
    });
    const questionsWithStats = await hydrateQuestionStats(questions || []);

    updateStat("questionCount", questionsWithStats.length);
    updateStat("sideQuestionCount", questionsWithStats.length);
    renderCards("questionsList", questionsWithStats, renderQuestionCard, "No approved questions are available yet.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function hydrateQuestionStats(questions) {
  return Promise.all((questions || []).map(async question => {
    const answerCount = await getApprovedAnswerCount(Number(question.id));
    return { ...question, answerCount };
  }));
}

async function getApprovedAnswerCount(questionId) {
  if (!questionId) return 0;

  try {
    const answers = await apiRequest(`/api/answers/question/${questionId}`, {
      headers: getAuthHeaders("USER")
    });
    return answers?.length || 0;
  } catch {
    return 0;
  }
}

function searchQuestions() {
  const keyword = document.getElementById("searchKeyword").value.trim();
  loadQuestions(keyword);
}

function renderQuestionCard(question) {
  const id = Number(question.id);
  const answerCount = Number(question.answerCount || question.answersCount || question.totalAnswers || 0);
  const threadState = question.resolved ? "Closed" : "Open";
  return `
    <article class="question-row" data-question-id="${id}">
      <div class="question-stats">
        <div><strong data-question-answer-count>${answerCount}</strong><span>${answerCount === 1 ? "answer" : "answers"}</span></div>
        <div class="${question.resolved ? "resolved-count" : "open-count"}"><strong>${threadState}</strong><span>thread</span></div>
      </div>
      <div class="question-summary">
        <div class="question-title-row">
          <h3>#${id} ${escapeHtml(question.title)}</h3>
          ${statusBadge(question)}
        </div>
        <p>${escapeHtml(question.description)}</p>
        <div class="question-tags">
          <span class="topic-chip">${escapeHtml(question.topic)}</span>
          <span>${userIdentityLabel(question.userId, userDirectory)}</span>
          <span>${question.resolved ? "Closed thread" : "Active thread"}</span>
        </div>
        <div class="card-actions compact-actions">
          <button class="secondary-btn" data-action="load-answers" data-question-id="${id}" data-answers-visible="false">View Answers</button>
          <button data-action="submit-answer" data-question-id="${id}">Submit Answer</button>
        </div>
        <div id="answers-${id}" class="answers-region"></div>
      </div>
    </article>
  `;
}

function openAnswerModal(questionId) {
  if (!questionId) return;
  openModal({
    title: `Answer question #${questionId}`,
    eyebrow: "New answer",
    submitText: "Submit Answer",
    body: `
      <form class="form-stack" data-question-id="${questionId}">
        <label for="modalAnswerContent">Answer</label>
        <textarea id="modalAnswerContent" name="content" placeholder="Write a helpful answer for this question" required></textarea>
      </form>
    `,
    onSubmit: submitAnswer
  });
}

async function submitAnswer(event, modal) {
  event.preventDefault();
  const form = event.target;
  const questionId = Number(form.dataset.questionId);
  modal?.setBusy(true, "Posting...");

  try {
    const userId = await ensureCurrentUserId();
    const data = await apiRequest("/api/answers", {
      method: "POST",
      headers: getAuthHeaders("USER"),
      body: JSON.stringify({
        questionId,
        userId,
        content: form.elements.content.value.trim()
      })
    });

    form.reset();
    modal?.setBusy(false);
    modal?.close();
    showToast(`Answer submitted for admin approval. ID: ${data.id}`);
    await loadAnswers(questionId, getAnswersButton(questionId));
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    modal?.setBusy(false);
  }
}

function getAnswersButton(questionId) {
  return document.querySelector(`[data-action="load-answers"][data-question-id="${questionId}"]`);
}

async function toggleAnswers(questionId, button) {
  const container = document.getElementById(`answers-${questionId}`);
  if (!container) return;

  const isVisible = button?.dataset.answersVisible === "true";
  if (isVisible) {
    container.innerHTML = "";
    container.hidden = true;
    if (button) {
      button.dataset.answersVisible = "false";
      button.textContent = "View Answers";
    }
    return;
  }

  await loadAnswers(questionId, button);
}

async function loadAnswers(questionId, button = getAnswersButton(questionId)) {
  const container = document.getElementById(`answers-${questionId}`);
  if (!container) return;
  container.hidden = false;
  container.innerHTML = `<div class="empty-state">Loading answers...</div>`;

  if (button) {
    button.dataset.answersVisible = "true";
    button.textContent = "Hide Answers";
  }

  try {
    const currentUserId = await ensureCurrentUserId();
    const answers = await apiRequest(`/api/answers/question/${questionId}`, {
      headers: getAuthHeaders("USER")
    });

    const answersWithLikes = await Promise.all((answers || []).map(async answer => {
      try {
        const likes = await apiRequest(`/api/interactions/likes/answer/${answer.id}`, {
          headers: getAuthHeaders("USER")
        });
        return {
          ...answer,
          likes: likes?.length || 0,
          likedByCurrentUser: (likes || []).some(like => Number(like.userId) === Number(currentUserId))
        };
      } catch {
        try {
          const likes = await apiRequest(`/api/interactions/likes/count/${answer.id}`, {
            headers: getAuthHeaders("USER")
          });
          return { ...answer, likes, likedByCurrentUser: false };
        } catch {
          return { ...answer, likes: 0, likedByCurrentUser: false };
        }
      }
    }));

    updateStat("answerCount", answersWithLikes.length);
    updateStat("sideAnswerCount", answersWithLikes.length);
    updateQuestionAnswerCount(questionId, answersWithLikes.length);

    if (!answersWithLikes.length) {
      container.innerHTML = `<div class="empty-state">No approved answers yet.</div>`;
      return;
    }

    container.innerHTML = answersWithLikes.map(answer => renderAnswerCard(answer, questionId)).join("");
  } catch (error) {
    container.innerHTML = `<div class="empty-state error-text">${escapeHtml(error.message)}</div>`;
  }
}

function updateQuestionAnswerCount(questionId, answerCount) {
  const row = document.querySelector(`.question-row[data-question-id="${questionId}"]`);
  const count = row?.querySelector("[data-question-answer-count]");
  const label = count?.nextElementSibling;

  if (count) count.textContent = answerCount;
  if (label) label.textContent = answerCount === 1 ? "answer" : "answers";
}

function renderAnswerCard(answer, questionId) {
  const id = Number(answer.id);
  const liked = answer.likedByCurrentUser === true;
  return `
    <article class="answer-card">
      <div class="card-topline">
        <strong>Answer #${id}</strong>
        ${statusBadge(answer)}
      </div>
      <p>${escapeHtml(answer.content)}</p>
      <div class="meta">
        <span>${userIdentityLabel(answer.userId, userDirectory)}</span>
        <span>${Number(answer.likes || 0)} likes</span>
      </div>
      <div class="card-actions">
        <button class="secondary-btn" data-action="toggle-answer-like" data-answer-id="${id}" data-question-id="${questionId}" data-liked="${liked}">${liked ? "Unlike" : "Like"}</button>
        <button class="secondary-btn" data-action="load-comments" data-answer-id="${id}" data-comments-visible="false">Show Comments</button>
        <button data-action="add-comment" data-answer-id="${id}" data-question-id="${questionId}">Add Comment</button>
      </div>
      <div id="comments-${id}" class="comments-region"></div>
    </article>
  `;
}

async function toggleAnswerLike(answerId, questionId, liked) {
  try {
    const userId = await ensureCurrentUserId();
    if (liked) {
      await apiRequest(`/api/interactions/likes?answerId=${answerId}&userId=${userId}`, {
        method: "DELETE",
        headers: getAuthHeaders("USER")
      });
      showToast("Answer unliked.");
    } else {
      await apiRequest("/api/interactions/likes", {
        method: "POST",
        headers: getAuthHeaders("USER"),
        body: JSON.stringify({ answerId, userId })
      });
      showToast("Answer liked.");
    }
    await loadAnswers(questionId);
  } catch (error) {
    showToast(error.message, "error");
  }
}

function openCommentModal(answerId, questionId) {
  if (!answerId) return;
  openModal({
    title: `Comment on answer #${answerId}`,
    eyebrow: "New comment",
    submitText: "Add Comment",
    body: `
      <form class="form-stack" data-answer-id="${answerId}" data-question-id="${questionId}">
        <label for="modalCommentText">Comment</label>
        <textarea id="modalCommentText" name="comment" placeholder="Add a clear, useful comment" required></textarea>
      </form>
    `,
    onSubmit: submitComment
  });
}

async function submitComment(event, modal) {
  event.preventDefault();
  const form = event.target;
  const answerId = Number(form.dataset.answerId);
  modal?.setBusy(true, "Adding...");

  try {
    const userId = await ensureCurrentUserId();
    await apiRequest("/api/interactions/comments", {
      method: "POST",
      headers: getAuthHeaders("USER"),
      body: JSON.stringify({
        answerId,
        userId,
        comment: form.elements.comment.value.trim()
      })
    });
    form.reset();
    modal?.setBusy(false);
    modal?.close();
    showToast("Comment added.");
    await loadComments(answerId, getCommentsButton(answerId));
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    modal?.setBusy(false);
  }
}

function getCommentsButton(answerId) {
  return document.querySelector(`[data-action="load-comments"][data-answer-id="${answerId}"]`);
}

async function toggleComments(answerId, button) {
  const container = document.getElementById(`comments-${answerId}`);
  if (!container) return;

  const isVisible = button?.dataset.commentsVisible === "true";
  if (isVisible) {
    container.innerHTML = "";
    container.hidden = true;
    if (button) {
      button.dataset.commentsVisible = "false";
      button.textContent = "Show Comments";
    }
    return;
  }

  await loadComments(answerId, button);
}

async function loadComments(answerId, button = getCommentsButton(answerId)) {
  const container = document.getElementById(`comments-${answerId}`);
  if (!container) return;
  container.hidden = false;
  container.innerHTML = `<div class="empty-state">Loading comments...</div>`;

  if (button) {
    button.dataset.commentsVisible = "true";
    button.textContent = "Hide Comments";
  }

  try {
    const comments = await apiRequest(`/api/interactions/comments/answer/${answerId}`, {
      headers: getAuthHeaders("USER")
    });

    if (!comments?.length) {
      container.innerHTML = `<div class="empty-state">No active comments.</div>`;
      return;
    }

    container.innerHTML = comments.map(comment => `
      <div class="comment-row">
        <span>${userIdentityLabel(comment.userId, userDirectory)}</span>
        <p>${escapeHtml(comment.comment)}</p>
      </div>
    `).join("");
  } catch (error) {
    container.innerHTML = `<div class="empty-state error-text">${escapeHtml(error.message)}</div>`;
  }
}

async function loadUsers() {
  try {
    const users = await apiRequest("/api/users", {
      headers: getAuthHeaders("USER")
    });

    userDirectory = users || [];
    updateStat("peopleCount", users?.length || 0);
    renderUserContacts();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderUserContacts() {
  const keyword = document.getElementById("contactSearch")?.value.trim().toLowerCase() || "";
  const currentUserId = getCurrentId("USER");
  const users = userDirectory.filter(user => {
    const isSelf = Number(user.id) === Number(currentUserId);
    const haystack = `${safe(user.id)} ${safe(user.name)} ${safe(user.email)} ${safe(user.role)}`.toLowerCase();
    return !isSelf && (!keyword || haystack.includes(keyword));
  });

  renderCards("usersList", users, renderContactButton, "No users match your search.");
}

function renderContactButton(user) {
  const id = Number(user.id);
  const initial = escapeHtml((user.name || user.email || "U").slice(0, 1).toUpperCase());
  return `
    <button type="button" class="contact-item ${Number(selectedChatUserId) === id ? "active" : ""}" data-action="select-user" data-user-id="${id}">
      <span class="contact-avatar">${initial}</span>
      <span>
        <strong>${accountLabel(user, "User")}</strong>
        <small>User #${id} - ${escapeHtml(user.email)} - ${getStatusLabel(user)}</small>
      </span>
    </button>
  `;
}

function openMessageModal(receiverId = "") {
  openModal({
    title: "Send message",
    eyebrow: "Conversation",
    submitText: "Send Message",
    body: `
      <form class="form-stack">
        <label for="modalReceiverId">Receiver User ID</label>
        <input id="modalReceiverId" name="receiverId" type="number" min="1" value="${escapeHtml(receiverId)}" placeholder="Enter receiver user ID" required />
        <label for="modalChatMessage">Message</label>
        <textarea id="modalChatMessage" name="message" placeholder="Write your message" required></textarea>
      </form>
    `,
    onSubmit: sendMessage
  });
}

async function sendMessage(event, modal) {
  event.preventDefault();
  const form = event.target;
  modal?.setBusy(true, "Sending...");

  try {
    const receiverId = Number(form.elements.receiverId.value);
    await createChatMessage(receiverId, form.elements.message.value.trim());

    form.reset();
    modal?.setBusy(false);
    modal?.close();
    document.getElementById("conversationUserId").value = receiverId;
    showToast("Message sent.");
    await loadConversation(receiverId);
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    modal?.setBusy(false);
  }
}

async function selectChatUser(userId) {
  selectedChatUserId = Number(userId);
  document.getElementById("conversationUserId").value = selectedChatUserId;
  updateConversationHeader();
  updateComposerState();
  renderUserContacts();
  await loadConversation(selectedChatUserId);
}

function updateConversationHeader() {
  const title = selectedChatUserId
    ? userDisplayName(selectedChatUserId, userDirectory)
    : "Choose a user";
  setText("conversationTitle", title);
}

function updateComposerState() {
  const input = document.getElementById("chatComposerInput");
  const button = document.getElementById("sendSelectedMessageBtn");
  const disabled = !selectedChatUserId;
  if (input) input.disabled = disabled;
  if (button) button.disabled = disabled;
}

async function createChatMessage(receiverId, message) {
  const senderId = await ensureCurrentUserId();
  await apiRequest("/api/chats", {
    method: "POST",
    headers: getAuthHeaders("USER"),
    body: JSON.stringify({
      senderId,
      receiverId,
      message
    })
  });
}

async function sendSelectedMessage(event) {
  event.preventDefault();
  if (!selectedChatUserId) {
    showToast("Choose a user before sending a message.", "warning");
    return;
  }

  const form = event.target;
  const input = form.elements.message;
  const button = document.getElementById("sendSelectedMessageBtn");
  setButtonBusy(button, true, "Sending...");

  try {
    await createChatMessage(Number(selectedChatUserId), input.value.trim());
    form.reset();
    showToast("Message sent.");
    await loadConversation(selectedChatUserId);
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setButtonBusy(button, false);
    updateComposerState();
  }
}

async function loadConversation(preselectedUserId) {
  try {
    const userOneId = await ensureCurrentUserId();
    const userTwoId = Number(preselectedUserId || document.getElementById("conversationUserId").value);
    if (!userTwoId) throw new Error("Enter another user ID to load a conversation.");
    selectedChatUserId = userTwoId;
    document.getElementById("conversationUserId").value = userTwoId;
    updateConversationHeader();
    updateComposerState();
    renderUserContacts();

    const messages = await apiRequest(`/api/chats/conversation?userOneId=${userOneId}&userTwoId=${userTwoId}`, {
      headers: getAuthHeaders("USER")
    });

    renderCards("chatList", messages, message => `
      <article class="chat-bubble ${Number(message.senderId) === Number(userOneId) ? "mine" : ""}">
        <div class="meta">
          <span>${Number(message.senderId) === Number(userOneId) ? "You" : userIdentityLabel(message.senderId, userDirectory)}</span>
          <span>${formatDate(message.createdAt)}</span>
        </div>
        <p>${escapeHtml(message.message)}</p>
      </article>
    `, "No messages in this conversation.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function loadProfile(force = false) {
  try {
    const account = await resolveCurrentAccount("USER", force);
    renderCards("profileResult", [account], user => `
      <article class="profile-card">
        <div class="avatar">${escapeHtml((user.name || user.email || "U").slice(0, 1).toUpperCase())}</div>
        <div>
          <h3>${accountLabel(user, "User")}</h3>
          <p>${escapeHtml(user.email)}</p>
          <div class="meta">
            <span>User ID: ${escapeHtml(user.id || "Resolving")}</span>
            <span>Role: ${escapeHtml(user.role || "USER")}</span>
            <span>${getStatusLabel(user)}</span>
          </div>
        </div>
      </article>
    `);
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function loadAnswerStats() {
  try {
    const answers = await apiRequest("/api/answers", {
      headers: getAuthHeaders("USER")
    });
    updateStat("answerCount", answers?.length || 0);
    updateStat("sideAnswerCount", answers?.length || 0);
  } catch {
    updateStat("answerCount", 0);
    updateStat("sideAnswerCount", 0);
  }
}
