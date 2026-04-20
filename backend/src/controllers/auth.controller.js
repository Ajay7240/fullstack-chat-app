import { generateToken } from "../lib/utils.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs"
import cloudinary from "../lib/cloudinary.js";
import crypto from "crypto";
import SignupOtp from "../models/signupOtp.model.js";
import { sendSignupOtp } from "../lib/brevo.js";

const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

const normalizeEmail = (email = "") => email.trim().toLowerCase();
const normalizeUsername = (username = "") => username.trim().toLowerCase();
const normalizePhoneNumber = (phoneNumber = "") => phoneNumber.trim().replace(/\s+/g, "");

const generateOtp = () => crypto.randomInt(100000, 1000000).toString();
const hashOtp = (otp) => crypto.createHash("sha256").update(otp).digest("hex");

const getSafeUser = (user) => ({
    _id: user._id,
    fullName: user.fullName,
    email: user.email,
    username: user.username,
    phoneNumber: user.phoneNumber,
    profilePic: user.profilePic,
    emailVerified: user.emailVerified,
    isVerified: user.isVerified,
});

export const signup = async (req, res) => {
    const {fullName, email, phoneNumber, username, password} = req.body;
    try {
        const normalizedEmail = normalizeEmail(email);
        const normalizedUsername = normalizeUsername(username);
        const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);

        if(!fullName?.trim() || !normalizedEmail || !normalizedPhoneNumber || !normalizedUsername || !password){
            return res.status(400).json({message: "All fields are required"});
        }

        if(!/\S+@\S+\.\S+/.test(normalizedEmail)){
            return res.status(400).json({message: "Invalid email format"});
        }

        if(!/^[a-z0-9_]{3,20}$/.test(normalizedUsername)){
            return res.status(400).json({message: "Username must be 3-20 characters and use only letters, numbers, and underscores"});
        }

        if(!/^\+[1-9]\d{7,14}$/.test(normalizedPhoneNumber)){
            return res.status(400).json({message: "Phone number must include country code, for example +919876543210"});
        }

        if (password.length < 6) {
            return res.status(400).json({message: "Password must be at least 6 characters"})
        }

        const user = await User.findOne({
            $or: [
                {email: normalizedEmail},
                {username: normalizedUsername},
                {phoneNumber: normalizedPhoneNumber},
            ],
        });

        if(user) return res.status(400).json({message: "Email, username, or phone number already exists"});

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const emailOtp = generateOtp();

        await SignupOtp.findOneAndDelete({
            $or: [
                {email: normalizedEmail},
                {username: normalizedUsername},
                {phoneNumber: normalizedPhoneNumber},
            ],
        });

        await SignupOtp.create({
            fullName: fullName.trim(),
            email: normalizedEmail,
            username: normalizedUsername,
            phoneNumber: normalizedPhoneNumber,
            password: hashedPassword,
            emailOtpHash: hashOtp(emailOtp),
            expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
        });

        await sendSignupOtp({
            email: normalizedEmail,
            fullName: fullName.trim(),
            emailOtp,
        });

        res.status(200).json({
            message: "OTP sent to your email",
            email: normalizedEmail,
            phoneNumber: normalizedPhoneNumber,
            ...(process.env.NODE_ENV === "development" && process.env.BREVO_SKIP_SEND === "true"
                ? {devOtp: {email: emailOtp}}
                : {}),
        });
    } catch (error) {
        console.log("Error in signup controller", error.message);
        res.status(500).json({message: error.message || "Internal Server Error"});
    }
};

export const verifySignup = async (req, res) => {
    const {email, emailOtp} = req.body;

    try {
        const normalizedEmail = normalizeEmail(email);

        if(!normalizedEmail || !emailOtp){
            return res.status(400).json({message: "Email OTP is required"});
        }

        const pendingSignup = await SignupOtp.findOne({email: normalizedEmail});

        if(!pendingSignup){
            return res.status(400).json({message: "OTP expired or signup request not found"});
        }

        if(pendingSignup.attempts >= MAX_OTP_ATTEMPTS){
            await SignupOtp.findByIdAndDelete(pendingSignup._id);
            return res.status(429).json({message: "Too many incorrect OTP attempts. Please sign up again"});
        }

        const isEmailOtpCorrect = pendingSignup.emailOtpHash === hashOtp(emailOtp);

        if(!isEmailOtpCorrect){
            pendingSignup.attempts += 1;
            await pendingSignup.save();
            return res.status(400).json({message: "Invalid OTP"});
        }

        const existingUser = await User.findOne({
            $or: [
                {email: pendingSignup.email},
                {username: pendingSignup.username},
                {phoneNumber: pendingSignup.phoneNumber},
            ],
        });

        if(existingUser){
            await SignupOtp.findByIdAndDelete(pendingSignup._id);
            return res.status(400).json({message: "Email, username, or phone number already exists"});
        }

        const newUser = await User.create({
            fullName: pendingSignup.fullName,
            email: pendingSignup.email,
            username: pendingSignup.username,
            phoneNumber: pendingSignup.phoneNumber,
            password: pendingSignup.password,
            emailVerified: true,
            isVerified: true,
        });

        await SignupOtp.findByIdAndDelete(pendingSignup._id);
        generateToken(newUser._id, res);

        res.status(201).json(getSafeUser(newUser));
    } catch (error) {
        console.log("Error in verifySignup controller", error.message);
        res.status(500).json({message: "Internal Server Error"});
    }
}

export const login = async (req, res) => {
    const {identifier, email, password} = req.body;

    try {
        const loginId = (identifier || email || "").trim();

        if(!loginId || !password){
            return res.status(400).json({message: "Login ID and password are required"});
        }

        const normalizedLoginId = loginId.toLowerCase();
        const normalizedPhoneNumber = normalizePhoneNumber(loginId);

        const user = await User.findOne({
            $or: [
                {email: normalizedLoginId},
                {username: normalizedLoginId},
                {phoneNumber: normalizedPhoneNumber},
            ],
        });

        if(!user){
            return res.status(400).json({message: "Invalid credentials"})
        }

        if(user.isVerified === false){
            return res.status(403).json({message: "Please verify your account before logging in"})
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.password);

        if(!isPasswordCorrect){
            return res.status(400).json({message: "Invalid credentials"})
        }

        generateToken(user._id, res)

        res.status(200).json(getSafeUser(user))
    } catch (error) {
        console.log("Error in login controller", error.message);
        res.status(500).json({message: "Internal Server Error"})
    }
};

export const logout = (req, res) => {
    try {
        res.cookie("jwt", "", {maxAge: 0});
        res.status(200).json({message: "Logged out successfully"});
    } catch (error) {
        console.log("Error in logout controller", error.message);
        res.status(500).json({message: "Internal Server Error"});
    }
};

export const updateProfile = async (req, res) => {
    try {
        const {profilePic} = req.body;
        const userId = req.user._id;

        if(!profilePic){
            return res.status(400).json({message: "Profile pic is required"})
        }

        const uploadResponse = await cloudinary.uploader.upload(profilePic);

        const updatedUser = await User.findByIdAndUpdate(userId, {profilePic: uploadResponse.secure_url}, {new:true}).select("-password");

        res.status(200).json(updatedUser);

    } catch (error) {
        console.log("Error in updateProfile: ", error);
        res.status(500).json({message: "Internal server error"})
    }
}

export const checkAuth = (req, res) => {
    try {
        res.status(200).json(req.user);
    } catch (error) {
        console.log("Error in checkAuth controller ", error.message);
        res.status(500).json({message: "Internal Server Error"})
    }
}
