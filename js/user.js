setupNavigation();

document.getElementById("userEmail").textContent = localStorage.getItem("USER_EMAIL") || "User";

document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("USER_TOKEN");
  localStorage.removeItem("USER_EMAIL");
  window.location.href = "index.html";
});

document.getElementById("questionForm").addEventListener("submit", async e => {
  e.preventDefault();

  try {
    const data = await apiRequest("/api/questions", {
      method: "POST",
      headers: getAuthHeaders("USER"),
      body: JSON.stringify({
        title: questionTitle.value,
        description: questionDescription.value,
        topic: questionTopic.value,
        userId: Number(questionUserId.value)
      })
    });

    showToast(`Question submitted. Waiting for admin approval. ID: ${data.id}`);
    e.target.reset();
  } catch (err) {
    showToast(err.message, "error");
  }
});

document.getElementById("loadQuestionsBtn").addEventListener("click", loadQuestions);

async function loadQuestions() {
  try {
    const data = await apiRequest("/api/questions", {
      headers: getAuthHeaders("USER")
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

document.getElementById("searchBtn").addEventListener("click", async () => {
  try {
    const keyword = document.getElementById("searchKeyword").value;
    const data = await apiRequest(`/api/questions/search?keyword=${encodeURIComponent(keyword)}`, {
      headers: getAuthHeaders("USER")
    });

    renderCards("questionsList", data, q => `
      <div class="card">
        <h3>#${q.id} ${safe(q.title)}</h3>
        <div class="meta"><span class="badge">${safe(q.topic)}</span></div>
        <p>${safe(q.description)}</p>
      </div>
    `);
  } catch (err) {
    showToast(err.message, "error");
  }
});

document.getElementById("answerForm").addEventListener("submit", async e => {
  e.preventDefault();

  try {
    const data = await apiRequest("/api/answers", {
      method: "POST",
      headers: getAuthHeaders("USER"),
      body: JSON.stringify({
        questionId: Number(answerQuestionId.value),
        userId: Number(answerUserId.value),
        content: answerContent.value
      })
    });

    showToast(`Answer submitted. Waiting for approval. ID: ${data.id}`);
    e.target.reset();
  } catch (err) {
    showToast(err.message, "error");
  }
});

document.getElementById("loadAnswersBtn").addEventListener("click", async () => {
  try {
    const questionId = document.getElementById("answersQuestionId").value;
    const data = await apiRequest(`/api/answers/question/${questionId}`, {
      headers: getAuthHeaders("USER")
    });

    renderCards("answersList", data, a => `
      <div class="card">
        <h3>Answer #${a.id}</h3>
        <div class="meta">
          <span>Question: ${a.questionId}</span>
          <span>User: ${a.userId}</span>
          <span>Approved: ${a.approved}</span>
        </div>
        <p>${safe(a.content)}</p>
      </div>
    `);
  } catch (err) {
    showToast(err.message, "error");
  }
});

document.getElementById("likeForm").addEventListener("submit", async e => {
  e.preventDefault();

  try {
    await apiRequest("/api/interactions/likes", {
      method: "POST",
      headers: getAuthHeaders("USER"),
      body: JSON.stringify({
        answerId: Number(likeAnswerId.value),
        userId: Number(likeUserId.value)
      })
    });

    showToast("Answer liked successfully.");
    e.target.reset();
  } catch (err) {
    showToast(err.message, "error");
  }
});

document.getElementById("commentForm").addEventListener("submit", async e => {
  e.preventDefault();

  try {
    const data = await apiRequest("/api/interactions/comments", {
      method: "POST",
      headers: getAuthHeaders("USER"),
      body: JSON.stringify({
        answerId: Number(commentAnswerId.value),
        userId: Number(commentUserId.value),
        comment: commentText.value
      })
    });

    showToast(`Comment added. ID: ${data.id}`);
    e.target.reset();
  } catch (err) {
    showToast(err.message, "error");
  }
});

document.getElementById("loadCommentsBtn").addEventListener("click", async () => {
  try {
    const answerId = document.getElementById("commentsAnswerId").value;
    const data = await apiRequest(`/api/interactions/comments/answer/${answerId}`, {
      headers: getAuthHeaders("USER")
    });

    renderCards("commentsList", data, c => `
      <div class="card">
        <h3>Comment #${c.id}</h3>
        <div class="meta"><span>User: ${c.userId}</span><span>Answer: ${c.answerId}</span></div>
        <p>${safe(c.comment)}</p>
      </div>
    `);
  } catch (err) {
    showToast(err.message, "error");
  }
});

document.getElementById("chatForm").addEventListener("submit", async e => {
  e.preventDefault();

  try {
    const data = await apiRequest("/api/chats", {
      method: "POST",
      headers: getAuthHeaders("USER"),
      body: JSON.stringify({
        senderId: Number(senderId.value),
        receiverId: Number(receiverId.value),
        message: chatMessage.value
      })
    });

    showToast(`Message sent. ID: ${data.id}`);
    e.target.reset();
  } catch (err) {
    showToast(err.message, "error");
  }
});

document.getElementById("loadConversationBtn").addEventListener("click", async () => {
  try {
    const userOne = document.getElementById("convUserOne").value;
    const userTwo = document.getElementById("convUserTwo").value;

    const data = await apiRequest(`/api/chats/conversation?userOneId=${userOne}&userTwoId=${userTwo}`, {
      headers: getAuthHeaders("USER")
    });

    renderCards("chatList", data, m => `
      <div class="card">
        <h3>Message #${m.id}</h3>
        <div class="meta"><span>${m.senderId} → ${m.receiverId}</span><span>${safe(m.createdAt)}</span></div>
        <p>${safe(m.message)}</p>
      </div>
    `);
  } catch (err) {
    showToast(err.message, "error");
  }
});

document.getElementById("loadProfileBtn").addEventListener("click", async () => {
  try {
    const id = document.getElementById("profileUserId").value;
    const data = await apiRequest(`/api/users/${id}`, {
      headers: getAuthHeaders("USER")
    });

    renderCards("profileResult", [data], u => `
      <div class="card">
        <h3>User #${u.id}</h3>
        <p>Name: ${safe(u.name)}</p>
        <p>Email: ${safe(u.email)}</p>
        <p>Role: ${safe(u.role)}</p>
        <p>Active: ${u.active}</p>
      </div>
    `);
  } catch (err) {
    showToast(err.message, "error");
  }
});

document.getElementById("loadAllUsersBtn").addEventListener("click", async () => {
  try {
    const data = await apiRequest("/api/users", {
      headers: getAuthHeaders("USER")
    });

    renderCards("profileResult", data, u => `
      <div class="card">
        <h3>User #${u.id}</h3>
        <p>${safe(u.name)} | ${safe(u.email)} | Active: ${u.active}</p>
      </div>
    `);
  } catch (err) {
    showToast(err.message, "error");
  }
});
