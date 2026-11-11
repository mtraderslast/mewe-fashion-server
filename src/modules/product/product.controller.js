import mongoose from "mongoose";
import AppError from "../../utils/AppError.js";
import catchAsync from "../../utils/catchAsync.js";
import Product, { CATEGORY_TREE, CATEGORY_VALUES } from "./product.model.js";
import { createProductSchema, updateProductSchema } from "./product.validation.js";

const PRODUCT_SORT = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    "price-asc": { price: 1 },
    "price-desc": { price: -1 },
    title: { title: 1 },
};

const escapeRegex = (value = "") =>
    String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parsePositiveInt = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseBoolean = (value) => {
    if (value === true || value === "true") return true;
    if (value === false || value === "false") return false;
    return undefined;
};

const ensureValidId = (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError(400, "Invalid product ID");
    }
};

const buildProductFilter = (query = {}) => {
    const {
        search,
        category,
        subCategory,
        brand,
        status,
        isFeatured,
        showInDiscount,
        minPrice,
        maxPrice,
    } = query;

    const filter = {};

    if (status === "all") {
        // no status filter
    } else if (status) {
        filter.status = status;
    } else {
        filter.status = "active";
    }

    if (category) filter.category = category;
    if (subCategory) filter.subCategory = subCategory;

    if (brand) {
        filter.brand = new RegExp(escapeRegex(brand.trim()), "i");
    }

    const featured = parseBoolean(isFeatured);
    if (featured !== undefined) filter.isFeatured = featured;

    const discount = parseBoolean(showInDiscount);
    if (discount !== undefined) filter.showInDiscount = discount;

    const priceFilter = {};
    const min = Number(minPrice);
    const max = Number(maxPrice);

    if (minPrice !== undefined && minPrice !== "" && Number.isFinite(min)) {
        priceFilter.$gte = min;
    }
    if (maxPrice !== undefined && maxPrice !== "" && Number.isFinite(max)) {
        priceFilter.$lte = max;
    }
    if (Object.keys(priceFilter).length) {
        filter.price = priceFilter;
    }

    if (search?.trim()) {
        const regex = new RegExp(escapeRegex(search.trim()), "i");
        filter.$or = [
            { title: regex },
            { description: regex },
            { brand: regex },
            { tags: regex },
            { slug: regex },
            { category: regex },
            { subCategory: regex },
        ];
    }

    return filter;
};

export const createProduct = catchAsync(async (req, res) => {
    const validatedData = await createProductSchema.parseAsync(req.body);

    const existingProduct = await Product.findOne({ slug: validatedData.slug });
    if (existingProduct) {
        throw new AppError(400, "A product with this slug already exists");
    }

    const newProduct = await Product.create(validatedData);

    res.status(201).json({
        success: true,
        message: "New Product Created Successfully",
        data: newProduct,
    });
});

export const getAllProducts = catchAsync(async (req, res) => {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 48);
    const skip = (page - 1) * limit;
    const sort = PRODUCT_SORT[req.query.sort] || PRODUCT_SORT.newest;
    const filter = buildProductFilter(req.query);

    const [products, total] = await Promise.all([
        Product.find(filter).sort(sort).skip(skip).limit(limit),
        Product.countDocuments(filter),
    ]);

    res.status(200).json({
        success: true,
        message: "Products retrieved successfully",
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 0,
        },
        data: products,
    });
});

export const getCategorySummary = catchAsync(async (req, res) => {
    const grouped = await Product.aggregate([
        { $match: { status: "active" } },
        {
            $group: {
                _id: { category: "$category", subCategory: "$subCategory" },
                count: { $sum: 1 },
            },
        },
        { $sort: { "_id.category": 1, "_id.subCategory": 1 } },
    ]);

    const data = CATEGORY_VALUES.map((category) => {
        const items = grouped.filter((item) => item._id.category === category);

        return {
            category,
            total: items.reduce((sum, item) => sum + item.count, 0),
            subCategories: (CATEGORY_TREE[category] || []).map((subCategory) => ({
                name: subCategory,
                count:
                    items.find((item) => item._id.subCategory === subCategory)?.count || 0,
            })),
        };
    });

    res.status(200).json({
        success: true,
        message: "Category summary retrieved successfully",
        data,
    });
});

export const getProductById = catchAsync(async (req, res) => {
    const { id } = req.params;
    ensureValidId(id);

    const product = await Product.findById(id);
    if (!product) {
        throw new AppError(404, "Product not found");
    }

    res.status(200).json({
        success: true,
        message: "Product retrieved successfully",
        data: product,
    });
});

export const getProductDetails = catchAsync(async (req, res) => {
    const { slug } = req.params;

    const product = await Product.findOne({ slug, status: "active" });
    if (!product) {
        throw new AppError(404, "Product not found");
    }

    res.status(200).json({
        success: true,
        message: "Product details retrieved successfully",
        data: product,
    });
});

export const updateProduct = catchAsync(async (req, res) => {
    const { id } = req.params;
    ensureValidId(id);

    const validatedData = await updateProductSchema.parseAsync(req.body);

    if (validatedData.slug) {
        const slugTaken = await Product.findOne({
            slug: validatedData.slug,
            _id: { $ne: id },
        });

        if (slugTaken) {
            throw new AppError(400, "A product with this slug already exists");
        }
    }

    const updatedProduct = await Product.findByIdAndUpdate(id, validatedData, {
        new: true,
        runValidators: true,
    });

    if (!updatedProduct) {
        throw new AppError(404, "Product not found");
    }

    res.status(200).json({
        success: true,
        message: "Product updated successfully",
        data: updatedProduct,
    });
});

export const deleteProduct = catchAsync(async (req, res) => {
    const { id } = req.params;
    ensureValidId(id);

    const deletedProduct = await Product.findByIdAndDelete(id);
    if (!deletedProduct) {
        throw new AppError(404, "Product not found");
    }

    res.status(200).json({
        success: true,
        message: "Product deleted successfully",
        data: null,
    });
});
