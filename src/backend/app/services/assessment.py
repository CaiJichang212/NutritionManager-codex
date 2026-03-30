from __future__ import annotations

import json
from typing import Any

from ..models import DietRecordItem, Food, User
from sqlalchemy.orm import Session

ALLERGEN_ALIASES: dict[str, list[str]] = {
    "麸质谷物": ["麸质", "小麦", "黑麦", "大麦", "燕麦", "面筋", "麦芽"],
    "甲壳类": ["甲壳", "虾", "蟹", "龙虾"],
    "鱼类": ["鱼"],
    "蛋类": ["蛋", "鸡蛋", "蛋白", "蛋黄"],
    "花生": ["花生"],
    "大豆": ["大豆", "黄豆", "豆制品", "豆浆"],
    "乳制品": ["乳", "牛奶", "奶粉", "奶酪", "乳清", "乳糖"],
    "坚果": ["坚果", "杏仁", "腰果", "核桃", "榛子", "开心果"],
    "芝麻": ["芝麻"],
}


def clamp_score(value: float) -> float:
    return round(max(0.0, min(10.0, value)), 1)


def score_level(score: float) -> tuple[str, str]:
    if score >= 8:
        return "优秀", "适合"
    if score >= 6:
        return "良好", "可选"
    if score >= 4:
        return "一般", "谨慎"
    return "较差", "不建议"


def normalize_allergen_terms(values: list[str]) -> list[str]:
    merged = " ".join(v for v in values if v).replace("无已知过敏", "").replace("无过敏", "")
    result: list[str] = []
    for canonical, aliases in ALLERGEN_ALIASES.items():
        if canonical in merged or any(alias in merged for alias in aliases):
            result.append(canonical)
    return list(dict.fromkeys(result))


def resolve_allergen_risk(food: Food, current_user: User | None = None) -> dict[str, Any]:
    allergens = json.loads(food.allergens) if food.allergens else []
    food_allergens = normalize_allergen_terms([str(x) for x in allergens])
    user_allergies_raw = json.loads(current_user.allergies) if current_user and current_user.allergies else []
    user_allergies = normalize_allergen_terms([str(x) for x in user_allergies_raw])
    hit = [x for x in food_allergens if x in user_allergies]
    risk_level = "high" if hit else ("low" if food_allergens else "none")
    alerts: list[str] = []
    if hit:
        alerts.append(f"检测到您的过敏项：{'、'.join(hit)}，请避免食用")
    elif food_allergens:
        alerts.append(f"本食品含过敏原：{'、'.join(food_allergens)}")
    if current_user and user_allergies and not hit and food_allergens:
        alerts.append("未命中您已登记的过敏史，但如有不适请谨慎食用")
    return {
        "food_allergens": food_allergens,
        "user_allergies": user_allergies,
        "hit": hit,
        "risk_level": risk_level,
        "alerts": alerts,
    }


