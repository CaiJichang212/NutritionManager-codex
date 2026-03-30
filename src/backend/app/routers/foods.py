from __future__ import annotations

import json
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import or_

from ..db import get_db
from ..models import Food, User
from ..schemas import FoodOut, FoodDetail
from ..auth import get_current_user
from ..services.assessment import (
    build_food_alternative_recommendations,
    build_food_population_assessments,
    resolve_allergen_risk,
)
from ..services.recognition import recognize_or_create_food

router = APIRouter(prefix="/foods", tags=["foods"])


def _to_food_detail(food: Food, db: Session, current_user: User | None = None) -> FoodDetail:
    allergy = resolve_allergen_risk(food, current_user)
    alternatives = build_food_alternative_recommendations(db, food, current_user) if current_user else []

    return FoodDetail(
        id=food.id,
        name=food.name,
        brand=food.brand,
        category=food.category,
        image=food.image,
        barcode=food.barcode,
        calories=food.calories,
        protein=food.protein,
        fat=food.fat,
        carbs=food.carbs,
        fiber=food.fiber,
        sugar=food.sugar,
        sodium=food.sodium,
        health_score=food.health_score,
        nova_class=food.nova_class,
        saturated_fat=food.saturated_fat,
        potassium=food.potassium,
        vitamins=json.loads(food.vitamins) if food.vitamins else {},
        minerals=json.loads(food.minerals) if food.minerals else {},
        additives=json.loads(food.additives) if food.additives else [],
        additive_count=food.additive_count,
        ingredients=food.ingredients,
        allergens=allergy["food_allergens"],
        allergen_risk_level=allergy["risk_level"],
        allergen_alerts=allergy["alerts"],
        population_assessments=build_food_population_assessments(food, current_user),
        replacement_recommendations=alternatives,
    )


@router.get("/search", response_model=list[FoodOut])
def search_foods(q: str = "", db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    query = db.query(Food)
    if q:
        query = query.filter(or_(Food.name.contains(q), Food.brand.contains(q)))
    return query.limit(50).all()


@router.get("/{food_id}", response_model=FoodDetail)
def get_food(food_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    food = db.query(Food).filter(Food.id == food_id).first()
    if not food:
        raise HTTPException(status_code=404, detail="食物不存在")
    return _to_food_detail(food, db, current_user)


@router.get("/barcode/{code}", response_model=FoodDetail)
def get_food_by_barcode(code: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    food = db.query(Food).filter(Food.barcode == code).first()
    if not food:
        raise HTTPException(status_code=404, detail="条码未识别")
    return _to_food_detail(food, db, current_user)


@router.post("/recognize-image", response_model=FoodDetail)
async def recognize_food_from_image(
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    image_bytes = await image.read()
    try:
        food = recognize_or_create_food(db, image_bytes=image_bytes, filename=image.filename or "")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    return _to_food_detail(food, db, current_user)
