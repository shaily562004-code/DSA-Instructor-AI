 console.log("NEW DSA.JS LOADED SUCCESSFULLY");
 const userInput = document.getElementById("userInput");
const chatArea = document.getElementById("chatArea");

// Store conversation history
let conversationHistory = [];

let currentConversationId = null;
let isLoggedIn = false;

// ENTER KEY
userInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        handleChat();
    }
});


// MAIN CHAT FUNCTION

// MAIN CHAT FUNCTION
async function handleChat() {

    const message = userInput.value.trim();

    if (message === "") return;

    addMessage(message, "user");

    userInput.value = "";

    showTyping();

    try {

        // Create conversation when logged-in user starts a new chat
        if (isLoggedIn && !currentConversationId) {

            const createResponse = await fetch("/api/conversations", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    title: message.slice(0, 40)
                })
            });

            const created = await createResponse.json();

            if (!createResponse.ok) {
                throw new Error(created.error);
            }

            currentConversationId = created.id;
        }

        // Save user message
        if (isLoggedIn && currentConversationId) {

            await fetch(`/api/conversations/${currentConversationId}/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    role: "user",
                    content: message
                })
            });
        }

        // Send question to Gemini
        const response = await fetch("/api/chat", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                message: message,
                history: conversationHistory
            })

        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "API Error");
        }

        const answer = data.answer;

        addMessage(answer, "bot");

        conversationHistory.push(
            { role: "user", content: message },
            { role: "assistant", content: answer }
        );

        // Save AI answer
        if (isLoggedIn && currentConversationId) {

            await fetch(`/api/conversations/${currentConversationId}/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    role: "assistant",
                    content: answer
                })
            });

            await loadConversations();
        }

    }

    catch (error) {

        console.error("Chat Error:", error);

        addMessage("Sorry! " + error.message, "bot");

    }

    finally {

        removeTyping();

    }

}


// DISPLAY MESSAGE
// DISPLAY MESSAGE WITH CODE HIGHLIGHTING
function addMessage(text, sender) {

    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message");

    const avatar = document.createElement("div");
    avatar.classList.add("avatar");
    avatar.textContent = sender === "user" ? "👤" : "🤖";

    const content = document.createElement("div");
    content.classList.add("message-content");

    messageDiv.classList.add(
        sender === "user" ? "user-message" : "bot-message"
    );

    if (sender === "bot") {

        // Convert Markdown into safe HTML
        content.innerHTML = DOMPurify.sanitize(marked.parse(text));

        // Highlight code and add Copy buttons
        content.querySelectorAll("pre code").forEach((block) => {

            hljs.highlightElement(block);

            const pre = block.parentElement;

            const wrapper = document.createElement("div");
            wrapper.classList.add("code-block");

            pre.parentNode.insertBefore(wrapper, pre);
            wrapper.appendChild(pre);

            const copyButton = document.createElement("button");
            copyButton.classList.add("copy-code-btn");
            copyButton.textContent = "📋 Copy";

            copyButton.addEventListener("click", async () => {
                try {
                    await navigator.clipboard.writeText(block.innerText);

                    copyButton.textContent = "✓ Copied!";

                    setTimeout(() => {
                        copyButton.textContent = "📋 Copy";
                    }, 1500);

                } catch (error) {
                    copyButton.textContent = "Copy failed";
                }
            });

            wrapper.insertBefore(copyButton, pre);
        });

    } else {
        content.textContent = text;
    }

    messageDiv.append(avatar, content);
    chatArea.appendChild(messageDiv);

    chatArea.scrollTop = chatArea.scrollHeight;
}

// TYPING INDICATOR
function showTyping() {

    const typingDiv = document.createElement("div");

    typingDiv.classList.add("message", "bot-message");

    typingDiv.id = "typing";

    typingDiv.innerHTML = `
        <div class="avatar">🤖</div>

        <div class="message-content typing">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
        </div>
    `;

    chatArea.appendChild(typingDiv);

}


// REMOVE TYPING
function removeTyping() {

    const typing = document.getElementById("typing");

    if (typing) {
        typing.remove();
    }

}


// SUGGESTION BUTTON
function sendSuggestion(text) {

    userInput.value = text;

    handleChat();

}