def build_food_population_assessments(food: Food, current_user: User | None = None) -> list[dict[str, Any]]:
    calorie_density = float(food.calories or 0)
    protein_density = (float(food.protein or 0) / calorie_density * 100.0) if calorie_density > 0 else 0.0
    fiber = float(food.fiber or 0)
    gi = float(food.glycemic_index or 0)
    gl = float(food.glycemic_load or 0)
    sodium = float(food.sodium or 0)
    potassium = float(food.potassium or 0)
    protein_quality = float(food.protein_quality or 0)

    wl = float(food.weight_loss_score or 0)
    if wl <= 0:
        wl = 5.5
        wl += 1.8 if calorie_density <= 150 else -1.2
        wl += 1.2 if protein_density >= 8 else -0.8
        wl += 0.8 if fiber >= 3 else -0.5
    wl = clamp_score(wl)

    mg = float(food.muscle_gain_score or 0)
    if mg <= 0:
        mg = 5.5
        mg += 2.0 if float(food.protein or 0) >= 20 else -1.2
        mg += 1.0 if protein_quality >= 0.8 else -0.6
    mg = clamp_score(mg)

    dm = float(food.diabetes_score or 0)
    if dm <= 0:
        dm = 5.5
        dm += 1.5 if 0 < gi <= 55 else (-1.2 if gi > 70 else 0.2)
        dm += 1.2 if 0 < gl <= 10 else (-1.0 if gl >= 20 else 0.1)
        dm += 0.8 if fiber >= 3 else -0.6
        dm += 0.8 if float(food.sugar or 0) <= 5 else -0.8
    dm = clamp_score(dm)

    htn = float(food.hypertension_score or 0)
    if htn <= 0:
        htn = 5.5
        htn += 2.0 if sodium <= 120 else (0.5 if sodium <= 200 else -1.6)
        htn += 1.2 if potassium >= 300 else (0.4 if potassium >= 150 else -0.6)
    htn = clamp_score(htn)

    allergy = resolve_allergen_risk(food, current_user)
    al_score = 2.0 if allergy["risk_level"] == "high" else 6.0 if allergy["risk_level"] == "low" else 9.0

    data: list[dict[str, Any]] = []
    for key, name, score, highlights in [
        (
            "weight_loss",
            "减脂",
            wl,
            [
                f"热量密度 {round(calorie_density, 1)} kcal/100g",
                f"蛋白质密度 {round(protein_density, 1)} g/100kcal",
                f"膳食纤维 {round(fiber, 1)} g/100g",
            ],
        ),
        (
            "muscle_gain",
            "增肌",
            mg,
            [
                f"蛋白质 {round(float(food.protein or 0), 1)} g/100g",
                f"蛋白质质量(BV代理) {round(protein_quality * 100, 0):.0f}",
                "建议结合训练前后 2 小时摄入",
            ],
        ),
        (
            "diabetes",
            "糖尿病",
            dm,
            [
                f"GI {round(gi, 1)}",
                f"GL {round(gl, 1)}",
                f"糖 {round(float(food.sugar or 0), 1)} g/100g",
            ],
        ),
        (
            "hypertension",
            "高血压",
            htn,
            [
                f"钠 {round(sodium, 1)} mg/100g",
                f"钾 {round(potassium, 1)} mg/100g",
                "建议保持低钠高钾搭配",
            ],
        ),
        (
            "allergy",
            "过敏",
            al_score,
            allergy["alerts"][:2] if allergy["alerts"] else ["未检测到明确过敏风险提示"],
        ),
    ]:
        level, status = score_level(score)
        if key == "allergy" and allergy["risk_level"] == "high":
            level, status = "高风险", "不建议"
        elif key == "allergy" and allergy["risk_level"] == "low":
            level, status = "中风险", "谨慎"
        elif key == "allergy" and allergy["risk_level"] == "none":
            level, status = "低风险", "适合"
        data.append(
            {
                "key": key,
                "name": name,
                "score": score,
                "level": level,
                "status": status,
                "highlights": highlights,
            }
        )
    return data


def _weighted_food_score(items: list[DietRecordItem], field: str, default: float = 6.5) -> float:
    total_weight = 0.0
    weighted_sum = 0.0
    for item in items:
        w = float(item.amount or 0)
        score = getattr(item.food, field, None)
        if score is None:
            score = default
        weighted_sum += float(score) * max(w, 1)
        total_weight += max(w, 1)
    if total_weight <= 0:
        return default
    return clamp_score(weighted_sum / total_weight)


