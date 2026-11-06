const toNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

/**
 * প্রোডাক্ট (এবং ঐচ্ছিক ভ্যারিয়েন্ট) থেকে ইউনিট প্রাইস বের করে।
 *
 * নিয়ম:
 *  - প্রোডাক্টের `price` = মূল দাম, `discountPrice` = ডিসকাউন্ট দাম (ঐচ্ছিক)।
 *  - ভ্যারিয়েন্টে নিজস্ব `price` থাকলে সেটাই মূল দাম হবে, এবং তখন প্রোডাক্টের
 *    `discountPrice` প্রযোজ্য হবে না (শুধু ভ্যারিয়েন্টের নিজের `discountPrice`)।
 *  - ডিসকাউন্ট দাম মূল দামের চেয়ে কম হলেই কেবল প্রযোজ্য হবে।
 */
export const resolveUnitPrice = (product, variant = null) => {
    const variantPrice = toNumber(variant?.price);
    const variantDiscount = toNumber(variant?.discountPrice);

    const basePrice = variantPrice > 0 ? variantPrice : toNumber(product?.price);

    let discountPrice = 0;
    if (variantDiscount > 0) {
        discountPrice = variantDiscount;
    } else if (variantPrice <= 0) {
        discountPrice = toNumber(product?.discountPrice);
    }

    const hasDiscount = discountPrice > 0 && discountPrice < basePrice;

    return {
        basePrice,
        finalPrice: hasDiscount ? discountPrice : basePrice,
        hasDiscount,
    };
};

/**
 * ভ্যারিয়েন্ট খোঁজে — প্রথমে SKU দিয়ে, না পেলে অ্যাট্রিবিউট (যেমন { Size: "42" }) দিয়ে।
 * Mongoose Map হলে সেটিও সাপোর্ট করে।
 */
export const findVariant = (product, { sku, attributes } = {}) => {
    const variants = product?.variants || [];
    if (!variants.length) return null;

    if (sku) {
        const bySku = variants.find((v) => v.sku && v.sku === sku);
        if (bySku) return bySku;
    }

    const entries = Object.entries(attributes || {});
    if (!entries.length) return null;

    return (
        variants.find((v) => {
            const attrs = v.attributes instanceof Map ? Object.fromEntries(v.attributes) : v.attributes || {};
            return entries.every(([key, val]) => attrs[key] === val);
        }) || null
    );
};