// CLEAR CHAT
// START NEW CHAT
function clearChat() {

    chatArea.innerHTML = "";

    conversationHistory = [];

    currentConversationId = null;

    addMessage(
        "Hello! I'm your AI-powered DSA Instructor. Ask me anything about Data Structures and Algorithms!",
        "bot"
    );

}
// LOGIN AND SIGNUP MODALS

function showLogin() {
    document.getElementById("loginModal").style.display = "flex";
}

function closeSignup() {
    document.getElementById("loginModal").style.display = "none";
}

function showSignup() {
    closeLogin();
    document.getElementById("signupModal").style.display = "flex";
}

function closeSignup() {
    document.getElementById("signupModal").style.display = "none";
}

// SWITCH BETWEEN LOGIN AND SIGNUP

function switchToSignup() {
    closeLogin();
    showSignup();
}

function switchToLogin() {
    closeSignup();
    showLogin();
}
// SIGNUP FUNCTION
async function signupUser(event) {
    event.preventDefault();

    const name = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;

    try {
        const response = await fetch("/api/auth/signup", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error);
            return;
        }

        alert("Account created successfully! Welcome " + data.user.name);

        closeLogin();
updateProfile(data.user);
showLoggedInState(data.user);
    } catch (error) {
        console.error(error);
        alert("Something went wrong. Please try again.");
    }
}


// LOGIN FUNCTION
async function loginUser(event) {
    event.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    try {
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error);
            return;
        }

        alert("Login successful! Welcome " + data.user.name);

       closeLogin();
updateProfile(data.user);
showLoggedInState(data.user);

    } catch (error) {
        console.error(error);
        alert("Something went wrong. Please try again.");
    }
}


// UPDATE PROFILE
function updateProfile(user) {
    const profile = document.getElementById("profileName");

    if (profile) {
        profile.textContent = user.name;
    }
}
// CHECK LOGIN STATUS WHEN PAGE LOADS

async function checkLoginStatus() {
    isLoggedIn = false;
    try {
        const response = await fetch("/api/auth/me");

        if (response.ok) {
            const data = await response.json();
            updateProfile(data.user);
            showLoggedInState(data.user);
        }
    } catch (error) {
        console.error("Session check failed:", error);
    }
}


// SHOW LOGGED-IN USER
function showLoggedInState(user) {

    isLoggedIn = true;

    const authButton = document.querySelector(".login-btn");

    if (authButton) {
        authButton.textContent = "My Account";
        authButton.onclick = showAccountOptions;
    }

    updateProfile(user);

    loadConversations();

}


// ACCOUNT OPTIONS
function showAccountOptions() {
    const choice = confirm(
        "You are logged in.\nClick OK to logout."
    );

    if (choice) {
        logoutUser();
    }
}


// LOGOUT FUNCTION
async function logoutUser() {
    try {
        const response = await fetch("/api/auth/logout", {
            method: "POST"
        });

        if (response.ok) {
            alert("Logged out successfully!");
            window.location.reload();
        }
    } catch (error) {
        console.error(error);
        alert("Logout failed. Please try again.");
    }
}


// RUN WHEN PAGE LOADS
document.addEventListener("DOMContentLoaded", checkLoginStatus);

// LOAD RECENT CHATS
async function loadConversations() {

    if (!isLoggedIn) return;

    try {

        const response = await fetch("/api/conversations");

        if (!response.ok) {
            throw new Error("Unable to load chats");
        }

        const data = await response.json();

        const historyList = document.getElementById("historyList");

        if (!historyList) return;

        historyList.innerHTML = "";

        if (data.conversations.length === 0) {

            historyList.textContent = "No recent chats";

            return;
        }

        data.conversations.forEach(conversation => {

            const item = document.createElement("div");
            item.classList.add("history-item");

            const title = document.createElement("span");

            title.textContent = conversation.title;

            title.style.cursor = "pointer";

            title.addEventListener("click", () => {
                openConversation(conversation.id);
            });

            const deleteButton = document.createElement("button");

            deleteButton.textContent = "🗑️";
            deleteButton.title = "Delete chat";

            deleteButton.addEventListener("click", () => {
                deleteConversation(conversation.id);
            });

            item.append(title, deleteButton);

            historyList.appendChild(item);

        });

    } catch (error) {

        console.error("History Error:", error);

    }

}


