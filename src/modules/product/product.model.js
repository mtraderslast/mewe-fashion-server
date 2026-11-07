import mongoose from "mongoose";

export const CATEGORY_TREE = {
    Mens: ["Shirt", "Pant", "Shoes", "Watch", "Perfume"],
    Womens: ["Dress", "Burqa", "Hijab", "Facial Wash", "Moisturizer"],
    Kids: ["kids-shirt", "kids-pant", "kids-shoes", "Baby Cream"],
};

export const CATEGORY_VALUES = Object.keys(CATEGORY_TREE);

export const VARIANT_FIELDS = {
    Shirt: ["size", "color"],
    Pant: ["size", "color"],
    Shoes: ["size", "color"],
    Dress: ["size", "color"],
    Burqa: ["size", "color"],
    Hijab: ["color"],
    Watch: ["color"],
    Perfume: ["volume", "scent"],
    "Facial Wash": ["volume"],
    Moisturizer: ["volume"],
    "Baby Cream": ["volume"],
    "kids-shirt": ["size", "color"],
    "kids-pant": ["size", "color"],
    "kids-shoes": ["size", "color"],
};

const variantSchema = new mongoose.Schema(
    {
        size: String,
        color: String,
        scent: String,
        volume: String,
        price: Number,
        discountPrice: { type: Number, default: null },
        stock: { type: Number, default: 0 },
        sku: String,
    },
    { _id: false }
);

const productSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
        description: { type: String, required: true, trim: true },

        category: { type: String, required: true, enum: CATEGORY_VALUES, index: true },
        subCategory: { type: String, required: true, index: true },
        brand: { type: String, trim: true },

        price: { type: Number, required: true },
        discountPrice: { type: Number, default: null },
        stock: { type: Number, default: 0 },
        images: { type: [String], default: [] },
        variants: { type: [variantSchema], default: [] },

        isFeatured: { type: Boolean, default: false },
        showInDiscount: { type: Boolean, default: false },
        showSimilar: { type: Boolean, default: true },

        status: { type: String, enum: ["active", "draft"], default: "active" },
        tags: { type: [String], default: [] },
    },
    { timestamps: true, versionKey: false }
);

productSchema.index({ title: "text", tags: "text" });
productSchema.index({ status: 1, showInDiscount: 1 });

const Product = mongoose.model("Product", productSchema);
export default Product;