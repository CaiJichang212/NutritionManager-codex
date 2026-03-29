from __future__ import annotations

import json
from typing import Dict, Tuple, List

from .models import User, Food, DietRecordItem


def compute_bmr_tdee(user: User) -> Tuple[float, float]:
    if not user.weight or not user.height or not user.age:
        return 0.0, 0.0
    base = 10 * user.weight + 6.25 * user.height - 5 * user.age
    if user.gender == "女":
        bmr = base - 161
    else:
        bmr = base + 5

    factor_map = {
        "久坐": 1.2,
        "轻度活动": 1.375,
        "中度活动": 1.55,
        "高度活动": 1.725,
        "极度活动": 1.9,
    }
    factor = factor_map.get(user.activity_level or "久坐", 1.2)
    tdee = bmr * factor
    return round(bmr, 1), round(tdee, 1)


def compute_bmi(user: User) -> Tuple[float, str]:
    if not user.weight or not user.height:
        return 0.0, ""
    height_m = user.height / 100
    bmi = user.weight / (height_m * height_m)
    if bmi < 18.5:
        category = "偏轻"
    elif bmi < 24:
        category = "正常"
    elif bmi < 28:
        category = "超重"
    else:
        category = "肥胖"
    return round(bmi, 1), category


def compute_daily_goal(user: User, tdee: float) -> float:
    goal = user.goal_type or "减脂"
    if goal == "增肌":
        return round(tdee + 300)
    if goal == "健康管理":
        return round(tdee)
    if goal == "维持":
        return round(tdee)
    return round(tdee - 400)


def compute_macro_targets(user: User) -> Dict[str, float]:
    weight = user.weight or 60
    daily_cal = user.daily_calorie_goal or 1800
    goal = user.goal_type or "减脂"
    if goal == "增肌":
        protein = weight * 1.8
    elif goal == "健康管理":
        protein = weight * 1.2
    elif goal == "维持":
        protein = weight * 1.2
    else:
        protein = weight * 1.6

    fat = daily_cal * 0.25 / 9
    carbs = max((daily_cal - protein * 4 - fat * 9) / 4, 0)
    return {
        "protein": round(protein, 1),
        "fat": round(fat, 1),
        "carbs": round(carbs, 1),
        "fiber": 25,
        "sodium": 2000,
        "sugar": 50,
        "sat_fat": 20,
    }


def compute_user_metrics(user: User) -> None:
    bmr, tdee = compute_bmr_tdee(user)
    bmi, category = compute_bmi(user)
    user.bmr = bmr
    user.tdee = tdee
    user.bmi = bmi
    user.bmi_category = category
    user.daily_calorie_goal = compute_daily_goal(user, tdee)
    user.nutrition_goals = json.dumps(compute_macro_targets(user), ensure_ascii=False)


def snapshot_from_food(food: Food, amount: float) -> Dict[str, float]:
    factor = amount / 100
    return {
        "calories": round(food.calories * factor, 1),
        "protein": round(food.protein * factor, 1),
        "fat": round(food.fat * factor, 1),
        "carbs": round(food.carbs * factor, 1),
        "fiber": round((food.fiber or 0) * factor, 1),
        "sugar": round((food.sugar or 0) * factor, 1),
        "sodium": round((food.sodium or 0) * factor, 1),
    }


def aggregate_items(items: List[DietRecordItem]) -> Dict[str, float]:
    totals = {
        "calories": 0.0,
        "protein": 0.0,
        "fat": 0.0,
        "carbs": 0.0,
        "fiber": 0.0,
        "sugar": 0.0,
        "sodium": 0.0,
    }
    for item in items:
        totals["calories"] += item.calories
        totals["protein"] += item.protein
        totals["fat"] += item.fat
        totals["carbs"] += item.carbs
        totals["fiber"] += item.fiber or 0
        totals["sugar"] += item.sugar or 0
        totals["sodium"] += item.sodium or 0
    return {k: round(v, 1) for k, v in totals.items()}


def compute_health_score(avg_food_score: float, totals: Dict[str, float], goals: Dict[str, float]) -> Dict[str, float]:
    nutrition = 20
    additives = 20
    processing = 20
    sodium = 20
    sugar = 20

    if avg_food_score >= 8:
        additives = 24
        processing = 24
    elif avg_food_score >= 6:
        additives = 20
        processing = 20
    else:
        additives = 12
        processing = 12

    sodium_pct = totals.get("sodium", 0) / (goals.get("sodium", 2000) or 1)
    sugar_pct = totals.get("sugar", 0) / (goals.get("sugar", 50) or 1)
    if sodium_pct > 1.1:
        sodium = 10
    elif sodium_pct < 0.7:
        sodium = 18
    else:
        sodium = 22

    if sugar_pct > 1.1:
        sugar = 10
    elif sugar_pct < 0.7:
        sugar = 18
    else:
        sugar = 22

    protein_pct = totals.get("protein", 0) / (goals.get("protein", 120) or 1)
    if protein_pct >= 0.9:
        nutrition = 24
    elif protein_pct >= 0.7:
        nutrition = 20
    else:
        nutrition = 14

    score = round((nutrition + additives + processing + sodium + sugar) / 10, 1)
    return {
        "score": score,
        "nutrition": nutrition,
        "additives": additives,
        "processing": processing,
        "sodium": sodium,
        "sugar": sugar,
    }
