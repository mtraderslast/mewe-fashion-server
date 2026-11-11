import { z } from "zod";
import { ORDER_STATUS, PAYMENT_METHODS, PAYMENT_STATUS } from "./order.model.js";

const emailField = z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address");

const orderItemInput = z.object({
    slug: z.string().trim().min(1, "Product slug is required"),
    productId: z.string().trim().optional(),
    quantity: z.number().int().min(1).max(50),
    selectedAttributes: z.record(z.string(), z.string()).optional(),
});

export const createOrderSchema = z.object({
    customer: z.object({
        name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
        email: emailField,
        phone: z.string().trim().min(8, "Enter a valid phone number").max(20),
    }),
    shippingAddress: z.object({
        street: z.string().trim().min(3, "Street address is required").max(200),
        city: z.string().trim().min(2, "City is required").max(80),
        state: z.string().trim().min(2, "State is required").max(40),
        zip: z.string().trim().min(3, "ZIP code is required").max(20),
        country: z.string().trim().min(2).max(40).optional(),
    }),
    items: z.array(orderItemInput).min(1, "Cart is empty").max(30),
    paymentMethod: z.enum(PAYMENT_METHODS).optional(),
    customerNote: z.string().trim().max(500).optional(),
});

export const updateOrderSchema = z
    .object({
        fulfillmentStatus: z.enum(ORDER_STATUS).optional(),
        paymentStatus: z.enum(PAYMENT_STATUS).optional(),
        paymentMethod: z.enum(PAYMENT_METHODS).optional(),
        notes: z.string().trim().max(1000).optional(),
        cancelReason: z.string().trim().max(300).optional(),
        tracking: z
            .object({
                carrier: z.string().trim().max(80).optional(),
                carrierTrackingNumber: z.string().trim().max(80).optional(),
                estimatedDelivery: z.string().trim().optional(),
            })
            .optional(),
        event: z
            .object({
                status: z.enum(ORDER_STATUS).optional(),
                message: z.string().trim().min(1).max(200),
                location: z.string().trim().max(80).optional(),
            })
            .optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field is required to update",
    });
