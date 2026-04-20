const BREVO_API_BASE_URL = "https://api.brevo.com/v3";

const isBrevoBypassed = () =>
    process.env.NODE_ENV === "development" && process.env.BREVO_SKIP_SEND === "true";

const assertBrevoConfig = () => {
    if (isBrevoBypassed()) return;

    if (!process.env.BREVO_API_KEY) {
        throw new Error("BREVO_API_KEY is required to send OTPs");
    }

    if (!process.env.BREVO_EMAIL_SENDER) {
        throw new Error("BREVO_EMAIL_SENDER is required to send OTPs");
    }
};

const brevoRequest = async (path, body) => {
    const response = await fetch(`${BREVO_API_BASE_URL}${path}`, {
        method: "POST",
        headers: {
            "accept": "application/json",
            "api-key": process.env.BREVO_API_KEY,
            "content-type": "application/json",
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        let errorMessage = "Brevo could not send the OTP";

        try {
            const errorBody = await response.json();
            errorMessage = errorBody.message || errorMessage;
        } catch {
            // Keep the generic provider error.
        }

        throw new Error(errorMessage);
    }
};

export const sendSignupOtp = async ({ email, fullName, emailOtp }) => {
    assertBrevoConfig();

    if (isBrevoBypassed()) {
        console.log(`Development signup OTP for ${email}: ${emailOtp}`);
        return;
    }

    const senderName = process.env.BREVO_EMAIL_SENDER_NAME || "MissChat";

    await brevoRequest("/smtp/email", {
        sender: {
            name: senderName,
            email: process.env.BREVO_EMAIL_SENDER,
        },
        to: [{ email, name: fullName }],
        subject: "Verify your MissChat account",
        htmlContent: `<p>Your MissChat email verification OTP is <strong>${emailOtp}</strong>. It expires in 10 minutes.</p>`,
        textContent: `Your MissChat email verification OTP is ${emailOtp}. It expires in 10 minutes.`,
    });
};
