from __future__ import annotations

import json
import os
from datetime import date as date_type, timedelta

from openai import OpenAI
from sqlalchemy.orm import Session

from ..models import DietRecord, DietRecordItem, User
from ..utils import aggregate_items, compute_macro_targets

MODELSCOPE_BASE_URL = os.getenv("MODELSCOPE_BASE_URL", "https://api-inference.modelscope.cn/v1")
MODELSCOPE_API_KEY = os.getenv("MODELSCOPE_API_KEY", "")
MODELSCOPE_CHAT_MODEL = os.getenv("MODELSCOPE_CHAT_MODEL", "Qwen/Qwen3.5-32B")


def _get_chat_client() -> OpenAI | None:
    if not MODELSCOPE_API_KEY:
        return None
    return OpenAI(base_url=MODELSCOPE_BASE_URL, api_key=MODELSCOPE_API_KEY)


def _get_items(db: Session, user_id: int, record_date: date_type) -> list[DietRecordItem]:
    records = db.query(DietRecord).filter(DietRecord.user_id == user_id, DietRecord.date == record_date).all()
    items: list[DietRecordItem] = []
    for record in records:
        items.extend(record.items)
    return items


def _build_context_data(db: Session, current_user: User) -> dict:
    today = date_type.today()
    items_today = _get_items(db, current_user.id, today)
    totals_today = aggregate_items(items_today)

    goals = json.loads(current_user.nutrition_goals) if current_user.nutrition_goals else compute_macro_targets(current_user)
    daily_calorie_goal = float(current_user.daily_calorie_goal or 1800)
    protein_goal = float(goals.get("protein", 120))
    sodium_goal = float(goals.get("sodium", 2000))
    sugar_goal = float(goals.get("sugar", 50))

    weekly_calories: list[float] = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_totals = aggregate_items(_get_items(db, current_user.id, day))
        weekly_calories.append(day_totals["calories"])
    weekly_avg_calorie = round(sum(weekly_calories) / max(len(weekly_calories), 1), 1)

    recent_foods: list[str] = []
    for item in sorted(items_today, key=lambda x: x.id, reverse=True):
        if item.food and item.food.name and item.food.name not in recent_foods:
            recent_foods.append(item.food.name)
        if len(recent_foods) >= 3:
            break

    return {
        "goal_type": current_user.goal_type or "减脂",
        "target_weight": current_user.target_weight,
        "today": totals_today,
        "goals": {
            "calories": daily_calorie_goal,
            "protein": protein_goal,
            "sodium": sodium_goal,
            "sugar": sugar_goal,
        },
        "weekly_avg_calories": weekly_avg_calorie,
        "recent_foods": recent_foods,
    }


def build_ai_context_response(db: Session, current_user: User) -> dict:
    ctx = _build_context_data(db, current_user)
    consumed_cal = round(float(ctx["today"]["calories"]), 1)
    goal_cal = round(float(ctx["goals"]["calories"]), 1)
    consumed_protein = round(float(ctx["today"]["protein"]), 1)
    goal_protein = round(float(ctx["goals"]["protein"]), 1)
    goal_type = str(ctx["goal_type"])

    greeting = (
        f"你好，我是你的 AI 营养师。已同步你今天的真实记录："
        f"热量 {consumed_cal}/{goal_cal} kcal，蛋白质 {consumed_protein}/{goal_protein}g。"
        f"你当前目标是「{goal_type}」。"
    )

    context_items = [
        {"key": "calories", "label": "今日热量", "value": f"{consumed_cal}/{goal_cal} kcal"},
        {"key": "protein", "label": "蛋白质", "value": f"{consumed_protein}/{goal_protein}g"},
        {"key": "goal", "label": "目标", "value": goal_type},
        {"key": "weekly", "label": "近7日均值", "value": f"{ctx['weekly_avg_calories']} kcal"},
    ]
    return {
        "greeting": greeting,
        "context_items": context_items,
        "quick_questions": build_quick_questions(db, current_user),
    }


def build_quick_questions(db: Session, current_user: User) -> list[str]:
    ctx = _build_context_data(db, current_user)
    goal_type = str(ctx["goal_type"])
    questions: list[str] = [
        "我今天热量超标了吗？",
        "我的蛋白质摄入够吗？",
        "晚餐吃什么比较健康？",
    ]
    if goal_type == "减脂":
        questions.append("如何更稳地推进减脂？")
    elif goal_type == "增肌":
        questions.append("如何安排今天的增肌蛋白补充？")
    else:
        questions.append("今天的营养结构哪里需要优先调整？")
    if float(ctx["today"]["sodium"]) > float(ctx["goals"]["sodium"]):
        questions.append("今天钠摄入偏高该怎么调整？")
    else:
        questions.append("推荐两种高蛋白低负担的食物")
    return questions[:6]


