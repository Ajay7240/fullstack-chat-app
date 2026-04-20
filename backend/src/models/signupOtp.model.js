import mongoose from "mongoose";

const signupOtpSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
        },
        phoneNumber: {
            type: String,
            required: true,
            trim: true,
        },
        username: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
        },
        fullName: {
            type: String,
            required: true,
            trim: true,
        },
        password: {
            type: String,
            required: true,
        },
        emailOtpHash: {
            type: String,
            required: true,
        },
        expiresAt: {
            type: Date,
            required: true,
            index: { expires: 0 },
        },
        attempts: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

const SignupOtp = mongoose.model("SignupOtp", signupOtpSchema);

export default SignupOtp;
