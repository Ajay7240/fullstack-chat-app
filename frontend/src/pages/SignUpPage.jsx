import React, { useState } from "react";
import { useAuthStore } from "../store/useAuthStore.js";
import { AtSign, BadgeCheck, Eye, EyeOff, Loader2, Lock, Mail, MessageSquare, Phone, User } from "lucide-react";
import { Link } from "react-router-dom";
import AuthImagePattern from "../components/AuthImagePattern.jsx";
import toast from "react-hot-toast";

const SignUpPage = () => {
    const [showPassword, setShowPassword] = useState(false);
    const [isOtpStep, setIsOtpStep] = useState(false);
    const [otpData, setOtpData] = useState({
        emailOtp: "",
    });
    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        phoneNumber: "",
        username: "",
        password: "",
    });

    const { signup, verifySignup, isSigningUp, isVerifyingSignup, pendingSignup } = useAuthStore();

    const validateForm = () => {
        if(!formData.fullName.trim()) return toast.error("Full name is required");
        if(!formData.email.trim()) return toast.error("Email is required");
        if(!/\S+@\S+\.\S+/.test(formData.email)) return toast.error("Invalid email format");
        if(!formData.phoneNumber.trim()) return toast.error("Phone number is required");
        if(!/^\+[1-9]\d{7,14}$/.test(formData.phoneNumber.trim().replace(/\s+/g, ""))) {
            return toast.error("Use phone number with country code, like +919876543210");
        }
        if(!formData.username.trim()) return toast.error("Username is required");
        if(!/^[a-zA-Z0-9_]{3,20}$/.test(formData.username.trim())) {
            return toast.error("Username must be 3-20 letters, numbers, or underscores");
        }
        if(!formData.password) return toast.error("Password is required");
        if(formData.password.length < 6) return toast.error("Password must be at least 6 characters");

        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if(validateForm() !== true) return;

        const otpSent = await signup({
            ...formData,
            email: formData.email.trim().toLowerCase(),
            phoneNumber: formData.phoneNumber.trim().replace(/\s+/g, ""),
            username: formData.username.trim().toLowerCase(),
        });

        if(otpSent) setIsOtpStep(true);
    };

    const handleVerifySignup = (e) => {
        e.preventDefault();

        if(otpData.emailOtp.trim().length !== 6) return toast.error("Enter the 6 digit email OTP");

        verifySignup({
            email: pendingSignup?.email || formData.email,
            emailOtp: otpData.emailOtp.trim(),
        });
    };

    const renderOtpStep = () => (
        <form onSubmit={handleVerifySignup} className="space-y-6">
            <div className="alert">
                <BadgeCheck className="size-5" />
                <span>
                    Enter the OTP sent to {pendingSignup?.email || formData.email}.
                </span>
            </div>

            {pendingSignup?.devOtp && (
                <div className="text-sm text-base-content/70">
                    Development OTP: {pendingSignup.devOtp.email}
                </div>
            )}

            <div className="form-control">
                <label className="label">
                    <span className="label-text font-medium">Email OTP</span>
                </label>
                <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    className="input input-bordered w-full"
                    placeholder="123456"
                    value={otpData.emailOtp}
                    onChange={(e) => setOtpData({ ...otpData, emailOtp: e.target.value.replace(/\D/g, "") })}
                />
            </div>

            <button type="submit" className="btn btn-primary w-full" disabled={isVerifyingSignup}>
                {isVerifyingSignup ? (<><Loader2 className="size-5 animate-spin"/>Verifying...</>) : ("Verify and Create Account")}
            </button>

            <button type="button" className="btn btn-ghost w-full" onClick={() => setIsOtpStep(false)}>
                Edit signup details
            </button>
        </form>
    );

    return (
        <div className="min-h-screen grid lg:grid-cols-2">
            <div className="flex flex-col justify-center items-center p-6 sm:p-12">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center mb-8">
                        <div className="flex flex-col items-center gap-2 group">
                            <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <MessageSquare className="size-6 text-primary" />
                            </div>
                            <h1 className="text-2xl font-bold mt-2">{isOtpStep ? "Verify Account" : "Create Account"}</h1>
                            <p className="text-base-content/60">
                                {isOtpStep ? "Confirm your email address" : "Get started with your free account"}
                            </p>
                        </div>
                    </div>

                    {isOtpStep ? renderOtpStep() : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-medium">Full Name</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                                        <User className="size-5 text-base-content/40" />
                                    </div>
                                    <input
                                        type="text"
                                        className="input input-bordered w-full pl-10"
                                        placeholder="John Doe"
                                        value={formData.fullName}
                                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-medium">Email</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                                        <Mail className="size-5 text-base-content/40" />
                                    </div>
                                    <input
                                        type="text"
                                        className="input input-bordered w-full pl-10"
                                        placeholder="yourmail@example.com"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-medium">Phone Number</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                                        <Phone className="size-5 text-base-content/40" />
                                    </div>
                                    <input
                                        type="tel"
                                        className="input input-bordered w-full pl-10"
                                        placeholder="+919876543210"
                                        value={formData.phoneNumber}
                                        onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-medium">Username</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                                        <AtSign className="size-5 text-base-content/40" />
                                    </div>
                                    <input
                                        type="text"
                                        className="input input-bordered w-full pl-10"
                                        placeholder="john_doe"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-medium">Password</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                                        <Lock className="size-5 text-base-content/40" />
                                    </div>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        className="input input-bordered w-full pl-10"
                                        placeholder="Password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    />
                                    <button
                                        type="button"
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? (<EyeOff className="size-5 text-base-content/40" />) : (<Eye className="size-5 text-base-content/40"/>)}
                                    </button>
                                </div>
                            </div>

                            <button type="submit" className="btn btn-primary w-full" disabled={isSigningUp}>
                                {isSigningUp ? (<><Loader2 className="size-5 animate-spin"/>Sending OTP...</>) : ("Send OTP")}
                            </button>
                        </form>
                    )}

                    <div className="text-center">
                        <p className="text-base-content/60">
                            Already have an account?{" "}
                            <Link to="/login" className="link link-primary">
                                Sign in
                            </Link>
                        </p>
                    </div>
                </div>
            </div>

            <AuthImagePattern
                title="Join our community"
                subtitle="Connect with friends, share moments, and stay in touch with your loved ones"
            />
        </div>
    );
};

export default SignUpPage;
