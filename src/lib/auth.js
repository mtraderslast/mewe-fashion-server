import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";

export const createAuth = (db) => {

    const origins = [
        process.env.FRONTEND_URL,
        "http://localhost:3000"
    ].filter(Boolean);

    return betterAuth({
        database: mongodbAdapter(db),

        baseURL: process.env.BACKEND_URL || "http://localhost:5000",

        emailAndPassword: {
            enabled: true,
        },

        session: {
            fields: {
                user: ["role", "image", "phone", "address"]
            }
        },

        advanced: {
            defaultCookieAttributes: {
                sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
                secure: process.env.NODE_ENV === "production" ? true : false,
                httpOnly: true,
            }
        },

        user: {
            additionalFields: {
                role: {
                    type: "string",
                    defaultValue: "user",
                    input: false,
                },
                phone: {
                    type: "string",
                    defaultValue: "",
                },
                image: {
                    type: "string",
                    defaultValue: "",
                },
                address: {
                    type: "string",
                    defaultValue: "",
                },
            },
        },

        trustedOrigins: origins
    });
};
