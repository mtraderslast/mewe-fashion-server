import { z } from "zod";
import { CATEGORY_TREE, CATEGORY_VALUES, VARIANT_FIELDS } from "./product.model.js";

const optionalText = z.string().trim().min(1).max(50).optional();

const priceField = z.number().positive("Price must be greater than 0");

const discountPriceField = z
    .number()
    .nonnegative("Discount price cannot be negative")
    .nullable()
    .optional();


const variantSchema = z.object({
    size: optionalText,
    color: optionalText,
    scent: optionalText,
    volume: optionalText,
    price: priceField,
    discountPrice: discountPriceField,
    stock: z.number().int("Stock must be an integer").min(0, "Stock cannot be negative").optional(),
    sku: z.string().trim().min(1).max(50).optional(),
});


const productBaseSchema = z.object({
    title: z.string().trim().min(3, "Title must be at least 3 characters").max(150),
    slug: z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug can only contain lowercase letters, numbers and hyphens"),
    description: z.string().trim().min(10, "Description must be at least 10 characters"),

    category: z.enum(CATEGORY_VALUES, { message: "Invalid category" }),
    subCategory: z.string().trim().min(1, "Sub category is required"),
    brand: z.string().trim().max(80).optional(),

    price: priceField,
    discountPrice: discountPriceField,
    stock: z.number().int("Stock must be an integer").min(0, "Stock cannot be negative").optional(),
    images: z.array(z.string().trim().url("Invalid image URL")).max(10, "Maximum 10 images allowed").optional(),
    variants: z.array(variantSchema).optional(),

    isFeatured: z.boolean().optional(),
    showInDiscount: z.boolean().optional(),
    showSimilar: z.boolean().optional(),

    status: z.enum(["active", "draft"]).optional(),
    tags: z.array(z.string().trim().toLowerCase().min(1).max(30)).max(20).optional(),
});


const checkProductRules = (data, ctx) => {
    const { category, subCategory, price, discountPrice, variants } = data;
    const addError = (path, message) => ctx.addIssue({ code: "custom", path, message });

    if (Boolean(category) !== Boolean(subCategory)) {
        addError(["subCategory"], "Category and sub category must be provided together");
    }

    if (category && subCategory && !CATEGORY_TREE[category]?.includes(subCategory)) {
        addError(["subCategory"], `"${subCategory}" is not valid for category "${category}"`);
    }

    if (discountPrice != null && price != null && discountPrice >= price) {
        addError(["discountPrice"], "Discount price must be less than price");
    }

    if (variants?.length) {
        const requiredFields = subCategory ? VARIANT_FIELDS[subCategory] ?? [] : [];
        const seenSkus = new Set();

        variants.forEach((variant, i) => {
            requiredFields.forEach((field) => {
                if (!variant[field]) {
                    addError(["variants", i, field], `${field} is required for ${subCategory}`);
                }
            });

            if (variant.discountPrice != null && variant.discountPrice >= variant.price) {
                addError(["variants", i, "discountPrice"], "Variant discount price must be less than its price");
            }

            if (variant.sku) {
                if (seenSkus.has(variant.sku)) {
                    addError(["variants", i, "sku"], `Duplicate SKU "${variant.sku}"`);
                }
                seenSkus.add(variant.sku);
            }
        });
    }
};


export const createProductSchema = productBaseSchema.superRefine(checkProductRules);

export const updateProductSchema = productBaseSchema
    .partial()
    .superRefine(checkProductRules)
    .refine((data) => Object.keys(data).length > 0, { message: "At least one field is required to update" });
