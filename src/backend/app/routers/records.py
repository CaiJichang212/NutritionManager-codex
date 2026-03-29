from __future__ import annotations

import json
from datetime import date as date_type, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..auth import get_current_user
from ..models import DietRecord, DietRecordItem, Food, User
from ..schemas import RecordCreate, RecordItemUpdate, RecordsTodayResponse, RecordMeal, RecordFood
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
                    record_id=record.id,
                    record_item_id=item.id,
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


@router.put("/item/{item_id}", response_model=RecordsTodayResponse)
def update_record_item(
    item_id: int,
    payload: RecordItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="份量必须大于0")

    item = (
        db.query(DietRecordItem)
        .join(DietRecord, DietRecordItem.record_id == DietRecord.id)
        .filter(DietRecordItem.id == item_id, DietRecord.user_id == current_user.id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="记录项不存在")

    snap = snapshot_from_food(item.food, payload.amount)
    item.amount = payload.amount
    item.calories = snap["calories"]
    item.protein = snap["protein"]
    item.fat = snap["fat"]
    item.carbs = snap["carbs"]
    item.fiber = snap["fiber"]
    item.sugar = snap["sugar"]
    item.sodium = snap["sodium"]
    item.nutrients = json.dumps(snap, ensure_ascii=False)
    db.add(item)
    db.commit()

    record = db.query(DietRecord).filter(DietRecord.id == item.record_id).first()
    return get_records_by_date(record.date, db, current_user)


@router.delete("/item/{item_id}", response_model=RecordsTodayResponse)
def delete_record_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = (
        db.query(DietRecordItem)
        .join(DietRecord, DietRecordItem.record_id == DietRecord.id)
        .filter(DietRecordItem.id == item_id, DietRecord.user_id == current_user.id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="记录项不存在")

    record = db.query(DietRecord).filter(DietRecord.id == item.record_id).first()
    record_date = record.date
    db.delete(item)
    db.flush()
    remains = db.query(DietRecordItem).filter(DietRecordItem.record_id == record.id).count()
    if remains == 0:
        db.delete(record)
    db.commit()
    return get_records_by_date(record_date, db, current_user)


@router.post("/copy/{record_date}", response_model=RecordsTodayResponse)
def copy_records_to_today(
    record_date: date_type,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    source_records = (
        db.query(DietRecord)
        .filter(DietRecord.user_id == current_user.id, DietRecord.date == record_date)
        .all()
    )
    if not source_records:
        raise HTTPException(status_code=404, detail="源日期无记录可复制")

    today = date_type.today()
    for source in source_records:
        target_record = (
            db.query(DietRecord)
            .filter(
                DietRecord.user_id == current_user.id,
                DietRecord.date == today,
                DietRecord.meal_type == source.meal_type,
            )
            .first()
        )
        if not target_record:
            target_record = DietRecord(user_id=current_user.id, date=today, meal_type=source.meal_type)
            db.add(target_record)
            db.flush()

        for source_item in source.items:
            cloned = DietRecordItem(
                record_id=target_record.id,
                food_id=source_item.food_id,
                amount=source_item.amount,
                calories=source_item.calories,
                protein=source_item.protein,
                fat=source_item.fat,
                carbs=source_item.carbs,
                fiber=source_item.fiber,
                sugar=source_item.sugar,
                sodium=source_item.sodium,
                nutrients=source_item.nutrients,
            )
            db.add(cloned)
    db.commit()
    return get_records_by_date(today, db, current_user)


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
