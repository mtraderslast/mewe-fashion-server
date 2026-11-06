import AppError from "./AppError.js";

const isProduction = process.env.NODE_ENV === "production";

export const notFoundHandler = (req, res, next) => {
    next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

const normalizeError = (err) => {
    if (err?.name === "ZodError" && Array.isArray(err.issues)) {
        const first = err.issues[0];
        const path = first?.path?.length ? `${first.path.join(".")}: ` : "";
        return { statusCode: 400, message: `${path}${first?.message || "Invalid input data"}` };
    }

    if (err?.name === "CastError") {
        return { statusCode: 400, message: `Invalid ${err.path || "value"}: ${err.value}` };
    }

    if (err?.name === "ValidationError" && err.errors) {
        const first = Object.values(err.errors)[0];
        return { statusCode: 400, message: first?.message || "Validation failed" };
    }

    if (err?.code === 11000) {
        const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || "field";
        return { statusCode: 409, message: `A record with this ${field} already exists` };
    }

    if (err?.type === "entity.parse.failed") {
        return { statusCode: 400, message: "Invalid JSON in request body" };
    }

    if (err instanceof AppError || err?.statusCode) {
        return { statusCode: err.statusCode, message: err.message };
    }

    return { statusCode: 500, message: "Something went wrong!" };
};

const globalErrorHandler = (err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    const { statusCode, message } = normalizeError(err);

    if (statusCode >= 500) {
        console.error("Unhandled Error:", err);
    }

    res.status(statusCode).json({
        success: false,
        message: statusCode >= 500 && isProduction ? "Something went wrong!" : message,
        stack: process.env.NODE_ENV === "development" ? err?.stack : undefined,
    });
};

export default globalErrorHandler;
