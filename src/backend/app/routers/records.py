from __future__ import annotations

import json
from datetime import date as date_type, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..auth import get_current_user
from ..models import DietRecord, DietRecordItem, Food, User
from ..schemas import RecordCreate, RecordsTodayResponse, RecordMeal, RecordFood
from ..utils import snapshot_from_food, aggregate_items

router = APIRouter(prefix="/records", tags=["records"])


@router.post("", response_model=RecordsTodayResponse)
def add_record(
    payload: RecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record_date = payload.date or date_type.today()
    record = (
        db.query(DietRecord)
        .filter(
            DietRecord.user_id == current_user.id,
            DietRecord.date == record_date,
            DietRecord.meal_type == payload.meal_type,
        )
        .first()
    )
    if not record:
        record = DietRecord(
            user_id=current_user.id,
            date=record_date,
            meal_type=payload.meal_type,
        )
        db.add(record)
        db.flush()

    for item in payload.items:
        food = db.query(Food).filter(Food.id == item.food_id).first()
        if not food:
            raise HTTPException(status_code=404, detail="食物不存在")
        snap = snapshot_from_food(food, item.amount)
        record_item = DietRecordItem(
            record_id=record.id,
            food_id=food.id,
            amount=item.amount,
            calories=snap["calories"],
            protein=snap["protein"],
            fat=snap["fat"],
            carbs=snap["carbs"],
            fiber=snap["fiber"],
            sugar=snap["sugar"],
            sodium=snap["sodium"],
            nutrients=json.dumps(snap, ensure_ascii=False),
        )
        db.add(record_item)

    db.commit()
    return get_records_by_date(record_date, db, current_user)


@router.get("/today", response_model=RecordsTodayResponse)
def get_records_today(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_records_by_date(date_type.today(), db, current_user)


@router.get("/date/{record_date}", response_model=RecordsTodayResponse)
def get_records_by_date(
    record_date: date_type,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    records = (
        db.query(DietRecord)
        .filter(DietRecord.user_id == current_user.id, DietRecord.date == record_date)
        .all()
    )

    meals = []
    total_calories = 0.0
    for record in records:
        items = record.items
        meal_calories = sum(item.calories for item in items)
        total_calories += meal_calories
        foods = []
        for item in items:
            foods.append(
                RecordFood(
                    id=item.food_id,
                    name=item.food.name,
                    amount=f"{int(item.amount)}g",
                    calories=round(item.calories, 1),
                    image=item.food.image,
                )
            )
        meals.append(
            RecordMeal(
                meal_type=record.meal_type,
                time=None,
                calories=round(meal_calories, 1),
                foods=foods,
            )
        )

    return RecordsTodayResponse(
        date=record_date,
        total_calories=round(total_calories, 1),
        meals=meals,
    )


@router.get("/history/summary")
def history_summary(
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date_type.today()
    history = []
    total = 0.0
    for i in range(days):
        day = today - timedelta(days=i)
        items = (
            db.query(DietRecordItem)
            .join(DietRecord, DietRecordItem.record_id == DietRecord.id)
            .filter(DietRecord.user_id == current_user.id, DietRecord.date == day)
            .all()
        )
        totals = aggregate_items(items)
        history.append({"date": day.isoformat(), "calories": totals["calories"]})
        total += totals["calories"]
    avg = round(total / max(days, 1), 1)
    return {"days": days, "average_calories": avg, "history": history}
