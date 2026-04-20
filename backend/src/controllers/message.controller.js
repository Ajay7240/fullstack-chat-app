import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";

const getPublicUser = (user) => ({
    _id: user._id,
    fullName: user.fullName,
    username: user.username,
    phoneNumber: user.phoneNumber,
    profilePic: user.profilePic,
});

const isMessageParticipant = (message, userId) =>
    message.senderId.equals(userId) || message.receiverId.equals(userId);

export const getUsersForSidebar = async (req, res) => {
    try {
        const loggedInUserId = req.user._id;
        const conversations = await Message.find({
            deletedFor: {$ne: loggedInUserId},
            $or: [
                {senderId: loggedInUserId},
                {receiverId: loggedInUserId},
            ],
        }).select("senderId receiverId text image file deletedForEveryone createdAt");

        const latestByUserId = new Map();

        conversations.forEach((message) => {
            const otherUserId = message.senderId.equals(loggedInUserId)
                ? message.receiverId.toString()
                : message.senderId.toString();

            const existingMessage = latestByUserId.get(otherUserId);

            if(!existingMessage || message.createdAt > existingMessage.createdAt){
                latestByUserId.set(otherUserId, message);
            }
        });

        const userIds = [...latestByUserId.keys()];
        const users = await User.find({
            _id: {$in: userIds},
            isVerified: {$ne: false},
        }).select("-password");

        const sortedUsers = users.sort((a, b) => {
            const latestA = latestByUserId.get(a._id.toString())?.createdAt || 0;
            const latestB = latestByUserId.get(b._id.toString())?.createdAt || 0;
            return latestB - latestA;
        }).map((user) => ({
            ...user.toObject(),
            lastMessage: latestByUserId.get(user._id.toString()),
        }));

        res.status(200).json(sortedUsers);
    } catch (error) {
        console.error("Error in getUserForSidebar: ", error.message);
        res.status(500).json({message: "Internal server error"});
    }
}

