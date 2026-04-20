import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef, useState } from "react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils.js";
import { Check, CheckCheck, Copy, Forward, MessageSquareReply, MoreVertical, Smile, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

const MessageStatus = ({ message }) => {
  if(message.status === "sending"){
    return (
      <span className="mt-1 flex items-center justify-end gap-1 text-[11px] opacity-70">
        Sending {message.uploadProgress ? `${message.uploadProgress}%` : ""}
      </span>
    );
  }

  if(message.status === "failed"){
    return <span className="mt-1 text-right text-[11px] text-error">Failed</span>;
  }

  if(message.status === "seen"){
    return (
      <span className="mt-1 flex justify-end text-sky-400">
        <CheckCheck className="size-4" />
      </span>
    );
  }

  if(message.status === "delivered"){
    return (
      <span className="mt-1 flex justify-end opacity-70">
        <CheckCheck className="size-4" />
      </span>
    );
  }

  return (
    <span className="mt-1 flex justify-end opacity-70">
      <Check className="size-4" />
    </span>
  );
};

const MessageActions = ({ message, isOwnMessage, openMenuId, setOpenMenuId }) => {
  const {
    deleteMessage,
    reactToMessage,
    setReplyTo,
    forwardMessage,
    searchUsers,
    searchResults,
    clearSearchResults,
  } = useChatStore();
  const [isForwarding, setIsForwarding] = useState(false);
  const [forwardQuery, setForwardQuery] = useState("");
  const isOpen = openMenuId === message._id;

  useEffect(() => {
    if(!isForwarding) return;

    const timer = setTimeout(() => {
      if(forwardQuery.trim().length >= 2) searchUsers(forwardQuery);
      else clearSearchResults();
    }, 300);

    return () => clearTimeout(timer);
  }, [clearSearchResults, forwardQuery, isForwarding, searchUsers]);

  const copyMessage = async () => {
    if(!message.text) return toast.error("Only text messages can be copied");

    await navigator.clipboard.writeText(message.text);
    toast.success("Message copied");
    setOpenMenuId(null);
  };

  const handleForward = async (user) => {
    await forwardMessage(message._id, user);
    setIsForwarding(false);
    setForwardQuery("");
    clearSearchResults();
  };

  if(message.deletedForEveryone || message.isOptimistic) return null;

  return (
    <div
      className="relative message-actions"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="btn btn-ghost btn-xs"
        onClick={(e) => {
          e.stopPropagation();
          setOpenMenuId(isOpen ? null : message._id);
        }}
      >
        <MoreVertical className="size-4" />
      </button>

      {isOpen && (
        <div className={`absolute z-20 top-8 ${isOwnMessage ? "right-0" : "left-0"} w-52 rounded-lg border border-base-300 bg-base-100 shadow-xl p-2`}>
          <button className="btn btn-ghost btn-sm w-full justify-start" onClick={() => { reactToMessage(message._id); setOpenMenuId(null); }}>
            <Smile className="size-4" /> Like
          </button>
          <button className="btn btn-ghost btn-sm w-full justify-start" onClick={() => { setReplyTo(message); setOpenMenuId(null); }}>
            <MessageSquareReply className="size-4" /> Reply
          </button>
          <button className="btn btn-ghost btn-sm w-full justify-start" onClick={copyMessage}>
            <Copy className="size-4" /> Copy
          </button>
          <button className="btn btn-ghost btn-sm w-full justify-start" onClick={() => setIsForwarding(true)}>
            <Forward className="size-4" /> Forward
          </button>
          <button className="btn btn-ghost btn-sm w-full justify-start text-error" onClick={() => { deleteMessage(message._id, "me"); setOpenMenuId(null); }}>
            <Trash2 className="size-4" /> Delete for me
          </button>
          {isOwnMessage && (
            <button className="btn btn-ghost btn-sm w-full justify-start text-error" onClick={() => { deleteMessage(message._id, "everyone"); setOpenMenuId(null); }}>
              <Trash2 className="size-4" /> Delete everyone
            </button>
          )}
        </div>
      )}

      {isForwarding && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-base-100 rounded-lg border border-base-300 w-full max-w-sm p-4 space-y-3">
            <h3 className="font-semibold">Forward message</h3>
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="Search username or phone"
              value={forwardQuery}
              onChange={(e) => setForwardQuery(e.target.value)}
            />
            <div className="max-h-56 overflow-y-auto">
              {searchResults.map((user) => (
                <button
                  key={user._id}
                  type="button"
                  className="w-full p-2 flex items-center gap-3 hover:bg-base-200 rounded-lg"
                  onClick={() => handleForward(user)}
                >
                  <img src={user.profilePic || "/avatar.png"} alt={user.fullName} className="size-9 rounded-full object-cover" />
                  <div className="text-left">
                    <div className="font-medium">{user.fullName}</div>
                    <div className="text-xs text-base-content/60">@{user.username}</div>
                  </div>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-ghost w-full"
              onClick={() => {
                setIsForwarding(false);
                setForwardQuery("");
                clearSearchResults();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    reactToMessage,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  useEffect(() => {
    getMessages(selectedUser._id);
  }, [selectedUser._id, getMessages]);

  useEffect(() => {
    if (messageEndRef.current && messages) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const startLongPressReaction = (messageId) => {
    if(messageId.startsWith("temp-")) return;

    longPressTimerRef.current = setTimeout(() => {
      reactToMessage(messageId);
    }, 550);
  };

  const clearLongPressReaction = () => {
    if(longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  };

  useEffect(() => {
    const closeOnEscape = (event) => {
      if(event.key === "Escape") setOpenMenuId(null);
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <ChatHeader />

      <div className="flex-1 overflow-y-auto p-4 space-y-4" onClick={() => setOpenMenuId(null)}>
        {messages.map((message) => (
          <div
            key={message._id}
            className={`chat ${message.senderId === authUser._id ? "chat-end" : "chat-start"}`}
            ref={messageEndRef}
            onDoubleClick={() => !message.isOptimistic && reactToMessage(message._id)}
            onMouseDown={() => startLongPressReaction(message._id)}
            onMouseUp={clearLongPressReaction}
            onMouseLeave={clearLongPressReaction}
            onTouchStart={() => startLongPressReaction(message._id)}
            onTouchEnd={clearLongPressReaction}
          >
            <div className=" chat-image avatar">
              <div className="size-10 rounded-full border">
                <img
                  src={
                    message.senderId === authUser._id
                      ? authUser.profilePic || "/avatar.png"
                      : selectedUser.profilePic || "/avatar.png"
                  }
                  alt="profile pic"
                />
              </div>
            </div>
            <div className="chat-header mb-1">
              <time className="text-xs opacity-50 ml-1">
                {formatMessageTime(message.createdAt)}
              </time>
            </div>
            <div className="flex items-start gap-1">
              {message.senderId === authUser._id && (
                <MessageActions
                  message={message}
                  isOwnMessage
                  openMenuId={openMenuId}
                  setOpenMenuId={setOpenMenuId}
                />
              )}
              <div className="chat-bubble flex flex-col relative">
                {message.deletedForEveryone ? (
                  <p className="italic opacity-70">This message was deleted</p>
                ) : (
                  <>
                    {message.replyTo && (
                      <div className="mb-2 rounded bg-base-100/20 border-l-2 border-base-100/60 px-2 py-1 text-xs">
                        {message.replyTo.deletedForEveryone ? "Deleted message" : message.replyTo.text || message.replyTo.file?.name || "Photo"}
                      </div>
                    )}
                    {message.image && (
                      <div className="relative">
                        <img
                          src={message.image}
                          alt="Attachment"
                          className={`sm:max-w-[200px] rounded-md mb-2 ${message.isOptimistic ? "opacity-70" : ""}`}
                        />
                        {message.isOptimistic && (
                          <div className="absolute inset-0 rounded-md bg-black/30 flex items-center justify-center">
                            <span className="loading loading-spinner loading-md text-white" />
                          </div>
                        )}
                      </div>
                    )}
                    {message.file?.url && (
                      message.isOptimistic ? (
                        <div className="mb-2 rounded bg-base-100/20 px-3 py-2">
                          <div className="font-medium">{message.file.name || "Uploading document"}</div>
                          <progress className="progress progress-primary w-full mt-2" value={message.uploadProgress || 1} max="100" />
                        </div>
                      ) : (
                        <a
                          href={message.file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline mb-2"
                        >
                          {message.file.name || "Open attachment"}
                        </a>
                      )
                    )}
                    {message.text && <p>{message.text}</p>}
                    {message.senderId === authUser._id && <MessageStatus message={message} />}
                  </>
                )}
                {message.reactions?.length > 0 && (
                  <div className="absolute -bottom-4 right-2 bg-base-100 text-base-content rounded-full px-2 py-0.5 text-xs shadow">
                    {message.reactions.map((reaction) => reaction.emoji).join(" ")}
                  </div>
                )}
              </div>
              {message.senderId !== authUser._id && (
                <MessageActions
                  message={message}
                  isOwnMessage={false}
                  openMenuId={openMenuId}
                  setOpenMenuId={setOpenMenuId}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <MessageInput />
    </div>
  );
};
export default ChatContainer;
