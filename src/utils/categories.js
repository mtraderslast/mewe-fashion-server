export const CATEGORY_TREE = {
    Mens: ["Shirt", "Pant", "Shoes", "Watch"],
    Womens: ["Dress", "Burqa", "Hijab", "Facial Wash", "Moisturizer"],
    Kids: ["Shirt", "Pant", "Shoes", "Baby Cream"],
};

export const CATEGORY_VALUES = Object.keys(CATEGORY_TREE);

export const isValidSubCategory = (category, subCategory) =>
    !subCategory || (CATEGORY_TREE[category] || []).includes(subCategory);