// OPEN OLD CONVERSATION
async function openConversation(id) {

    try {

        const response = await fetch(
            `/api/conversations/${id}/messages`
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error);
        }

        currentConversationId = id;

        conversationHistory = [];

        chatArea.innerHTML = "";

        data.messages.forEach(message => {

            const sender = message.role === "user" ? "user" : "bot";

            addMessage(message.content, sender);

            conversationHistory.push({
                role: message.role,
                content: message.content
            });

        });

    } catch (error) {

        console.error(error);

        alert("Unable to open conversation.");

    }

}


// DELETE CONVERSATION
async function deleteConversation(id) {

    if (!confirm("Are you sure you want to delete this chat?")) {
        return;
    }

    try {

        const response = await fetch(`/api/conversations/${id}`, {
            method: "DELETE"
        });

        if (!response.ok) {
            throw new Error("Delete failed");
        }

        if (currentConversationId === id) {
            clearChat();
        }

        await loadConversations();

    } catch (error) {

        console.error(error);

        alert("Unable to delete chat.");

    }

}
// PRACTICE PROBLEMS

let currentProblem = "";

function showPracticeProblems() {
    document.querySelector(".chat-container").style.display = "none";
    document.getElementById("practiceSection").style.display = "block";
}

async function generateProblem() {

    const topic = document.getElementById("practiceTopic").value;
    const difficulty = document.getElementById("practiceDifficulty").value;
    const resultBox = document.getElementById("problemResult");

    resultBox.innerHTML = "<h3>⏳ Generating your problem...</h3>";

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: `Generate one unique ${difficulty} level DSA coding practice problem on ${topic}. Include problem statement, input/output example, constraints, one hint and a detailed solution in separate sections.`,
                history: []
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Unable to generate problem.");
        }

        currentProblem = data.answer;

        resultBox.innerHTML = `
            <div class="problem-content">
                ${DOMPurify.sanitize(marked.parse(currentProblem))}
            </div>
        `;

        resultBox.querySelectorAll("pre code").forEach(block => {
            hljs.highlightElement(block);
        });

    } catch (error) {
        resultBox.innerHTML = `<p>❌ ${error.message}</p>`;
    }
}
async function showHint() {

    if (!currentProblem) {
        alert("Please generate a problem first!");
        return;
    }

    const resultBox = document.getElementById("problemResult");

    const hintBox = document.getElementById("hintResult");

    if (hintBox) {
        hintBox.innerHTML = "<p>⏳ Generating hint...</p>";
    }

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: `Give me only a helpful hint for this DSA problem. Do not reveal the complete solution:\n${currentProblem}`,
                history: []
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Unable to generate hint.");
        }

        let box = document.getElementById("hintResult");

        if (!box) {
            box = document.createElement("div");
            box.id = "hintResult";
            resultBox.appendChild(box);
        }

        box.innerHTML = `
            <h3>💡 Helpful Hint</h3>
            ${DOMPurify.sanitize(marked.parse(data.answer))}
        `;

    } catch (error) {
        alert(error.message);
    }
}
// SHOW DETAILED SOLUTION

async function showSolution() {

    if (!currentProblem) {
        alert("Please generate a problem first!");
        return;
    }

    const resultBox = document.getElementById("problemResult");

    let solutionBox = document.getElementById("solutionResult");

    if (!solutionBox) {
        solutionBox = document.createElement("div");
        solutionBox.id = "solutionResult";
        resultBox.appendChild(solutionBox);
    }

    solutionBox.innerHTML = "<p>⏳ Preparing detailed solution...</p>";

    try {

        const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: `Provide a complete step-by-step solution for this DSA problem.

Include:
1. Explanation of the approach.
2. Algorithm steps.
3. Correct code in C++.
4. Time complexity.
5. Space complexity.

Problem:
${currentProblem}`,
                history: []
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Unable to generate solution.");
        }

        solutionBox.innerHTML = `
            <h3>👨‍💻 Detailed Solution</h3>
            ${DOMPurify.sanitize(marked.parse(data.answer))}
        `;

        solutionBox.querySelectorAll("pre code").forEach(block => {
            hljs.highlightElement(block);
        });

    } catch (error) {

        solutionBox.innerHTML = `<p>❌ ${error.message}</p>`;

    }
}