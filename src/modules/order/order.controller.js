import crypto from "crypto";
import AppError from "../../utils/AppError.js";
import catchAsync from "../../utils/catchAsync.js";
import Product from "../product/product.model.js";
import Order, { ORDER_STATUS } from "./order.model.js";
import { createOrderSchema, updateOrderSchema } from "./order.validation.js";

const parsePositiveInt = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const randomCode = (length = 6) =>
    crypto.randomBytes(8).toString("hex").slice(0, length).toUpperCase();

const makeOrderNumber = () => {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `MW-${stamp}-${randomCode(5)}`;
};

const makeTrackingId = () => `MEWE-${randomCode(8)}`;

const STATUS_MESSAGES = {
    pending: "Order placed and awaiting confirmation",
    confirmed: "Order confirmed",
    processing: "Order is being prepared",
    shipped: "Order has been shipped",
    out_for_delivery: "Order is out for delivery",
    delivered: "Order delivered",
    cancelled: "Order cancelled",
    returned: "Order returned",
};

const findMatchingVariant = (product, selectedAttributes = {}) => {
    const variants = product?.variants || [];
    if (!variants.length) return null;

    const entries = Object.entries(selectedAttributes).filter(([, value]) => Boolean(value));
    if (!entries.length) return variants[0];

    return (
        variants.find((variant) => entries.every(([key, value]) => variant[key] === value)) ||
        variants[0]
    );
};

const resolveUnitPrice = (product, variant = null) => {
    const variantPrice = Number(variant?.price) || 0;
    const variantDiscount = Number(variant?.discountPrice) || 0;
    const basePrice = variantPrice > 0 ? variantPrice : Number(product?.price) || 0;
    let discountPrice = 0;

    if (variantDiscount > 0) {
        discountPrice = variantDiscount;
    } else if (variantPrice <= 0) {
        discountPrice = Number(product?.discountPrice) || 0;
    }

    const hasDiscount = discountPrice > 0 && discountPrice < basePrice;
    return hasDiscount ? discountPrice : basePrice;
};

const toPlainAttributes = (selectedAttributes = {}) => {
    const source =
        selectedAttributes instanceof Map
            ? Object.fromEntries(selectedAttributes)
            : selectedAttributes;
    return Object.fromEntries(
        Object.entries(source || {}).filter(([, value]) => Boolean(value))
    );
};

const toPublicOrder = (order) => ({
    trackingId: order.trackingId,
    orderNumber: order.orderNumber,
    fulfillmentStatus: order.fulfillmentStatus,
    paymentStatus: order.payment?.status,
    paymentMethod: order.payment?.method,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: (order.items || []).map((item) => ({
        title: item.title,
        image: item.image,
        quantity: item.quantity,
        selectedAttributes: toPlainAttributes(item.selectedAttributes),
        lineTotal: item.lineTotal,
    })),
    shippingAddress: {
        city: order.shippingAddress?.city,
        state: order.shippingAddress?.state,
        zip: order.shippingAddress?.zip,
        country: order.shippingAddress?.country,
    },
    pricing: {
        currency: order.pricing?.currency || "USD",
        total: order.pricing?.total || 0,
    },
    tracking: {
        carrier: order.tracking?.carrier || "",
        carrierTrackingNumber: order.tracking?.carrierTrackingNumber || "",
        estimatedDelivery: order.tracking?.estimatedDelivery || null,
        events: order.tracking?.events || [],
    },
});

const buildTrackingEvent = (status, message, location = "") => ({
    status,
    message: message || STATUS_MESSAGES[status] || "Order updated",
    location: location || "",
    at: new Date(),
});

const uniqueOrderIds = async () => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
        const orderNumber = makeOrderNumber();
        const trackingId = makeTrackingId();
        const exists = await Order.exists({ $or: [{ orderNumber }, { trackingId }] });
        if (!exists) return { orderNumber, trackingId };
    }
    throw new AppError(500, "Could not generate a unique tracking ID");
};

