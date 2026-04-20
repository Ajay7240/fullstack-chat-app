import { useEffect, useMemo, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { Search, Users } from "lucide-react";

const Sidebar = () => {
  const {
    getUsers,
    users,
    unreadCounts,
    lastMessages,
    getLastMessagePreview,
    searchUsers,
    searchResults,
    clearSearchResults,
    selectedUser,
    setSelectedUser,
    isUsersLoading,
    isSearchingUsers,
  } = useChatStore();

  const { onlineUsers } = useAuthStore();
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    getUsers();
  }, [getUsers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if(searchQuery.trim().length >= 2){
        searchUsers(searchQuery);
      } else {
        clearSearchResults();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers, clearSearchResults]);

  const filteredUsers = useMemo(() => {
    return showOnlineOnly
      ? users.filter((user) => onlineUsers.includes(user._id))
      : users;
  }, [onlineUsers, showOnlineOnly, users]);

  const visibleUsers = searchQuery.trim().length >= 2 ? searchResults : filteredUsers;
  const emptyMessage = searchQuery.trim().length >= 2
    ? "No verified user found"
    : showOnlineOnly
      ? "No online conversations"
      : "Search by username or phone to start a chat";

  if (isUsersLoading) return <SidebarSkeleton />;

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setSearchQuery("");
    clearSearchResults();
  };

  return (
    <aside className="h-full w-20 lg:w-72 border-r border-base-300 flex flex-col transition-all duration-200">
      <div className="border-b border-base-300 w-full p-5">
        <div className="flex items-center gap-2">
          <Users className="size-6" />
          <span className="font-medium hidden lg:block">Chats</span>
        </div>

        <div className="mt-4 hidden lg:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-base-content/40" />
            <input
              type="text"
              className="input input-bordered input-sm w-full pl-9"
              placeholder="Search username or phone"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {isSearchingUsers && (
            <p className="mt-2 text-xs text-base-content/50">Searching...</p>
          )}
        </div>

        <div className="mt-3 hidden lg:flex items-center gap-2">
          <label className="cursor-pointer flex items-center gap-2">
            <input
              type="checkbox"
              checked={showOnlineOnly}
              onChange={(e) => setShowOnlineOnly(e.target.checked)}
              className="checkbox checkbox-sm"
              disabled={searchQuery.trim().length >= 2}
            />
            <span className="text-sm">Show online only</span>
          </label>
          <span className="text-xs text-zinc-500">({Math.max(onlineUsers.length - 1, 0)} online)</span>
        </div>
      </div>

      <div className="overflow-y-auto w-full py-3">
        {visibleUsers.map((user) => (
          <button
            key={user._id}
            onClick={() => handleSelectUser(user)}
            className={`
              w-full p-3 flex items-center gap-3
              hover:bg-base-300 transition-all duration-300 ease-out
              ${selectedUser?._id === user._id ? "bg-base-300 ring-1 ring-base-300" : ""}
            `}
          >
            <div className="relative mx-auto lg:mx-0">
              <img
                src={user.profilePic || "/avatar.png"}
                alt={user.fullName}
                className="size-12 object-cover rounded-full"
              />
              {onlineUsers.includes(user._id) && (
                <span
                  className="absolute bottom-0 right-0 size-3 bg-green-500 
                  rounded-full ring-2 ring-zinc-900"
                />
              )}
            </div>

            <div className="hidden lg:block text-left min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium truncate">{user.fullName}</div>
                {(unreadCounts[user._id] || 0) > 0 && (
                  <span className="min-w-6 rounded-full bg-primary px-2 py-0.5 text-center text-xs font-semibold text-primary-content">
                    {unreadCounts[user._id] > 9 ? "+9" : unreadCounts[user._id]}
                  </span>
                )}
              </div>
              <div className={`text-sm truncate ${(unreadCounts[user._id] || 0) > 0 ? "font-semibold text-base-content" : "text-zinc-400"}`}>
                {searchQuery.trim().length >= 2
                  ? user.username ? `@${user.username}` : user.phoneNumber
                  : getLastMessagePreview(lastMessages[user._id] || user.lastMessage) || (user.username ? `@${user.username}` : user.phoneNumber)}
              </div>
            </div>
          </button>
        ))}

        {visibleUsers.length === 0 && (
          <div className="hidden lg:block text-center text-zinc-500 px-4 py-6 text-sm">
            {emptyMessage}
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