def build_daily_population_assessments(
    items: list[DietRecordItem],
    totals: dict[str, float],
    goals: dict[str, float],
    current_user: User,
) -> list[dict[str, Any]]:
    if not items:
        fallback = []
        for key, name in [
            ("weight_loss", "减脂"),
            ("muscle_gain", "增肌"),
            ("diabetes", "糖尿病"),
            ("hypertension", "高血压"),
            ("allergy", "过敏"),
        ]:
            fallback.append(
                {
                    "key": key,
                    "name": name,
                    "score": 5.0,
                    "level": "数据不足",
                    "status": "待评估",
                    "highlights": ["暂无当日饮食记录，无法完成评估"],
                }
            )
        return fallback

    total_amount = sum(float(item.amount or 0) for item in items)
    calorie_density = (totals.get("calories", 0.0) / total_amount * 100.0) if total_amount > 0 else 0.0
    protein_density = (
        totals.get("protein", 0.0) / max(totals.get("calories", 0.0), 1.0) * 100.0
    )
    gi_values = [float(item.food.glycemic_index or 0) for item in items if (item.food.glycemic_index or 0) > 0]
    gl_values = [float(item.food.glycemic_load or 0) for item in items if (item.food.glycemic_load or 0) > 0]
    avg_gi = sum(gi_values) / len(gi_values) if gi_values else 0.0
    avg_gl = sum(gl_values) / len(gl_values) if gl_values else 0.0
    potassium_total = 0.0
    for item in items:
        potassium_total += float(item.food.potassium or 0) * float(item.amount or 0) / 100.0

    wl = _weighted_food_score(items, "weight_loss_score")
    wl += 0.8 if calorie_density <= 150 else -0.8
    wl += 0.6 if protein_density >= 8 else -0.6
    wl += 0.6 if totals.get("fiber", 0) >= goals.get("fiber", 25) * 0.6 else -0.4
    wl = clamp_score(wl)

    mg = _weighted_food_score(items, "muscle_gain_score")
    mg += 0.8 if totals.get("protein", 0) >= (goals.get("protein", 120) * 0.7) else -0.7
    mg = clamp_score(mg)

    dm = _weighted_food_score(items, "diabetes_score")
    dm += 0.8 if 0 < avg_gi <= 55 else (-0.7 if avg_gi > 70 else 0.2)
    dm += 0.6 if 0 < avg_gl <= 10 else (-0.6 if avg_gl >= 20 else 0.1)
    dm += 0.6 if totals.get("fiber", 0) >= goals.get("fiber", 25) * 0.7 else -0.5
    dm += 0.6 if totals.get("sugar", 0) <= goals.get("sugar", 50) else -0.8
    dm = clamp_score(dm)

    htn = _weighted_food_score(items, "hypertension_score")
    htn += 1.0 if totals.get("sodium", 0) <= goals.get("sodium", 2000) else -1.0
    htn += 0.8 if potassium_total >= 1800 else (-0.6 if potassium_total < 1000 else 0.2)
    htn = clamp_score(htn)

    user_allergies = normalize_allergen_terms(
        [str(x) for x in (json.loads(current_user.allergies) if current_user.allergies else [])]
    )
    eaten_allergens: list[str] = []
    for item in items:
        allergens = json.loads(item.food.allergens) if item.food.allergens else []
        eaten_allergens.extend(normalize_allergen_terms([str(x) for x in allergens]))
    eaten_allergens = list(dict.fromkeys(eaten_allergens))
    allergy_hits = [x for x in eaten_allergens if x in user_allergies]
    al_score = 2.0 if allergy_hits else 6.0 if eaten_allergens else 9.0

    assessments = []
    for key, name, score, highlights in [
        (
            "weight_loss",
            "减脂",
            wl,
            [
                f"当日热量密度 {round(calorie_density, 1)} kcal/100g",
                f"当日蛋白质密度 {round(protein_density, 1)} g/100kcal",
                f"当日纤维 {round(totals.get('fiber', 0), 1)}g",
            ],
        ),
        (
            "muscle_gain",
            "增肌",
            mg,
            [
                f"当日蛋白质 {round(totals.get('protein', 0), 1)}g / 目标 {round(goals.get('protein', 120), 1)}g",
                "建议每 3-4 小时补充一次优质蛋白",
            ],
        ),
        (
            "diabetes",
            "糖尿病",
            dm,
            [
                f"均值 GI {round(avg_gi, 1)}，均值 GL {round(avg_gl, 1)}",
                f"当日糖 {round(totals.get('sugar', 0), 1)}g，纤维 {round(totals.get('fiber', 0), 1)}g",
            ],
        ),
        (
            "hypertension",
            "高血压",
            htn,
            [
                f"当日钠 {round(totals.get('sodium', 0), 1)}mg / 目标 {round(goals.get('sodium', 2000), 1)}mg",
                f"当日钾约 {round(potassium_total, 1)}mg",
            ],
        ),
        (
            "allergy",
            "过敏",
            al_score,
            [f"当日涉及过敏原：{'、'.join(eaten_allergens) if eaten_allergens else '无'}"],
        ),
    ]:
        level, status = score_level(score)
        if key == "allergy" and allergy_hits:
            level, status = "高风险", "不建议"
            highlights = [f"命中个人过敏项：{'、'.join(allergy_hits)}，建议立即规避"]
        elif key == "allergy" and eaten_allergens:
            level, status = "中风险", "谨慎"
            highlights = [f"存在过敏原：{'、'.join(eaten_allergens)}，请核对个人过敏史"]
        elif key == "allergy":
            level, status = "低风险", "适合"
        assessments.append(
            {
                "key": key,
                "name": name,
                "score": score,
                "level": level,
                "status": status,
                "highlights": highlights[:3],
            }
        )
    return assessments


