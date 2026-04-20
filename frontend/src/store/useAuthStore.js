import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

const BASE_URL = import.meta.env.MODE === "development" ? "http://localhost:5000" : "/";

export const useAuthStore = create((set, get) => ({
    authUser: null,
    isSigningUp: false,
    isVerifyingSignup: false,
    pendingSignup: null,
    isLoggingIn: false,
    isUpdatingProfile: false,
    isCheckingAuth: true,
    onlineUsers: [],
    socket: null,


    checkAuth: async () => {
        try {
            const res = await axiosInstance.get("/auth/check");

            set({ authUser: res.data })

            get().connectSocket();
        } catch (error) {
            console.log("Error in checkAuth: ", error);
            set({ authUser: null })
        } finally {
            set({ isCheckingAuth: false })
        }
    },

    signup: async (data) => {
        set({ isSigningUp: true });
        try {
            const res = await axiosInstance.post("/auth/signup", data);
            set({ pendingSignup: res.data });
            toast.success(res.data.message || "OTP sent successfully");
            return true;

        } catch (error) {
            toast.error(error.response?.data?.message || "Signup failed");
            return false;
        } finally {
            set({ isSigningUp: false })
        }
    },

    verifySignup: async (data) => {
        set({ isVerifyingSignup: true });
        try {
            const res = await axiosInstance.post("/auth/verify-signup", data);
            set({ authUser: res.data, pendingSignup: null });
            toast.success("Account verified successfully");
            get().connectSocket();
            return true;
        } catch (error) {
            toast.error(error.response?.data?.message || "Verification failed");
            return false;
        } finally {
            set({ isVerifyingSignup: false })
        }
    },

    login: async (data) => {
        set({ isLoggingIn: true });
        try {
            const res = await axiosInstance.post("/auth/login", data);
            set({ authUser: res.data });
            toast.success("Logged in successfully")

            get().connectSocket();
        } catch (error) {
            toast.error(error.response?.data?.message || "Login failed")
        } finally {
            set({ isLoggingIn: false })
        }

    },

    logout: async () => {
        try {
            await axiosInstance.post("/auth/logout");
            set({ authUser: null });
            toast.success("Logged out successfully")

            get().disconnectSocket();
        } catch (error) {
            toast.error(error.response.data.message);
        }
    },

    updateProfile: async (data) => {
        set({ isUpdatingProfile: true });
        try {
            const res = await axiosInstance.put("/auth/update-profile", data);
            set({ authUser: res.data });
            toast.success("Profile updated successfully");
        } catch (error) {
            console.log("Error in update profile: ", error);
            toast.error(error.response.data.message);
        } finally {
            set({ isUpdatingProfile: false })
        }
    },

    connectSocket: () => {
        const { authUser } = get();
        if (!authUser || get().socket?.connected) return;

        const socket = io(BASE_URL, {
            autoConnect: false,
            query: {
                userId: authUser._id,
            },
        });
        set({ socket: socket })

        socket.connect();

        socket.on("getOnlineUsers", (userIds) => {
            set({ onlineUsers: userIds });
        })
    },
    disconnectSocket: () => {
        const socket = get().socket;

        if (socket) {
            socket.off("getOnlineUsers");
            socket.disconnect();
        }

        set({ socket: null, onlineUsers: [] });
    },
}));
