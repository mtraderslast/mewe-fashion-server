import mongoose from "mongoose";
import AppError from "../../utils/AppError.js";
import catchAsync from "../../utils/catchAsync.js";
import Product from "../product/product.model.js";
import Review from "./review.model.js";
import { createReviewSchema, updateReviewSchema } from "./review.validation.js";

export const createReview = catchAsync(async (req, res) => {
    const validatedBody = createReviewSchema.parse(req.body);
    const { productId, rating, comment } = validatedBody;

    const userId = req.user?.id;
    if (!userId) {
        throw new AppError(401, "You must be logged in to post a review");
    }

    const product = await Product.findById(productId);
    if (!product) {
        throw new AppError(404, "Product not found");
    }

    const existingReview = await Review.findOne({ productId, userId });
    if (existingReview) {
        throw new AppError(400, "You have already submitted a review for this product");
    }

    let userName = req.user?.name;
    let userEmail = req.user?.email;
    let userImage = req.user?.image || "";

    if (!userName || !userEmail) {
        const queryId = mongoose.Types.ObjectId.isValid(userId)
            ? new mongoose.Types.ObjectId(userId)
            : userId;

        const user = await mongoose.connection.collection("user").findOne({ _id: queryId });

        if (!user) {
            throw new AppError(404, "User profile not found");
        }

        userName = user.name || "Anonymous";
        userEmail = user.email;
        userImage = user.image || "";
    }

    const newReview = await Review.create({
        productId,
        userId,
        userName,
        userEmail,
        userImage,
        rating,
        comment,
    });

    res.status(201).json({
        success: true,
        message: "Review submitted successfully",
        data: newReview,
    });
});

export const getProductReviews = catchAsync(async (req, res) => {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        throw new AppError(400, "Invalid product ID");
    }

    const product = await Product.findById(productId);
    if (!product) {
        throw new AppError(404, "Product not found");
    }

    const reviews = await Review.find({ productId }).sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        message: "Product reviews fetched successfully",
        data: reviews,
    });
});

export const editProductReview = catchAsync(async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id;

    const validatedBody = updateReviewSchema.parse(req.body);
    const { rating, comment } = validatedBody;

    if (rating === undefined && comment === undefined) {
        throw new AppError(400, "Please provide rating or comment to update");
    }

    const review = await Review.findById(id);
    if (!review) {
        throw new AppError(404, "Review not found");
    }

    if (review.userId !== userId) {
        throw new AppError(403, "You are not authorized to edit this review");
    }

    if (rating !== undefined) review.rating = rating;
    if (comment !== undefined) review.comment = comment;

    const updatedReview = await review.save();

    res.status(200).json({
        success: true,
        message: "Review updated successfully",
        data: updatedReview,
    });
});

export const deleteReview = catchAsync(async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const review = await Review.findById(id);
    if (!review) {
        throw new AppError(404, "Review not found");
    }

    const isOwner = review.userId === userId;
    const isAdmin = userRole === "admin";

    if (!isOwner && !isAdmin) {
        throw new AppError(403, "You are not authorized to delete this review");
    }

    await Review.findByIdAndDelete(id);

    res.status(200).json({
        success: true,
        message: "Review deleted successfully",
        data: null,
    });
});

export const getHomeTopReviews = catchAsync(async (req, res) => {
    const [reviews, stats] = await Promise.all([
        Review.find({ rating: { $gte: 4 } })
            .select("-userEmail -userId")
            .sort({ rating: -1, createdAt: -1 })
            .limit(8)
            .populate("productId", "titleBn titleEn slug images"),
        Review.aggregate([
            { $group: { _id: null, averageRating: { $avg: "$rating" }, totalReviews: { $sum: 1 } } },
        ]),
    ]);

    res.status(200).json({
        success: true,
        message: "Home top reviews fetched successfully",
        meta: {
            averageRating: stats[0] ? Math.round(stats[0].averageRating * 10) / 10 : 0,
            totalReviews: stats[0]?.totalReviews || 0,
        },
        data: reviews,
    });
});