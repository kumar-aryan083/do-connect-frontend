const userSession = requireSession("USER");

if (userSession) {
  setupNavigation();
  bootUserDashboard();
}

async function bootUserDashboard() {
  setText("userEmail", userSession.email || "User");
  bindUserEvents();

  try {
    await resolveCurrentAccount("USER", true);
  } catch {
    showToast("Profile ID could not be resolved. User actions may need backend data loaded first.", "warning");
  }

  await Promise.allSettled([
    loadQuestions(),
    loadUsers(),
    loadProfile(),
    loadAnswerStats()
  ]);
}

function bindUserEvents() {
  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    clearSession("USER");
    window.location.href = "user-login.html";
  });

  document.getElementById("refreshQuestionsBtn")?.addEventListener("click", () => loadQuestions());
  document.getElementById("searchBtn")?.addEventListener("click", () => searchQuestions());
  document.getElementById("loadUsersBtn")?.addEventListener("click", () => loadUsers());
  document.getElementById("loadConversationBtn")?.addEventListener("click", () => loadConversation());
  document.getElementById("reloadProfileBtn")?.addEventListener("click", () => loadProfile(true));

  document.getElementById("questionForm")?.addEventListener("submit", createQuestion);
  document.getElementById("chatForm")?.addEventListener("submit", sendMessage);

  document.getElementById("questionsList")?.addEventListener("click", event => {
    const action = event.target.dataset.action;
    if (action === "load-answers") {
      loadAnswers(Number(event.target.dataset.questionId));
    }
    if (action === "like-answer") {
      likeAnswer(Number(event.target.dataset.answerId), Number(event.target.dataset.questionId));
    }
    if (action === "load-comments") {
      loadComments(Number(event.target.dataset.answerId));
    }
  });

  document.getElementById("questionsList")?.addEventListener("submit", event => {
    if (event.target.classList.contains("answer-form")) {
      submitAnswer(event);
    }
    if (event.target.classList.contains("comment-form")) {
      submitComment(event);
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

async function createQuestion(event) {
  event.preventDefault();
  const button = document.getElementById("askQuestionBtn");
  setButtonBusy(button, true, "Submitting...");

  try {
    const userId = await ensureCurrentUserId();
    const data = await apiRequest("/api/questions", {
      method: "POST",
      headers: getAuthHeaders("USER"),
      body: JSON.stringify({
        title: document.getElementById("questionTitle").value.trim(),
        description: document.getElementById("questionDescription").value.trim(),
        topic: document.getElementById("questionTopic").value.trim(),
        userId
      })
    });

    event.target.reset();
    showToast(`Question submitted for admin approval. ID: ${data.id}`);
    await loadQuestions();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setButtonBusy(button, false);
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

    updateStat("questionCount", questions?.length || 0);
    renderCards("questionsList", questions, renderQuestionCard, "No approved questions are available yet.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function searchQuestions() {
  const keyword = document.getElementById("searchKeyword").value.trim();
  loadQuestions(keyword);
}

function renderQuestionCard(question) {
  const id = Number(question.id);
  return `
    <article class="thread-card">
      <div class="card-topline">
        <span class="topic-chip">${escapeHtml(question.topic)}</span>
        ${statusBadge(question)}
      </div>
      <h3>#${id} ${escapeHtml(question.title)}</h3>
      <p>${escapeHtml(question.description)}</p>
      <div class="meta">
        <span>User #${escapeHtml(question.userId)}</span>
        <span>${question.resolved ? "Closed thread" : "Active thread"}</span>
      </div>
      <div class="card-actions">
        <button class="secondary-btn" data-action="load-answers" data-question-id="${id}">View Answers</button>
      </div>
      <form class="answer-form inline-composer" data-question-id="${id}">
        <textarea name="content" placeholder="Write an answer for this question" required></textarea>
        <button type="submit">Submit Answer</button>
      </form>
      <div id="answers-${id}" class="answers-region"></div>
    </article>
  `;
}

async function submitAnswer(event) {
  event.preventDefault();
  const form = event.target;
  const questionId = Number(form.dataset.questionId);
  const button = form.querySelector("button");
  setButtonBusy(button, true, "Posting...");

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
    showToast(`Answer submitted for admin approval. ID: ${data.id}`);
    await loadAnswers(questionId);
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setButtonBusy(button, false);
  }
}

async function loadAnswers(questionId) {
  const container = document.getElementById(`answers-${questionId}`);
  if (!container) return;
  container.innerHTML = `<div class="empty-state">Loading answers...</div>`;

  try {
    const answers = await apiRequest(`/api/answers/question/${questionId}`, {
      headers: getAuthHeaders("USER")
    });

    const answersWithLikes = await Promise.all((answers || []).map(async answer => {
      try {
        const likes = await apiRequest(`/api/interactions/likes/count/${answer.id}`, {
          headers: getAuthHeaders("USER")
        });
        return { ...answer, likes };
      } catch {
        return { ...answer, likes: 0 };
      }
    }));

    updateStat("answerCount", answersWithLikes.length);

    if (!answersWithLikes.length) {
      container.innerHTML = `<div class="empty-state">No approved answers yet.</div>`;
      return;
    }

    container.innerHTML = answersWithLikes.map(answer => renderAnswerCard(answer, questionId)).join("");
  } catch (error) {
    container.innerHTML = `<div class="empty-state error-text">${escapeHtml(error.message)}</div>`;
  }
}

function renderAnswerCard(answer, questionId) {
  const id = Number(answer.id);
  return `
    <article class="answer-card">
      <div class="card-topline">
        <strong>Answer #${id}</strong>
        ${statusBadge(answer)}
      </div>
      <p>${escapeHtml(answer.content)}</p>
      <div class="meta">
        <span>User #${escapeHtml(answer.userId)}</span>
        <span>${Number(answer.likes || 0)} likes</span>
      </div>
      <div class="card-actions">
        <button class="secondary-btn" data-action="like-answer" data-answer-id="${id}" data-question-id="${questionId}">Like</button>
        <button class="secondary-btn" data-action="load-comments" data-answer-id="${id}">Show Comments</button>
      </div>
      <form class="comment-form inline-composer compact" data-answer-id="${id}" data-question-id="${questionId}">
        <input name="comment" placeholder="Add a comment" required />
        <button type="submit">Comment</button>
      </form>
      <div id="comments-${id}" class="comments-region"></div>
    </article>
  `;
}

async function likeAnswer(answerId, questionId) {
  try {
    const userId = await ensureCurrentUserId();
    await apiRequest("/api/interactions/likes", {
      method: "POST",
      headers: getAuthHeaders("USER"),
      body: JSON.stringify({ answerId, userId })
    });
    showToast("Answer liked.");
    await loadAnswers(questionId);
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function submitComment(event) {
  event.preventDefault();
  const form = event.target;
  const answerId = Number(form.dataset.answerId);
  const button = form.querySelector("button");
  setButtonBusy(button, true, "Adding...");

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
    showToast("Comment added.");
    await loadComments(answerId);
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setButtonBusy(button, false);
  }
}

async function loadComments(answerId) {
  const container = document.getElementById(`comments-${answerId}`);
  if (!container) return;
  container.innerHTML = `<div class="empty-state">Loading comments...</div>`;

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
        <span>User #${escapeHtml(comment.userId)}</span>
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

    updateStat("peopleCount", users?.length || 0);
    renderCards("usersList", users, user => `
      <article class="mini-card">
        <strong>#${escapeHtml(user.id)} ${accountLabel(user, "User")}</strong>
        <span>${escapeHtml(user.email)} - ${getStatusLabel(user)}</span>
      </article>
    `, "No users available.");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function sendMessage(event) {
  event.preventDefault();
  const button = document.getElementById("sendMessageBtn");
  setButtonBusy(button, true, "Sending...");

  try {
    const senderId = await ensureCurrentUserId();
    const receiverId = Number(document.getElementById("receiverId").value);
    await apiRequest("/api/chats", {
      method: "POST",
      headers: getAuthHeaders("USER"),
      body: JSON.stringify({
        senderId,
        receiverId,
        message: document.getElementById("chatMessage").value.trim()
      })
    });

    event.target.reset();
    document.getElementById("conversationUserId").value = receiverId;
    showToast("Message sent.");
    await loadConversation(receiverId);
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setButtonBusy(button, false);
  }
}

async function loadConversation(preselectedUserId) {
  try {
    const userOneId = await ensureCurrentUserId();
    const userTwoId = Number(preselectedUserId || document.getElementById("conversationUserId").value);
    if (!userTwoId) throw new Error("Enter another user ID to load a conversation.");

    const messages = await apiRequest(`/api/chats/conversation?userOneId=${userOneId}&userTwoId=${userTwoId}`, {
      headers: getAuthHeaders("USER")
    });

    renderCards("chatList", messages, message => `
      <article class="chat-bubble ${Number(message.senderId) === Number(userOneId) ? "mine" : ""}">
        <div class="meta">
          <span>${escapeHtml(message.senderId)} to ${escapeHtml(message.receiverId)}</span>
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
  } catch {
    updateStat("answerCount", 0);
  }
}
