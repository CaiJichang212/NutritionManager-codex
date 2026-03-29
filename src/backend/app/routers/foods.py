from __future__ import annotations

import json
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import or_

from ..db import get_db
from ..models import Food
from ..schemas import FoodOut, FoodDetail
from ..auth import get_current_user

router = APIRouter(prefix="/foods", tags=["foods"])


def _to_food_detail(food: Food) -> FoodDetail:
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
        allergens=json.loads(food.allergens) if food.allergens else [],
    )


@router.get("/search", response_model=list[FoodOut])
def search_foods(q: str = "", db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    query = db.query(Food)
    if q:
        query = query.filter(or_(Food.name.contains(q), Food.brand.contains(q)))
    return query.limit(50).all()


@router.get("/{food_id}", response_model=FoodDetail)
def get_food(food_id: int, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    food = db.query(Food).filter(Food.id == food_id).first()
    if not food:
        raise HTTPException(status_code=404, detail="食物不存在")
    return _to_food_detail(food)


@router.get("/barcode/{code}", response_model=FoodDetail)
def get_food_by_barcode(code: str, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    food = db.query(Food).filter(Food.barcode == code).first()
    if not food:
        raise HTTPException(status_code=404, detail="条码未识别")
    return _to_food_detail(food)


@router.post("/recognize-image", response_model=FoodDetail)
async def recognize_food_from_image(
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: object = Depends(get_current_user),
):
    # MVP阶段：先用文件名关键词匹配食物，后续替换为真实OCR/图像识别服务。
    filename = (image.filename or "").lower()
    await image.read()

    keyword_map = [
        ("鸡", "鸡"),
        ("chicken", "鸡"),
        ("燕麦", "燕麦"),
        ("oat", "燕麦"),
        ("西兰花", "西兰花"),
        ("broccoli", "西兰花"),
        ("可乐", "可口可乐"),
        ("cola", "可口可乐"),
        ("沙拉", "沙拉"),
        ("salad", "沙拉"),
    ]

    for key, query_word in keyword_map:
        if key in filename:
            matched = db.query(Food).filter(Food.name.contains(query_word)).first()
            if matched:
                return _to_food_detail(matched)

    fallback = db.query(Food).first()
    if not fallback:
        raise HTTPException(status_code=404, detail="暂无可识别食物数据")
    return _to_food_detail(fallback)
