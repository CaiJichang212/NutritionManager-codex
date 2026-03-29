from __future__ import annotations

import json
from datetime import date as date_type, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..auth import get_current_user
from ..models import DietRecord, DietRecordItem, User
from ..schemas import NutritionSummary, NutritionMacro, NutritionFocus, NutritionReminder, HealthScore, HealthDimension
from ..utils import aggregate_items, compute_macro_targets, compute_health_score

router = APIRouter(prefix="/nutrition", tags=["nutrition"])


def _get_items(db: Session, user_id: int, record_date: date_type) -> list[DietRecordItem]:
    records = (
        db.query(DietRecord)
        .filter(DietRecord.user_id == user_id, DietRecord.date == record_date)
        .all()
    )
    items: list[DietRecordItem] = []
    for record in records:
        items.extend(record.items)
    return items


@router.get("/summary", response_model=NutritionSummary)
def get_summary(
    date: date_type | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record_date = date or date_type.today()
    items = _get_items(db, current_user.id, record_date)
    totals = aggregate_items(items)

    goals = json.loads(current_user.nutrition_goals) if current_user.nutrition_goals else compute_macro_targets(current_user)

    avg_food_score = 0.0
    if items:
        avg_food_score = sum(item.food.health_score or 0 for item in items) / len(items)

    health = compute_health_score(avg_food_score, totals, goals)

    macros = [
        NutritionMacro(
            key="protein",
            name="蛋白质",
            consumed=totals["protein"],
            target=goals.get("protein", 120),
            unit="g",
            color="#3b82f6",
            tip="增肌关键",
        ),
        NutritionMacro(
            key="fat",
            name="脂肪",
            consumed=totals["fat"],
            target=goals.get("fat", 60),
            unit="g",
            color="#f59e0b",
            tip="优先不饱和脂肪",
        ),
        NutritionMacro(
            key="carbs",
            name="碳水",
            consumed=totals["carbs"],
            target=goals.get("carbs", 220),
            unit="g",
            color="#8b5cf6",
            tip="主要能量来源",
        ),
        NutritionMacro(
            key="fiber",
            name="膳食纤维",
            consumed=totals["fiber"],
            target=goals.get("fiber", 25),
            unit="g",
            color="#10b981",
            tip="促进消化",
        ),
    ]

    focus = [
        NutritionFocus(label="添加糖", consumed=totals["sugar"], target=goals.get("sugar", 50), unit="g"),
        NutritionFocus(label="钠摄入", consumed=totals["sodium"], target=goals.get("sodium", 2000), unit="mg"),
        NutritionFocus(label="饱和脂肪", consumed=0.0, target=goals.get("sat_fat", 20), unit="g"),
    ]

    reminders: list[NutritionReminder] = []
    protein_pct = totals["protein"] / (goals.get("protein", 120) or 1)
    if protein_pct < 0.7:
        reminders.append(NutritionReminder(type="warn", text="蛋白质摄入不足 70%，建议晚餐增加蛋白质食物"))
    else:
        reminders.append(NutritionReminder(type="ok", text=f"热量摄入良好，距目标还有 {round((current_user.daily_calorie_goal or 0) - totals['calories'])} kcal"))

    weekly = []
    for i in range(6, -1, -1):
        day = record_date - timedelta(days=i)
        day_items = _get_items(db, current_user.id, day)
        day_totals = aggregate_items(day_items)
        label = "今天" if day == record_date else f"周{['一','二','三','四','五','六','日'][day.weekday()]}"
        weekly.append({"day": label, "val": day_totals["calories"], "target": current_user.daily_calorie_goal or 1800})

    radar = [
        {"subject": "蛋白质", "A": min(int((totals["protein"] / (goals.get("protein", 120) or 1)) * 100), 100), "fullMark": 100},
        {"subject": "脂肪", "A": min(int((totals["fat"] / (goals.get("fat", 60) or 1)) * 100), 100), "fullMark": 100},
        {"subject": "碳水", "A": min(int((totals["carbs"] / (goals.get("carbs", 220) or 1)) * 100), 100), "fullMark": 100},
        {"subject": "纤维", "A": min(int((totals["fiber"] / (goals.get("fiber", 25) or 1)) * 100), 100), "fullMark": 100},
        {"subject": "维生素", "A": 82, "fullMark": 100},
        {"subject": "矿物质", "A": 68, "fullMark": 100},
    ]

    health_score = HealthScore(
        score=health["score"],
        level="优秀" if health["score"] >= 8 else "良好" if health["score"] >= 6 else "一般",
        dimensions=[
            HealthDimension(label="营养配比", score=health["nutrition"], max=30),
            HealthDimension(label="添加剂", score=health["additives"], max=25),
            HealthDimension(label="加工程度", score=health["processing"], max=20),
            HealthDimension(label="钠含量", score=health["sodium"], max=15),
            HealthDimension(label="糖含量", score=health["sugar"], max=10),
        ],
    )

    calorie_target = current_user.daily_calorie_goal or 1800
    calorie_remaining = round(calorie_target - totals["calories"], 1)

    return NutritionSummary(
        date=record_date,
        calorie_consumed=totals["calories"],
        calorie_target=calorie_target,
        calorie_remaining=calorie_remaining,
        bmr=current_user.bmr or 0,
        tdee=current_user.tdee or 0,
        macros=macros,
        focus=focus,
        reminders=reminders,
        health_score=health_score,
        weekly_calories=weekly,
        radar=radar,
    )