export const createOrder = catchAsync(async (req, res) => {
    const payload = await createOrderSchema.parseAsync(req.body);
    const slugs = [...new Set(payload.items.map((item) => item.slug))];
    const products = await Product.find({ slug: { $in: slugs }, status: "active" });
    const productBySlug = new Map(products.map((product) => [product.slug, product]));

    const snapshotItems = [];

    for (const item of payload.items) {
        const product = productBySlug.get(item.slug);
        if (!product) {
            throw new AppError(400, `Product "${item.slug}" is not available`);
        }

        const attributes = toPlainAttributes(item.selectedAttributes);
        const variant = findMatchingVariant(product, attributes);
        const availableStock = variant ? Number(variant.stock) || 0 : Number(product.stock) || 0;

        if (availableStock < item.quantity) {
            throw new AppError(400, `"${product.title}" does not have enough stock`);
        }

        const unitPrice = resolveUnitPrice(product, variant);
        if (unitPrice <= 0) {
            throw new AppError(400, `"${product.title}" has an invalid price`);
        }

        snapshotItems.push({
            productId: product._id,
            slug: product.slug,
            title: product.title,
            image: product.images?.[0] || "",
            sku: variant?.sku || "",
            selectedAttributes: attributes,
            quantity: item.quantity,
            unitPrice,
            lineTotal: Number((unitPrice * item.quantity).toFixed(2)),
            _product: product,
            _variant: variant,
        });
    }

    const subtotal = Number(snapshotItems.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2));
    const shipping = 0;
    const discount = 0;
    const tax = 0;
    const total = Number((subtotal + shipping + tax - discount).toFixed(2));
    const { orderNumber, trackingId } = await uniqueOrderIds();
    const paymentMethod = "cod";

    const order = await Order.create({
        orderNumber,
        trackingId,
        userId: req.user?.id || null,
        customer: payload.customer,
        shippingAddress: {
            ...payload.shippingAddress,
            country: payload.shippingAddress.country || "US",
        },
        items: snapshotItems.map(({ _product, _variant, ...item }) => item),
        pricing: {
            currency: "USD",
            subtotal,
            shipping,
            discount,
            tax,
            total,
        },
        payment: {
            method: paymentMethod,
            status: paymentMethod === "cod" ? "unpaid" : "pending",
            gateway: paymentMethod === "cod" ? "" : paymentMethod,
            currency: "USD",
        },
        fulfillmentStatus: "pending",
        tracking: {
            events: [buildTrackingEvent("pending", STATUS_MESSAGES.pending)],
        },
        customerNote: payload.customerNote || "",
    });

    try {
        await Promise.all(
            snapshotItems.map(async (item) => {
                const product = item._product;
                if (item._variant) {
                    const match = product.variants.find((variant) => variant === item._variant) ||
                        findMatchingVariant(product, toPlainAttributes(item.selectedAttributes));
                    if (match) match.stock = Math.max(0, (Number(match.stock) || 0) - item.quantity);
                    product.stock = product.variants.reduce((sum, variant) => sum + (Number(variant.stock) || 0), 0);
                } else {
                    product.stock = Math.max(0, (Number(product.stock) || 0) - item.quantity);
                }
                await product.save();
            })
        );
    } catch (error) {
        await Order.findByIdAndDelete(order._id);
        throw error;
    }

    res.status(201).json({
        success: true,
        message: "Order placed successfully",
        data: {
            ...order.toObject(),
            public: toPublicOrder(order),
        },
    });
});

export const trackOrder = catchAsync(async (req, res) => {
    const trackingId = String(req.params.trackingId || "").trim().toUpperCase();
    if (!trackingId) {
        throw new AppError(400, "Tracking ID is required");
    }

    const order = await Order.findOne({ trackingId });
    if (!order) {
        throw new AppError(404, "No order found for this tracking ID");
    }

    res.status(200).json({
        success: true,
        message: "Tracking details retrieved",
        data: toPublicOrder(order),
    });
});

export const getMyOrders = catchAsync(async (req, res) => {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 12), 40);
    const skip = (page - 1) * limit;

    const filter = {
        $or: [{ userId: req.user.id }, { "customer.email": req.user.email }],
    };

    const [orders, total] = await Promise.all([
        Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Order.countDocuments(filter),
    ]);

    res.status(200).json({
        success: true,
        message: "Orders retrieved successfully",
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
        data: orders,
    });
});

