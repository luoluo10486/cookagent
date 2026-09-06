package com.foodmate.application.food.service;

import java.util.Locale;
import java.util.Set;

/** 统一食材查询的空白、大小写和烹饪前缀处理，保留生熟形态差异。 */
public final class NutritionNameNormalizer {
    private static final Set<String> COOKING_PREFIXES =
            Set.of("煮", "蒸", "烤", "炒", "煎", "炖", "焯", "卤", "煮熟", "烤熟");

    private NutritionNameNormalizer() {}

    public static String normalize(String value) {
        if (value == null) return "";
        String normalized = value.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
        for (String prefix : COOKING_PREFIXES) {
            if (normalized.startsWith(prefix) && normalized.length() > prefix.length()) {
                return normalized.substring(prefix.length()).trim();
            }
        }
        return normalized;
    }

    /** 将用户查询转为 LIKE 安全参数，避免用户输入扩大 SQL 通配范围。 */
    public static String escapeLike(String value) {
        return normalize(value).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
