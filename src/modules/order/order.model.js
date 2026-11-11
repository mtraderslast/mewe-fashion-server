import mongoose from "mongoose";

export const ORDER_STATUS = [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "out_for_delivery",
    "delivered",
    "cancelled",
    "returned",
];

export const PAYMENT_STATUS = [
    "unpaid",
    "pending",
    "authorized",
    "paid",
    "failed",
    "refunded",
    "partially_refunded",
];

export const PAYMENT_METHODS = [
    "cod",
    "card",
    "stripe",
    "paypal",
    "sslcommerz",
    "razorpay",
    "bkash",
    "nagad",
    "bank_transfer",
];

const orderItemSchema = new mongoose.Schema(
    {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        slug: { type: String, required: true },
        title: { type: String, required: true },
        image: { type: String, default: "" },
        sku: { type: String, default: "" },
        selectedAttributes: { type: Map, of: String, default: {} },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
        lineTotal: { type: Number, required: true, min: 0 },
    },
    { _id: false }
);

const trackingEventSchema = new mongoose.Schema(
    {
        status: { type: String, enum: ORDER_STATUS, required: true },
        message: { type: String, required: true, trim: true },
        location: { type: String, default: "", trim: true },
        at: { type: Date, default: Date.now },
    },
    { _id: false }
);

const orderSchema = new mongoose.Schema(
    {
        orderNumber: { type: String, required: true, unique: true, index: true },
        trackingId: { type: String, required: true, unique: true, index: true },

        userId: { type: String, default: null, index: true },

        customer: {
            name: { type: String, required: true, trim: true },
            email: { type: String, required: true, trim: true, lowercase: true },
            phone: { type: String, required: true, trim: true },
        },

        shippingAddress: {
            street: { type: String, required: true, trim: true },
            city: { type: String, required: true, trim: true },
            state: { type: String, required: true, trim: true },
            zip: { type: String, required: true, trim: true },
            country: { type: String, default: "US", trim: true },
        },

        items: { type: [orderItemSchema], required: true },

        pricing: {
            currency: { type: String, default: "USD" },
            subtotal: { type: Number, required: true, min: 0 },
            shipping: { type: Number, default: 0, min: 0 },
            discount: { type: Number, default: 0, min: 0 },
            tax: { type: Number, default: 0, min: 0 },
            total: { type: Number, required: true, min: 0 },
        },

        payment: {
            method: { type: String, enum: PAYMENT_METHODS, default: "cod" },
            status: { type: String, enum: PAYMENT_STATUS, default: "unpaid", index: true },
            gateway: { type: String, default: "" },
            gatewayOrderId: { type: String, default: "" },
            gatewayPaymentId: { type: String, default: "" },
            transactionId: { type: String, default: "" },
            amountPaid: { type: Number, default: 0, min: 0 },
            currency: { type: String, default: "USD" },
            paidAt: { type: Date, default: null },
            refundedAt: { type: Date, default: null },
            metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
        },

        fulfillmentStatus: {
            type: String,
            enum: ORDER_STATUS,
            default: "pending",
            index: true,
        },

        tracking: {
            carrier: { type: String, default: "", trim: true },
            carrierTrackingNumber: { type: String, default: "", trim: true },
            estimatedDelivery: { type: Date, default: null },
            events: { type: [trackingEventSchema], default: [] },
        },

        notes: { type: String, default: "", trim: true },
        customerNote: { type: String, default: "", trim: true },
        cancelReason: { type: String, default: "", trim: true },
        cancelledAt: { type: Date, default: null },
    },
    { timestamps: true, versionKey: false, toJSON: { flattenMaps: true }, toObject: { flattenMaps: true } }
);

orderSchema.index({ "customer.email": 1, createdAt: -1 });
orderSchema.index({ fulfillmentStatus: 1, createdAt: -1 });
orderSchema.index({ "payment.status": 1, createdAt: -1 });

const Order = mongoose.model("Order", orderSchema);
export default Order;
