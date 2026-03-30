from __future__ import annotations

import json
from datetime import date as date_type, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db import get_db
from ..models import DietRecord, DietRecordItem, User
from ..schemas import (
    CategoryDistributionItem,
    DailyReportResponse,
    MonthWeekMetric,
    MonthlyReportResponse,
    ReportDayMetric,
    ReportMealItem,
    ReportSummaryCard,
    WeeklyReportResponse,
)
from ..utils import aggregate_items, compute_health_score, compute_macro_targets

router = APIRouter(prefix="/reports", tags=["reports"])


def _get_items(db: Session, user_id: int, day: date_type) -> list[DietRecordItem]:
    records = db.query(DietRecord).filter(DietRecord.user_id == user_id, DietRecord.date == day).all()
    items: list[DietRecordItem] = []
    for record in records:
        items.extend(record.items)
    return items


def _safe_goals(user: User) -> dict:
    if user.nutrition_goals:
        try:
            parsed = json.loads(user.nutrition_goals)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass
    return compute_macro_targets(user)


def _day_stat(db: Session, user: User, day: date_type) -> dict:
    items = _get_items(db, user.id, day)
    totals = aggregate_items(items)
    goals = _safe_goals(user)
    avg_food_score = sum(item.food.health_score or 0 for item in items) / len(items) if items else 0.0
    score = compute_health_score(avg_food_score, totals, goals)["score"] if items else 0.0
    return {"items": items, "totals": totals, "score": score, "goals": goals, "has_record": bool(items)}


def _insights_from_totals(totals: dict, goals: dict) -> list[str]:
    insights: list[str] = []
    cal_target = float(goals.get("calories", 1800))
    protein_target = float(goals.get("protein", 120))
    sodium_target = float(goals.get("sodium", 2000))
    sugar_target = float(goals.get("sugar", 50))

    cal_gap = round(cal_target - totals["calories"], 1)
    if cal_gap >= 0:
        insights.append(f"热量未超标，距目标还差 {cal_gap} kcal。")
    else:
        insights.append(f"热量超标 {round(abs(cal_gap), 1)} kcal，建议下餐降低油脂和糖。")

    protein_gap = round(protein_target - totals["protein"], 1)
    if protein_gap > 0:
        insights.append(f"蛋白质仍差 {protein_gap} g，建议优先补充鸡胸肉/鱼/豆制品。")
    else:
        insights.append("蛋白质已达标，保持当前优质蛋白摄入节奏。")

    if totals["sodium"] > sodium_target:
        insights.append("钠摄入偏高，建议减少腌制食品和重口调味。")
    if totals["sugar"] > sugar_target:
        insights.append("添加糖摄入偏高，建议减少含糖饮料与甜食。")
    if not insights:
        insights.append("整体摄入结构较均衡，建议继续保持。")
    return insights[:4]


