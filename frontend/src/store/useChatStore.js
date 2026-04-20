import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios.js";
import { useAuthStore } from "./useAuthStore.js";

const selectedChatKey = (userId) => `misschat:selected-chat:${userId}`;

const getLastMessagePreview = (message) => {
    if(!message) return "";
    if(message.deletedForEveryone) return "This message was deleted";
    if(message.text) return message.text;
    if(message.image) return "Photo";
    if(message.file?.name) return message.file.name;
    return "Message";
};

const getOtherUserFromMessage = (message, authUserId) =>
    message.senderId === authUserId ? message.receiver : message.sender;

const createTempId = () => `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const useChatStore = create((set, get) => ({
    messages: [],
    users: [],
    searchResults: [],
    selectedUser: null,
    replyTo: null,
    unreadCounts: {},
    lastMessages: {},
    isConversationSubscribed: false,
    isUsersLoading: false,
    isSearchingUsers: false,
    isMessagesLoading: false,

    resetChat: ({ clearPersisted = false, userId } = {}) => {
        if(clearPersisted && userId){
            localStorage.removeItem(selectedChatKey(userId));
        }

        set({
            messages: [],
            users: [],
            searchResults: [],
            selectedUser: null,
            replyTo: null,
            unreadCounts: {},
            lastMessages: {},
            isConversationSubscribed: false,
        });
    },

    restoreSelectedUser: (userId) => {
        if(!userId) return;

        const storedUser = localStorage.getItem(selectedChatKey(userId));
        if(!storedUser) return;

        try {
            set({ selectedUser: JSON.parse(storedUser) });
        } catch {
            localStorage.removeItem(selectedChatKey(userId));
        }
    },

    moveUserToTop: (user, lastMessage) => {
        if(!user?._id) return;

        const users = get().users;
        const existingUser = users.find((currentUser) => currentUser._id === user._id);
        const userToMove = {
            ...(existingUser || user),
            ...(lastMessage ? { lastMessage } : {}),
        };

        set({
            users: [userToMove, ...users.filter((currentUser) => currentUser._id !== user._id)],
        });
    },

    getUsers: async () => {
        set({ isUsersLoading: true });
        try {
            const res = await axiosInstance.get("/messages/users");
            const lastMessages = {};

            res.data.forEach((user) => {
                if(user.lastMessage) lastMessages[user._id] = user.lastMessage;
            });

            set({ users: res.data, lastMessages });
        } catch (error) {
            toast.error(error.response?.data?.message || "Could not load chats");
        } finally {
            set({ isUsersLoading: false })
        }
    },

    searchUsers: async (query) => {
        const trimmedQuery = query.trim();

        if(trimmedQuery.length < 2){
            set({ searchResults: [] });
            return;
        }

        set({ isSearchingUsers: true });
        try {
            const res = await axiosInstance.get(`/messages/search?query=${encodeURIComponent(trimmedQuery)}`);
            set({ searchResults: res.data });
        } catch (error) {
            toast.error(error.response?.data?.message || "User search failed");
        } finally {
            set({ isSearchingUsers: false })
        }
    },

    clearSearchResults: () => set({ searchResults: [] }),

    getMessages: async (userId) => {
        set({ isMessagesLoading: true });
        try {
            const res = await axiosInstance.get(`/messages/${userId}`);
            set({
                messages: res.data,
                unreadCounts: {
                    ...get().unreadCounts,
                    [userId]: 0,
                },
            })
            get().markMessagesAsSeen(userId);
        } catch (error) {
            toast.error(error.response?.data?.message || "Could not load messages")
        } finally {
            set({ isMessagesLoading: false })
        }
    },

    sendMessage: async (messageData) => {
        const { selectedUser, messages } = get()
        const authUser = useAuthStore.getState().authUser;
        const tempId = createTempId();
        const tempMessage = {
            _id: tempId,
            senderId: authUser._id,
            receiverId: selectedUser._id,
            text: messageData.text,
            image: messageData.image,
            file: messageData.file
                ? {
                    url: messageData.file.data,
                    name: messageData.file.name,
                    type: messageData.file.type,
                    size: messageData.file.size,
                }
                : undefined,
            replyTo: messageData.replyTo
                ? messages.find((message) => message._id === messageData.replyTo)
                : undefined,
            createdAt: new Date().toISOString(),
            status: "sending",
            uploadProgress: messageData.image || messageData.file ? 1 : 100,
            isOptimistic: true,
        };

        set({
            messages: [...messages, tempMessage],
            lastMessages: {
                ...get().lastMessages,
                [selectedUser._id]: tempMessage,
            },
            replyTo: null,
        });
        get().moveUserToTop(selectedUser, tempMessage);

        try {
            const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData, {
                onUploadProgress: (progressEvent) => {
                    if(!progressEvent.total) return;

                    const progress = Math.min(
                        95,
                        Math.round((progressEvent.loaded * 100) / progressEvent.total)
                    );

                    set({
                        messages: get().messages.map((message) =>
                            message._id === tempId ? { ...message, uploadProgress: progress } : message
                        ),
                    });
                },
            });
            const users = get().users;
            const hasSelectedUser = users.some((user) => user._id === selectedUser._id);

            set({
                messages: get().messages.map((message) =>
                    message._id === tempId ? res.data : message
                ),
                users: hasSelectedUser ? users : [{ ...selectedUser, lastMessage: res.data }, ...users],
                lastMessages: {
                    ...get().lastMessages,
                    [selectedUser._id]: res.data,
                },
            })
            get().moveUserToTop(selectedUser, res.data);
        } catch (error) {
            set({
                messages: get().messages.map((message) =>
                    message._id === tempId
                        ? { ...message, status: "failed", uploadProgress: 0 }
                        : message
                ),
            });
            toast.error(error.response?.data?.message || "Could not send message")
        }
    },

    deleteMessage: async (messageId, scope = "me") => {
        try {
            const res = await axiosInstance.delete(`/messages/${messageId}?scope=${scope}`);

            if(scope === "everyone"){
                set({
                    messages: get().messages.map((message) =>
                        message._id === messageId ? res.data.message : message
                    ),
                });
            } else {
                set({
                    messages: get().messages.filter((message) => message._id !== messageId),
                });
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Could not delete message");
        }
    },

    reactToMessage: async (messageId, emoji = "\u2764\uFE0F") => {
        try {
            const res = await axiosInstance.patch(`/messages/${messageId}/reaction`, { emoji });
            set({
                messages: get().messages.map((message) =>
                    message._id === messageId ? { ...message, reactions: res.data.reactions } : message
                ),
            });
        } catch (error) {
            toast.error(error.response?.data?.message || "Could not react to message");
        }
    },

    forwardMessage: async (messageId, receiver) => {
        try {
            const res = await axiosInstance.post(`/messages/forward/${messageId}`, {
                receiverId: receiver._id,
            });

            get().moveUserToTop(receiver, res.data);

            set({
                lastMessages: {
                    ...get().lastMessages,
                    [receiver._id]: res.data,
                },
            });

            if(get().selectedUser?._id === receiver._id){
                set({ messages: [...get().messages, res.data] });
            }

            toast.success("Message forwarded");
        } catch (error) {
            toast.error(error.response?.data?.message || "Could not forward message");
        }
    },

    subscribeToConversationUpdates: () => {
        const socket = useAuthStore.getState().socket;
        const authUser = useAuthStore.getState().authUser;

        if(!socket || !authUser || get().isConversationSubscribed) return;

        socket.off("newMessage");
        socket.off("messagesSeen");
        socket.off("messageDeleted");
        socket.off("messageReactionUpdated");

        socket.on("newMessage", (newMessage) => {
            const { selectedUser, messages, unreadCounts, lastMessages } = get();
            const otherUser = getOtherUserFromMessage(newMessage, authUser._id);

            if(!otherUser?._id) return;

            const isOpenChat = selectedUser?._id === otherUser._id;

            get().moveUserToTop(otherUser, newMessage);

            set({
                lastMessages: {
                    ...lastMessages,
                    [otherUser._id]: newMessage,
                },
                unreadCounts: {
                    ...unreadCounts,
                    [otherUser._id]: isOpenChat ? 0 : (unreadCounts[otherUser._id] || 0) + 1,
                },
            });

            if(isOpenChat && !messages.some((message) => message._id === newMessage._id)){
                set({ messages: [...get().messages, newMessage] });
                get().markMessagesAsSeen(otherUser._id);
            }
        });

        socket.on("messagesSeen", ({ seenBy, seenAt }) => {
            set({
                messages: get().messages.map((message) =>
                    message.receiverId === seenBy
                        ? { ...message, status: "seen", seenAt }
                        : message
                ),
            });
        });

        socket.on("messageDeleted", ({ messageId, scope, message }) => {
            if(scope === "everyone"){
                set({
                    messages: get().messages.map((currentMessage) =>
                        currentMessage._id === messageId ? message : currentMessage
                    ),
                });
            }
        });

        socket.on("messageReactionUpdated", ({ messageId, reactions }) => {
            set({
                messages: get().messages.map((message) =>
                    message._id === messageId ? { ...message, reactions } : message
                ),
            });
        });

        set({ isConversationSubscribed: true });
    },

    unsubscribeFromConversationUpdates: () => {
        const socket = useAuthStore.getState().socket;

        if(socket){
            socket.off("newMessage");
            socket.off("messagesSeen");
            socket.off("messageDeleted");
            socket.off("messageReactionUpdated");
        }

        set({ isConversationSubscribed: false });
    },

    markMessagesAsSeen: async (chatUserId) => {
        try {
            await axiosInstance.patch(`/messages/seen/${chatUserId}`);
        } catch (error) {
            console.log("Could not mark messages as seen", error);
        }
    },

    setSelectedUser: (selectedUser) => {
        const authUser = useAuthStore.getState().authUser;

        if(authUser?._id && selectedUser){
            localStorage.setItem(selectedChatKey(authUser._id), JSON.stringify(selectedUser));
        } else if(authUser?._id && !selectedUser){
            localStorage.removeItem(selectedChatKey(authUser._id));
        }

        set({
            selectedUser,
            unreadCounts: selectedUser
                ? { ...get().unreadCounts, [selectedUser._id]: 0 }
                : get().unreadCounts,
        });
    },

    setReplyTo: (replyTo) => set({ replyTo }),
    getLastMessagePreview,
}))
