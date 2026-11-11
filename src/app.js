import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { toNodeHandler } from "better-auth/node";
import globalErrorHandler, { notFoundHandler } from "./utils/globalErrorHandler.js";
import productRoute from "./modules/product/product.route.js"
import reviewRoute from "./modules/reviews/review.route.js"
import orderRoute from "./modules/order/order.route.js"

const createApp = (auth) => {
    const app = express();

    app.use(cors({
        origin: [
            process.env.FRONTEND_URL,
            "http://localhost:3000",
        ].filter(Boolean),
        credentials: true
    }));

    app.use(cookieParser());
    app.use(express.json());

    app.all("/api/auth/*splat", toNodeHandler(auth));

    app.use("/api/v1/product", productRoute)
    app.use("/api/v1/reviews", reviewRoute)
    app.use("/api/v1/orders", orderRoute)


    app.get("/", (req, res) => {
        res.send("MEWE Fashion server is running successfully");
    });

    app.use(notFoundHandler);
    app.use(globalErrorHandler);

    return app;
}

export default createApp;