@router.get("/daily", response_model=DailyReportResponse)
def daily_report(
    date: date_type | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    day = date or date_type.today()
    stat = _day_stat(db, current_user, day)
    totals = stat["totals"]
    goals = stat["goals"]
    calorie_target = float(current_user.daily_calorie_goal or goals.get("calories", 1800))

    records = db.query(DietRecord).filter(DietRecord.user_id == current_user.id, DietRecord.date == day).all()
    meals: list[ReportMealItem] = []
    for record in records:
        foods = [item.food.name for item in record.items if item.food and item.food.name][:5]
        meal_calories = round(sum(item.calories for item in record.items), 1)
        meals.append(ReportMealItem(meal_type=record.meal_type, calories=meal_calories, foods=foods))

    summary_cards = [
        ReportSummaryCard(key="calories", label="热量", value=round(totals["calories"], 1), unit="kcal", target=round(calorie_target, 1)),
        ReportSummaryCard(key="protein", label="蛋白质", value=round(totals["protein"], 1), unit="g", target=round(float(goals.get("protein", 120)), 1)),
        ReportSummaryCard(key="score", label="健康评分", value=round(stat["score"], 1), unit="/10"),
        ReportSummaryCard(key="record_count", label="记录餐次", value=float(len(meals)), unit="次"),
    ]
    insights = _insights_from_totals({**totals, "calories": totals["calories"]}, {**goals, "calories": calorie_target})

    return DailyReportResponse(date=day, summary_cards=summary_cards, meals=meals, insights=insights)


@router.get("/weekly", response_model=WeeklyReportResponse)
def weekly_report(
    end_date: date_type | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    end = end_date or date_type.today()
    start = end - timedelta(days=6)
    goals = _safe_goals(current_user)
    calorie_target = float(current_user.daily_calorie_goal or goals.get("calories", 1800))

    day_metrics: list[ReportDayMetric] = []
    all_items: list[DietRecordItem] = []
    goal_hit_days = 0
    score_sum = 0.0
    calories_sum = 0.0
    protein_sum = 0.0
    sodium_sum = 0.0
    sugar_sum = 0.0
    record_days = 0
    for i in range(7):
        day = start + timedelta(days=i)
        stat = _day_stat(db, current_user, day)
        totals = stat["totals"]
        score = float(stat["score"])
        has_record = bool(stat["has_record"])
        if has_record:
            all_items.extend(stat["items"])
            record_days += 1
        calories = round(totals["calories"], 1)
        protein = round(totals["protein"], 1)
        sodium = round(totals["sodium"], 1)
        sugar = round(totals["sugar"], 1)
        if calories <= calorie_target * 1.05 and protein >= float(goals.get("protein", 120)) * 0.7:
            goal_hit_days += 1
        score_sum += score
        calories_sum += calories
        protein_sum += protein
        sodium_sum += sodium
        sugar_sum += sugar
        day_metrics.append(
            ReportDayMetric(
                date=day,
                label=f"周{['一', '二', '三', '四', '五', '六', '日'][day.weekday()]}",
                calories=calories,
                protein=protein,
                fat=round(totals["fat"], 1),
                carbs=round(totals["carbs"], 1),
                score=round(score, 1),
                target=round(calorie_target, 1),
                has_record=has_record,
            )
        )

    avg_calories = round(calories_sum / 7, 1)
    avg_score = round(score_sum / 7, 1)
    goal_rate = round((goal_hit_days / 7) * 100, 1)

    category_weight: dict[str, float] = {}
    for item in all_items:
        cat = (item.food.category or "其他") if item.food else "其他"
        category_weight[cat] = category_weight.get(cat, 0.0) + float(item.amount or 0)
    total_weight = sum(category_weight.values()) or 1.0
    distribution = [
        CategoryDistributionItem(name=k, pct=round(v / total_weight * 100, 1))
        for k, v in sorted(category_weight.items(), key=lambda x: x[1], reverse=True)
    ][:6]

    summary_cards = [
        ReportSummaryCard(key="avg_calories", label="平均热量", value=avg_calories, unit="kcal/天", target=round(calorie_target, 1)),
        ReportSummaryCard(key="avg_score", label="平均评分", value=avg_score, unit="/10"),
        ReportSummaryCard(key="goal_rate", label="目标达成率", value=goal_rate, unit="%"),
        ReportSummaryCard(key="record_days", label="记录天数", value=float(record_days), unit="天"),
    ]
    totals_for_insight = {
        "calories": avg_calories,
        "protein": round(protein_sum / 7, 1),
        "sodium": round(sodium_sum / 7, 1),
        "sugar": round(sugar_sum / 7, 1),
    }
    insights = _insights_from_totals(totals_for_insight, {**goals, "calories": calorie_target})
    insights.insert(0, f"近7天目标达成率 {goal_rate}%，记录天数 {record_days}/7。")
    return WeeklyReportResponse(
        start_date=start,
        end_date=end,
        summary_cards=summary_cards,
        daily_metrics=day_metrics,
        category_distribution=distribution,
        insights=insights[:5],
    )


@router.get("/monthly", response_model=MonthlyReportResponse)
def monthly_report(
    month: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if month:
        try:
            first_day = datetime.strptime(month, "%Y-%m").date().replace(day=1)
        except ValueError as e:
            raise HTTPException(status_code=400, detail="month 参数格式应为 YYYY-MM") from e
    else:
        today = date_type.today()
        first_day = today.replace(day=1)

    if first_day.month == 12:
        next_month_first = first_day.replace(year=first_day.year + 1, month=1, day=1)
    else:
        next_month_first = first_day.replace(month=first_day.month + 1, day=1)
    month_end = next_month_first - timedelta(days=1)

    goals = _safe_goals(current_user)
    calorie_target = float(current_user.daily_calorie_goal or goals.get("calories", 1800))
    week_metrics: list[MonthWeekMetric] = []

    cursor = first_day
    idx = 1
    monthly_scores: list[float] = []
    monthly_calories: list[float] = []
    monthly_goal_hits = 0
    monthly_days = 0
    while cursor <= month_end:
        wk_end = min(cursor + timedelta(days=6), month_end)
        day = cursor
        calories_sum = 0.0
        score_sum = 0.0
        goal_hit = 0
        record_days = 0
        total_days = (wk_end - cursor).days + 1
        while day <= wk_end:
            stat = _day_stat(db, current_user, day)
            totals = stat["totals"]
            score = float(stat["score"])
            calories = float(totals["calories"])
            calories_sum += calories
            score_sum += score
            if stat["has_record"]:
                record_days += 1
            if calories <= calorie_target * 1.05:
                goal_hit += 1
            day += timedelta(days=1)

        avg_cal = round(calories_sum / total_days, 1)
        avg_score = round(score_sum / total_days, 1)
        goal_rate = round(goal_hit / total_days * 100, 1)
        week_metrics.append(
            MonthWeekMetric(
                week_label=f"第{idx}周",
                avg_calories=avg_cal,
                avg_score=avg_score,
                goal_rate=goal_rate,
                record_days=record_days,
            )
        )
        idx += 1
        cursor = wk_end + timedelta(days=1)
        monthly_scores.append(avg_score)
        monthly_calories.append(avg_cal)
        monthly_goal_hits += goal_hit
        monthly_days += total_days

    month_avg_cal = round(sum(monthly_calories) / max(len(monthly_calories), 1), 1)
    month_avg_score = round(sum(monthly_scores) / max(len(monthly_scores), 1), 1)
    month_goal_rate = round(monthly_goal_hits / max(monthly_days, 1) * 100, 1)

    summary_cards = [
        ReportSummaryCard(key="avg_calories", label="月均热量", value=month_avg_cal, unit="kcal/天", target=round(calorie_target, 1)),
        ReportSummaryCard(key="avg_score", label="月均评分", value=month_avg_score, unit="/10"),
        ReportSummaryCard(key="goal_rate", label="月度达成率", value=month_goal_rate, unit="%"),
        ReportSummaryCard(key="week_count", label="统计周数", value=float(len(week_metrics)), unit="周"),
    ]

    trend_text = "持续提升中" if len(week_metrics) >= 2 and week_metrics[-1].goal_rate >= week_metrics[0].goal_rate else "存在波动"
    insights = [
        f"本月目标达成率 {month_goal_rate}%，{trend_text}。",
        f"本月日均热量 {month_avg_cal} kcal，目标 {round(calorie_target, 1)} kcal。",
        f"本月日均健康评分 {month_avg_score}/10。",
    ]
    return MonthlyReportResponse(
        month=f"{first_day.year}-{first_day.month:02d}",
        summary_cards=summary_cards,
        week_metrics=week_metrics,
        insights=insights,
    )