export const getAllOrders = catchAsync(async (req, res) => {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 50);
    const skip = (page - 1) * limit;
    const { search, fulfillmentStatus, paymentStatus } = req.query;
    const filter = {};

    if (fulfillmentStatus && ORDER_STATUS.includes(fulfillmentStatus)) {
        filter.fulfillmentStatus = fulfillmentStatus;
    }
    if (paymentStatus) filter["payment.status"] = paymentStatus;

    if (search?.trim()) {
        const term = search.trim();
        filter.$or = [
            { trackingId: new RegExp(term, "i") },
            { orderNumber: new RegExp(term, "i") },
            { "customer.name": new RegExp(term, "i") },
            { "customer.email": new RegExp(term, "i") },
            { "customer.phone": new RegExp(term, "i") },
        ];
    }

    const [orders, total] = await Promise.all([
        Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Order.countDocuments(filter),
    ]);

    res.status(200).json({
        success: true,
        message: "Orders retrieved successfully",
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
        data: orders,
    });
});

export const getOrderById = catchAsync(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw new AppError(404, "Order not found");

    const isAdmin = req.user?.role === "admin";
    const isOwner =
        order.userId === req.user?.id || order.customer?.email === req.user?.email;

    if (!isAdmin && !isOwner) {
        throw new AppError(403, "You do not have access to this order");
    }

    res.status(200).json({
        success: true,
        message: "Order retrieved successfully",
        data: isAdmin ? order : toPublicOrder(order),
    });
});

export const updateOrder = catchAsync(async (req, res) => {
    const payload = await updateOrderSchema.parseAsync(req.body);
    const order = await Order.findById(req.params.id);
    if (!order) throw new AppError(404, "Order not found");

    const previousStatus = order.fulfillmentStatus;
    const statusChanged =
        Boolean(payload.fulfillmentStatus) && payload.fulfillmentStatus !== previousStatus;

    if (statusChanged) {
        order.fulfillmentStatus = payload.fulfillmentStatus;
        if (payload.fulfillmentStatus === "cancelled") {
            order.cancelledAt = new Date();
            order.cancelReason = payload.cancelReason || order.cancelReason;
        }
        order.tracking.events.push(
            buildTrackingEvent(
                payload.fulfillmentStatus,
                payload.event?.message || STATUS_MESSAGES[payload.fulfillmentStatus],
                payload.event?.location
            )
        );
    } else if (payload.event?.message) {
        order.tracking.events.push(
            buildTrackingEvent(
                payload.event.status || order.fulfillmentStatus,
                payload.event.message,
                payload.event.location
            )
        );
    }

    if (payload.paymentStatus) {
        order.payment.status = payload.paymentStatus;
        if (payload.paymentStatus === "paid" && !order.payment.paidAt) {
            order.payment.paidAt = new Date();
            order.payment.amountPaid = order.pricing.total;
        }
        if (payload.paymentStatus === "refunded") {
            order.payment.refundedAt = new Date();
        }
    }

    if (payload.paymentMethod) {
        order.payment.method = payload.paymentMethod;
        if (!order.payment.gateway && payload.paymentMethod !== "cod") {
            order.payment.gateway = payload.paymentMethod;
        }
    }

    if (payload.notes !== undefined) order.notes = payload.notes;
    if (payload.cancelReason !== undefined) order.cancelReason = payload.cancelReason;

    if (payload.tracking) {
        if (payload.tracking.carrier !== undefined) order.tracking.carrier = payload.tracking.carrier;
        if (payload.tracking.carrierTrackingNumber !== undefined) {
            order.tracking.carrierTrackingNumber = payload.tracking.carrierTrackingNumber;
        }
        if (payload.tracking.estimatedDelivery) {
            const date = new Date(payload.tracking.estimatedDelivery);
            if (!Number.isNaN(date.getTime())) order.tracking.estimatedDelivery = date;
        }
    }

    await order.save();

    res.status(200).json({
        success: true,
        message: "Order updated successfully",
        data: order,
    });
});

export const deleteOrder = catchAsync(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw new AppError(404, "Order not found");

    const locked = ["shipped", "out_for_delivery", "delivered"].includes(order.fulfillmentStatus);
    if (locked) {
        throw new AppError(400, "Shipped or delivered orders cannot be deleted");
    }

    await order.deleteOne();

    res.status(200).json({
        success: true,
        message: "Order deleted successfully",
        data: { id: req.params.id },
    });
});
