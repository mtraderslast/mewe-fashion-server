import express from "express";
import {
    createOrder,
    deleteOrder,
    getAllOrders,
    getMyOrders,
    getOrderById,
    trackOrder,
    updateOrder,
} from "./order.controller.js";
import { optionalAuth, verifyToken } from "../../middleware/authMiddleware.js";
import protectRoute from "../../middleware/protectRoute.js";
import { ROLES } from "../../utils/roles.js";

const router = express.Router();

router.post("/", optionalAuth, createOrder);
router.get("/track/:trackingId", trackOrder);
router.get("/mine", verifyToken, protectRoute(ROLES.USER, ROLES.ADMIN), getMyOrders);
router.get("/", verifyToken, protectRoute(ROLES.ADMIN), getAllOrders);
router.get("/:id", verifyToken, protectRoute(ROLES.USER, ROLES.ADMIN), getOrderById);
router.patch("/:id", verifyToken, protectRoute(ROLES.ADMIN), updateOrder);
router.delete("/:id", verifyToken, protectRoute(ROLES.ADMIN), deleteOrder);

export default router;
