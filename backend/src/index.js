import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import { connectDB } from "./lib/db.js";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import { app, server } from "./lib/socket.js";

dotenv.config();

const PORT = process.env.PORT || 5000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || "50mb";
const allowedOrigins = [
    "http://localhost:5173",
    process.env.CLIENT_URL,
    process.env.RENDER_EXTERNAL_URL,
].filter(Boolean);

app.use(express.json({limit: JSON_BODY_LIMIT}));
app.use(express.urlencoded({extended: true, limit: JSON_BODY_LIMIT}));
app.use(cookieParser());

app.use(cors({
    origin: (origin, callback) => {
        if(!origin || allowedOrigins.includes(origin)){
            return callback(null, true);
        }

        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
}));

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

app.use((err, req, res, next) => {
    if(err.type === "entity.too.large"){
        return res.status(413).json({message: "Attachment is too large. Please send a smaller file."});
    }

    next(err);
});

if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "../../frontend/dist")));

    app.use((req, res) => {
        res.sendFile(path.resolve(__dirname, "../../frontend/dist/index.html"));
    });
}

server.listen(PORT, () => {
    console.log(`Server is running on PORT: ${PORT}`);
    console.log(`JSON body limit: ${JSON_BODY_LIMIT}`);
    connectDB();
});