export const searchUsers = async (req, res) => {
    try {
        const loggedInUserId = req.user._id;
        const query = (req.query.query || "").trim();

        if(query.length < 2){
            return res.status(200).json([]);
        }

        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const phoneQuery = query.replace(/\s+/g, "");

        const users = await User.find({
            _id: {$ne: loggedInUserId},
            isVerified: {$ne: false},
            $or: [
                {username: {$regex: escapedQuery.toLowerCase(), $options: "i"}},
                {phoneNumber: {$regex: escapedQuery, $options: "i"}},
                {phoneNumber: {$regex: phoneQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i"}},
            ],
        })
            .select("-password")
            .limit(10);

        res.status(200).json(users);
    } catch (error) {
        console.error("Error in searchUsers: ", error.message);
        res.status(500).json({message: "Internal server error"});
    }
}

export const getMessages = async (req, res) => {
    try {
        const {id: userToChatId} = req.params;
        const myId = req.user._id;

        const messages = await Message.find({
            deletedFor: {$ne: myId},
            $or: [
                {senderId: myId, receiverId: userToChatId},
                {senderId: userToChatId, receiverId: myId}
            ]
        }).populate("replyTo", "text image file senderId deletedForEveryone")

        const seenAt = new Date();
        const seenResult = await Message.updateMany(
            {
                senderId: userToChatId,
                receiverId: myId,
                status: {$ne: "seen"},
                deletedFor: {$ne: myId},
            },
            {
                $set: {
                    status: "seen",
                    seenAt,
                    deliveredAt: seenAt,
                },
            }
        );

        if(seenResult.modifiedCount > 0){
            const senderSocketId = getReceiverSocketId(userToChatId);

            if(senderSocketId){
                io.to(senderSocketId).emit("messagesSeen", {
                    seenBy: myId,
                    chatWith: userToChatId,
                    seenAt,
                });
            }
        }

        res.status(200).json(messages);
    } catch (error) {
        console.log("Error in getMessages controller ", error.message);
        res.status(500).json({error: "Internal server error" });
    }
}

export const sendMessage = async (req, res) => {
    try {
        const {text, image, file, replyTo} = req.body;
        const { id: receiverId} = req.params;
        const senderId = req.user._id;

        if(senderId.equals(receiverId)){
            return res.status(400).json({message: "You cannot send a message to yourself"});
        }

        const receiver = await User.findOne({_id: receiverId, isVerified: {$ne: false}});

        if(!receiver){
            return res.status(404).json({message: "User not found or not verified"});
        }

        let imageUrl;
        if(image){
            // Upload base64 image to cloudinary
            const uploadResponse = await cloudinary.uploader.upload(image);
            imageUrl = uploadResponse.secure_url;
        }

        let uploadedFile;
        if(file?.data){
            const uploadResponse = await cloudinary.uploader.upload(file.data, {
                resource_type: "auto",
                folder: "misschat-attachments",
            });

            uploadedFile = {
                url: uploadResponse.secure_url,
                name: file.name,
                type: file.type,
                size: file.size,
            };
        }

        const receiverSocketId = getReceiverSocketId(receiverId);
        const deliveredAt = receiverSocketId ? new Date() : undefined;

        const newMessage = new Message({
            senderId,
            receiverId,
            text,
            image: imageUrl,
            file: uploadedFile,
            replyTo: replyTo || undefined,
            status: receiverSocketId ? "delivered" : "sent",
            deliveredAt,
        });

        await newMessage.save();
        await newMessage.populate("replyTo", "text image file senderId deletedForEveryone");

        const messagePayload = {
            ...newMessage.toObject(),
            sender: getPublicUser(req.user),
            receiver: getPublicUser(receiver),
        };

        if(receiverSocketId) {
            io.to(receiverSocketId).emit("newMessage", messagePayload)
        }

        res.status(201).json(messagePayload);
    } catch (error) {
        console.log("Error in sendMessage controller: ", error.message);
        res.status(500).json({message: "Internal server error"});
    }
}

export const markMessagesAsSeen = async (req, res) => {
    try {
        const {id: chatUserId} = req.params;
        const myId = req.user._id;
        const seenAt = new Date();

        const result = await Message.updateMany(
            {
                senderId: chatUserId,
                receiverId: myId,
                status: {$ne: "seen"},
                deletedFor: {$ne: myId},
            },
            {
                $set: {
                    status: "seen",
                    seenAt,
                    deliveredAt: seenAt,
                },
            }
        );

        if(result.modifiedCount > 0){
            const senderSocketId = getReceiverSocketId(chatUserId);

            if(senderSocketId){
                io.to(senderSocketId).emit("messagesSeen", {
                    seenBy: myId,
                    chatWith: chatUserId,
                    seenAt,
                });
            }
        }

        res.status(200).json({message: "Messages marked as seen", seenAt});
    } catch (error) {
        console.log("Error in markMessagesAsSeen controller: ", error.message);
        res.status(500).json({message: "Internal server error"});
    }
}

export const deleteMessage = async (req, res) => {
    try {
        const {id: messageId} = req.params;
        const {scope = "me"} = req.query;
        const userId = req.user._id;

        const message = await Message.findById(messageId);

        if(!message || !isMessageParticipant(message, userId)){
            return res.status(404).json({message: "Message not found"});
        }

        if(scope === "everyone"){
            if(!message.senderId.equals(userId)){
                return res.status(403).json({message: "Only the sender can delete this message for everyone"});
            }

            message.text = "";
            message.image = "";
            message.file = undefined;
            message.deletedForEveryone = true;
        } else if(!message.deletedFor.some((deletedUserId) => deletedUserId.equals(userId))){
            message.deletedFor.push(userId);
        }

        await message.save();

        const payload = {
            messageId: message._id,
            scope,
            deletedBy: userId,
            message,
        };

        if(scope === "everyone"){
            const receiverSocketId = getReceiverSocketId(message.receiverId.toString());
            const senderSocketId = getReceiverSocketId(message.senderId.toString());

            if(receiverSocketId) io.to(receiverSocketId).emit("messageDeleted", payload);
            if(senderSocketId) io.to(senderSocketId).emit("messageDeleted", payload);
        }

        res.status(200).json(payload);
    } catch (error) {
        console.log("Error in deleteMessage controller: ", error.message);
        res.status(500).json({message: "Internal server error"});
    }
}

export const reactToMessage = async (req, res) => {
    try {
        const {id: messageId} = req.params;
        const {emoji = "❤️"} = req.body;
        const userId = req.user._id;

        const message = await Message.findById(messageId);

        if(!message || !isMessageParticipant(message, userId)){
            return res.status(404).json({message: "Message not found"});
        }

        const existingReaction = message.reactions.find((reaction) => reaction.userId.equals(userId));

        if(existingReaction?.emoji === emoji){
            message.reactions = message.reactions.filter((reaction) => !reaction.userId.equals(userId));
        } else if(existingReaction){
            existingReaction.emoji = emoji;
        } else {
            message.reactions.push({userId, emoji});
        }

        await message.save();

        const payload = {
            messageId: message._id,
            reactions: message.reactions,
        };
        const receiverSocketId = getReceiverSocketId(message.receiverId.toString());
        const senderSocketId = getReceiverSocketId(message.senderId.toString());

        if(receiverSocketId) io.to(receiverSocketId).emit("messageReactionUpdated", payload);
        if(senderSocketId) io.to(senderSocketId).emit("messageReactionUpdated", payload);

        res.status(200).json(payload);
    } catch (error) {
        console.log("Error in reactToMessage controller: ", error.message);
        res.status(500).json({message: "Internal server error"});
    }
}

export const forwardMessage = async (req, res) => {
    try {
        const {id: messageId} = req.params;
        const {receiverId} = req.body;
        const senderId = req.user._id;

        const originalMessage = await Message.findById(messageId);
        const receiver = await User.findOne({_id: receiverId, isVerified: {$ne: false}});

        if(!originalMessage || !isMessageParticipant(originalMessage, senderId)){
            return res.status(404).json({message: "Message not found"});
        }

        if(!receiver || senderId.equals(receiverId)){
            return res.status(404).json({message: "User not found or not verified"});
        }

        if(originalMessage.deletedForEveryone){
            return res.status(400).json({message: "Deleted messages cannot be forwarded"});
        }

        const forwardedMessage = await Message.create({
            senderId,
            receiverId,
            text: originalMessage.text,
            image: originalMessage.image,
            file: originalMessage.file,
        });

        const messagePayload = {
            ...forwardedMessage.toObject(),
            sender: getPublicUser(req.user),
            receiver: getPublicUser(receiver),
        };
        const receiverSocketId = getReceiverSocketId(receiverId);

        if(receiverSocketId) {
            io.to(receiverSocketId).emit("newMessage", messagePayload);
        }

        res.status(201).json(messagePayload);
    } catch (error) {
        console.log("Error in forwardMessage controller: ", error.message);
        res.status(500).json({message: "Internal server error"});
    }
}