def _build_rule_based_reply(user_text: str, ctx: dict) -> tuple[str, list[str]]:
    q = (user_text or "").strip()
    q_lower = q.lower()
    today = ctx["today"]
    goals = ctx["goals"]
    goal_type = ctx["goal_type"]
    citations = [
        f"今日热量 {round(today['calories'], 1)}/{round(goals['calories'], 1)} kcal",
        f"今日蛋白质 {round(today['protein'], 1)}/{round(goals['protein'], 1)} g",
        f"近7日平均热量 {ctx['weekly_avg_calories']} kcal",
    ]

    if "蛋白" in q:
        gap = round(goals["protein"] - today["protein"], 1)
        if gap > 0:
            reply = (
                f"你今天蛋白质还差约 {gap}g（当前 {round(today['protein'],1)}/{round(goals['protein'],1)}g）。\n"
                "建议晚餐优先补充鸡胸肉、鱼虾或豆制品，并把单餐蛋白控制在 20-40g。"
            )
        else:
            reply = (
                f"你今天蛋白质已达标（{round(today['protein'],1)}/{round(goals['protein'],1)}g）。\n"
                "接下来重点控制总热量和钠摄入，维持当前节奏。"
            )
        return reply, citations

    if "热量" in q or "超标" in q:
        remaining = round(goals["calories"] - today["calories"], 1)
        if remaining >= 0:
            reply = (
                f"今天热量未超标，还剩约 {remaining} kcal（当前 {round(today['calories'],1)}/{round(goals['calories'],1)} kcal）。\n"
                "晚餐建议选择低油烹饪，优先蛋白质和蔬菜。"
            )
        else:
            reply = (
                f"今天热量已超出约 {round(abs(remaining),1)} kcal（当前 {round(today['calories'],1)}/{round(goals['calories'],1)} kcal）。\n"
                "建议后续餐次减少高糖高脂零食，并增加低强度活动。"
            )
        return reply, citations

    if "晚餐" in q or "吃什么" in q:
        remaining = max(round(goals["calories"] - today["calories"], 1), 250.0)
        reply = (
            f"按你今天数据，晚餐可控制在约 {remaining:.0f} kcal。\n"
            "建议组合：鸡胸肉/鱼虾 + 深色蔬菜 + 少量全谷主食；避免高糖饮料和重油重盐。"
        )
        return reply, citations

    if "减脂" in q_lower or goal_type == "减脂":
        reply = (
            f"你当前是减脂目标，建议保持每日约 300-500 kcal 热量缺口。\n"
            f"今天热量 {round(today['calories'],1)}/{round(goals['calories'],1)} kcal，蛋白 {round(today['protein'],1)}/{round(goals['protein'],1)}g，"
            "优先把蛋白质补足并控制晚餐油脂。"
        )
        return reply, citations

    if "增肌" in q_lower or goal_type == "增肌":
        reply = (
            f"你当前是增肌目标，建议把蛋白稳定到目标以上（当前 {round(today['protein'],1)}/{round(goals['protein'],1)}g）。\n"
            "训练前后 2 小时补充优质蛋白 + 复合碳水，有助于恢复与合成。"
        )
        return reply, citations

    reply = (
        f"基于你今天的真实数据：热量 {round(today['calories'],1)}/{round(goals['calories'],1)} kcal，"
        f"蛋白质 {round(today['protein'],1)}/{round(goals['protein'],1)}g。\n"
        "建议优先补足蛋白并控制钠、糖摄入，晚餐采用低油低盐高纤维搭配。"
    )
    return reply, citations


def _call_model_reply(message: str, history: list[dict], ctx: dict) -> str:
    client = _get_chat_client()
    if not client:
        return ""
    system_prompt = (
        "你是营养管理应用中的AI营养师。"
        "必须使用给定用户上下文中的具体数值回答，禁止虚构数据。"
        "回答控制在4-8行，中文，给出明确行动建议。"
        "如用户问题与健康相关，优先给饮食行为建议，不做医疗诊断。"
    )
    context_text = (
        f"用户目标: {ctx['goal_type']}\n"
        f"今日热量: {round(ctx['today']['calories'],1)}/{round(ctx['goals']['calories'],1)} kcal\n"
        f"今日蛋白: {round(ctx['today']['protein'],1)}/{round(ctx['goals']['protein'],1)} g\n"
        f"今日钠: {round(ctx['today']['sodium'],1)}/{round(ctx['goals']['sodium'],1)} mg\n"
        f"今日糖: {round(ctx['today']['sugar'],1)}/{round(ctx['goals']['sugar'],1)} g\n"
        f"近7日平均热量: {ctx['weekly_avg_calories']} kcal\n"
        f"最近记录食物: {'、'.join(ctx['recent_foods']) if ctx['recent_foods'] else '暂无'}"
    )

    msgs: list[dict] = [{"role": "system", "content": system_prompt}, {"role": "system", "content": context_text}]
    for x in history[-6:]:
        role = "assistant" if x.get("role") == "ai" else "user"
        txt = str(x.get("text") or "").strip()
        if txt:
            msgs.append({"role": role, "content": txt})
    msgs.append({"role": "user", "content": message})
    try:
        resp = client.chat.completions.create(model=MODELSCOPE_CHAT_MODEL, messages=msgs, temperature=0.2, stream=False)
        return (resp.choices[0].message.content or "").strip()
    except Exception:
        return ""


def chat_with_assistant(db: Session, current_user: User, message: str, history: list[dict]) -> dict:
    ctx = _build_context_data(db, current_user)
    model_reply = _call_model_reply(message, history, ctx)
    if model_reply:
        citations = [
            f"今日热量 {round(ctx['today']['calories'], 1)}/{round(ctx['goals']['calories'], 1)} kcal",
            f"今日蛋白质 {round(ctx['today']['protein'], 1)}/{round(ctx['goals']['protein'], 1)} g",
        ]
        return {"reply": model_reply, "citations": citations}
    reply, citations = _build_rule_based_reply(message, ctx)
    return {"reply": reply, "citations": citations}
