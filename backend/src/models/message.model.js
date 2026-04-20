import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
    {
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        receiverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        
        text: {
            type: String,
        },

        image: {
            type: String,
        },

        file: {
            url: String,
            name: String,
            type: String,
            size: Number,
        },

        replyTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Message",
        },

        deletedFor: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],

        deletedForEveryone: {
            type: Boolean,
            default: false,
        },

        reactions: [
            {
                userId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                },
                emoji: {
                    type: String,
                    required: true,
                },
            },
        ],

        status: {
            type: String,
            enum: ["sent", "delivered", "seen"],
            default: "sent",
        },

        deliveredAt: {
            type: Date,
        },

        seenAt: {
            type: Date,
        },
    },
    {timestamps: true}
);

const Message = mongoose.model("Message", messageSchema);

export default Message;
