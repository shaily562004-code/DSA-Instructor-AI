import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import bcrypt from "bcryptjs";
import session from "express-session";
import { DatabaseSync } from "node:sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = 3000;

app.use(express.json());

// DATABASE SETUP
const db = new DatabaseSync(
    path.join(__dirname, "dsa-instructor.db")
);

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);
// CHAT HISTORY DATABASE TABLES

db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    );
`);

// SESSION SETUP
app.use(session({
    secret: process.env.SESSION_SECRET || "change-this-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// GEMINI SETUP
const ai = process.env.GEMINI_API_KEY
    ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    : null;


// SIGNUP API
app.post("/api/auth/signup", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (
            typeof name !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                error: "Please enter valid details."
            });
        }

        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();

        if (!cleanName || !cleanEmail || password.length < 8) {
            return res.status(400).json({
                error: "Enter your name, email and a password of at least 8 characters."
            });
        }

        const existingUser = db.prepare(
            "SELECT id FROM users WHERE email = ?"
        ).get(cleanEmail);

        if (existingUser) {
            return res.status(409).json({
                error: "An account with this email already exists."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const result = db.prepare(`
            INSERT INTO users (name, email, password)
            VALUES (?, ?, ?)
        `).run(cleanName, cleanEmail, hashedPassword);

        req.session.user = {
            id: Number(result.lastInsertRowid),
            name: cleanName,
            email: cleanEmail
        };

        res.status(201).json({
            message: "Account created successfully!",
            user: req.session.user
        });

    } catch (error) {
        console.error("Signup error:", error);
        res.status(500).json({
            error: "Unable to create account."
        });
    }
});


// LOGIN API
app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (
            typeof email !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                error: "Please enter email and password."
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        const user = db.prepare(
            "SELECT * FROM users WHERE email = ?"
        ).get(cleanEmail);

        if (!user) {
            return res.status(401).json({
                error: "Invalid email or password."
            });
        }

        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                error: "Invalid email or password."
            });
        }

        req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email
        };

        res.json({
            message: "Login successful!",
            user: req.session.user
        });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
            error: "Unable to login."
        });
    }
});


// CHECK CURRENT USER
app.get("/api/auth/me", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({
            error: "Not logged in."
        });
    }

    res.json({ user: req.session.user });
});


// LOGOUT API
app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            return res.status(500).json({
                error: "Logout failed."
            });
        }

        res.clearCookie("connect.sid");

        res.json({
            message: "Logged out successfully."
        });
    });
});
// LOGOUT API

// YAHAN 5 CHAT HISTORY APIs PASTE HONGI


// GEMINI CHAT API


// GEMINI CHAT API
app.post("/api/chat", async (req, res) => {
    const message =
        typeof req.body?.message === "string"
            ? req.body.message.trim()
            : "";

    if (!message) {
        return res.status(400).json({
            error: "Please enter a question."
        });
    }

    if (!ai) {
        return res.status(500).json({
            error: "Gemini API key is missing."
        });
    }

    const history = Array.isArray(req.body.history)
        ? req.body.history
            .filter(turn =>
                turn &&
                ["user", "assistant"].includes(turn.role) &&
                typeof turn.content === "string"
            )
            .slice(-12)
            .map(turn => ({
                role: turn.role === "assistant" ? "model" : "user",
                parts: [{ text: turn.content.slice(0, 4000) }]
            }))
        : [];

    try {
        let result;

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                result = await ai.models.generateContent({
                 model: "gemini-3.1-flash-lite",
                    contents: [
                        ...history,
                        {
                            role: "user",
                            parts: [{ text: message }]
                        }
                    ],
                    config: {
                        systemInstruction:
                            "You are an advanced AI-powered DSA instructor. " +
                            "Explain concepts step by step with examples. " +
                            "Provide correct code, approach, time and space complexity. " +
                            "Support C, C++, Java and Python. " +
                            "Use simple English or Hinglish."
                    }
                });

                break;

            } catch (error) {
                if (
                    ![429, 500, 503].includes(error.status) ||
                    attempt === 3
                ) {
                    throw error;
                }

                console.log(`Retrying Gemini request: ${attempt + 1}`);

                await new Promise(resolve =>
                    setTimeout(resolve, attempt * 3000)
                );
            }
        }

        res.json({ answer: result.text });

    } catch (error) {
        console.error("Gemini request failed:", error);

        res.status(500).json({
            error: error.status === 503
                ? "Gemini is busy. Please try again shortly."
                : error.message || "Gemini API failed."
        });
    }
});


// SERVE FRONTEND
app.use(express.static(__dirname));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

