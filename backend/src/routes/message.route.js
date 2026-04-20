import express from "express";
import { protectRoute } from "../middleware/auth.missleware.js";
import {
    deleteMessage,
    forwardMessage,
    getMessages,
    getUsersForSidebar,
    markMessagesAsSeen,
    reactToMessage,
    searchUsers,
    sendMessage,
} from "../controllers/message.controller.js";


const router = express.Router();

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/search", protectRoute, searchUsers);
router.get("/:id", protectRoute, getMessages);

router.post("/send/:id", protectRoute, sendMessage);
router.post("/forward/:id", protectRoute, forwardMessage);
router.patch("/seen/:id", protectRoute, markMessagesAsSeen);
router.patch("/:id/reaction", protectRoute, reactToMessage);
router.delete("/:id", protectRoute, deleteMessage);

export default router;
