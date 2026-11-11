import { z } from "zod";

const objectId = z
    .string({ required_error: "Product ID is required" })
    .regex(/^[a-fA-F0-9]{24}$/, "Invalid product ID");

export const createReviewSchema = z.object({
    productId: objectId,
    rating: z
        .number({ required_error: "Rating is required" })
        .int("Rating must be a whole number")
        .min(1, "Rating must be at least 1")
        .max(5, "Rating cannot be more than 5"),
    comment: z
        .string({ required_error: "Comment is required" })
        .trim()
        .min(3, "Comment must be at least 3 characters")
        .max(1000, "Comment cannot exceed 1000 characters"),
});

export const updateReviewSchema = z.object({
    rating: z
        .number()
        .int("Rating must be a whole number")
        .min(1, "Rating must be at least 1")
        .max(5, "Rating cannot be more than 5")
        .optional(),
    comment: z
        .string()
        .trim()
        .min(3, "Comment must be at least 3 characters")
        .max(1000, "Comment cannot exceed 1000 characters")
        .optional(),
});