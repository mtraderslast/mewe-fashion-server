export const CATEGORY_TREE = {
    Clothing: ["Burqa", "Abaya", "Hijab", "Niqab", "Hand Socks", "Foot Socks"],
    Fragrance: ["Perfume", "Body Spray"],
    Accessories: ["Watch"],
    "Skin Care": ["Moisturizer", "Sunscreen", "Acne Face Wash", "Gentle Cleanser"],
    "Hair Care": ["Shampoo"],
    "Body Care": ["Body Wash", "Body Lotion"],
    "Baby Care": ["Baby Cream", "Baby Lotion"],
};

export const CATEGORY_VALUES = Object.keys(CATEGORY_TREE);

export const isValidSubCategory = (category, subCategory) =>
    !subCategory || (CATEGORY_TREE[category] || []).includes(subCategory);
