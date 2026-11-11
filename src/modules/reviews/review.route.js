import express from "express";
import { createReview, deleteReview, editProductReview, getHomeTopReviews, getProductReviews, } from "./review.controller.js";
import { verifyToken } from "../../middleware/authMiddleware.js";
import protectRoute from "../../middleware/protectRoute.js";
import { ROLES } from "../../utils/roles.js";

const router = express.Router();

router.get("/home-page-review", getHomeTopReviews);
router.get("/product-review/:productId", getProductReviews);

router.post("/create-review", verifyToken, protectRoute(ROLES.USER, ROLES.ADMIN), createReview);
router.patch("/:id", verifyToken, protectRoute(ROLES.USER, ROLES.ADMIN), editProductReview);
router.delete("/:id", verifyToken, protectRoute(ROLES.USER, ROLES.ADMIN), deleteReview);

export default router;