def _goal_score_field(current_user: User) -> tuple[str, str]:
    conditions_raw = json.loads(current_user.health_conditions) if current_user.health_conditions else []
    conditions = " ".join(str(x) for x in conditions_raw)
    if current_user.goal_type == "减脂":
        return "weight_loss_score", "更符合减脂目标"
    if current_user.goal_type == "增肌":
        return "muscle_gain_score", "更符合增肌目标"
    if "糖尿病" in conditions or "血糖" in conditions:
        return "diabetes_score", "更适合控糖人群"
    if "高血压" in conditions or "血压" in conditions:
        return "hypertension_score", "更适合控压人群"
    return "health_score", "综合健康评分更优"


def build_food_alternative_recommendations(
    db: Session,
    food: Food,
    current_user: User,
    limit: int = 3,
) -> list[dict[str, Any]]:
    if float(food.health_score or 0) >= 7:
        return []

    goal_field, goal_reason = _goal_score_field(current_user)
    allergy = resolve_allergen_risk(food, current_user)
    user_allergies = allergy["user_allergies"]

    def find_candidates(same_category: bool) -> list[Food]:
        q = db.query(Food).filter(Food.id != food.id, Food.health_score.isnot(None), Food.health_score >= 7.0)
        if same_category and food.category:
            q = q.filter(Food.category == food.category)
        return q.limit(80).all()

    passed: list[Food] = []

    def append_safe(candidates: list[Food]) -> None:
        for item in candidates:
            if any(x.id == item.id for x in passed):
                continue
            item_risk = resolve_allergen_risk(item, current_user)
            if item_risk["risk_level"] == "high":
                continue
            if user_allergies and any(x in user_allergies for x in item_risk["food_allergens"]):
                continue
            passed.append(item)

    append_safe(find_candidates(same_category=True))
    if len(passed) < limit:
        append_safe(find_candidates(same_category=False))

    def rank_key(item: Food) -> tuple[float, float]:
        goal_score = getattr(item, goal_field, None)
        if goal_score is None:
            goal_score = item.health_score or 0
        return float(goal_score), float(item.health_score or 0)

    sorted_items = sorted(passed, key=rank_key, reverse=True)[:limit]
    out: list[dict[str, Any]] = []
    for item in sorted_items:
        goal_score = getattr(item, goal_field, None)
        if goal_score is None:
            goal_score = item.health_score or 0
        out.append(
            {
                "id": item.id,
                "name": item.name,
                "brand": item.brand,
                "category": item.category,
                "image": item.image,
                "health_score": round(float(item.health_score or 0), 1),
                "goal_score": round(float(goal_score), 1),
                "reason": (
                    f"同类更高分（{round(float(item.health_score or 0), 1)}分），{goal_reason}"
                    if item.category == food.category
                    else f"同目标替代（{round(float(item.health_score or 0), 1)}分），{goal_reason}"
                ),
            }
        )
    return out
