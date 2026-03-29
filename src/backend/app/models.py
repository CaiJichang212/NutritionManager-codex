from __future__ import annotations

from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Date,
    DateTime,
    ForeignKey,
    Text,
)
from sqlalchemy.orm import relationship

from .db import Base


def _json_text():
    return Text


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String(32), unique=True, index=True, nullable=True)
    email = Column(String(255), unique=True, index=True, nullable=True)
    password_hash = Column(String(255), nullable=True)
    nickname = Column(String(64), nullable=True)
    avatar = Column(String(512), nullable=True)
    gender = Column(String(8), nullable=True)
    age = Column(Integer, nullable=True)
    height = Column(Float, nullable=True)
    weight = Column(Float, nullable=True)

    activity_level = Column(String(32), nullable=True)
    health_conditions = Column(_json_text(), nullable=True)
    allergies = Column(_json_text(), nullable=True)

    goal_type = Column(String(16), nullable=True)
    target_weight = Column(Float, nullable=True)
    weekly_target = Column(Float, nullable=True)
    daily_calorie_goal = Column(Float, nullable=True)
    nutrition_goals = Column(_json_text(), nullable=True)

    bmr = Column(Float, nullable=True)
    tdee = Column(Float, nullable=True)
    bmi = Column(Float, nullable=True)
    bmi_category = Column(String(16), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    records = relationship("DietRecord", back_populates="user")


class Food(Base):
    __tablename__ = "foods"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), index=True, nullable=False)
    brand = Column(String(128), nullable=True)
    category = Column(String(64), nullable=True)
    image = Column(String(512), nullable=True)
    barcode = Column(String(64), unique=True, index=True, nullable=True)

    calories = Column(Float, nullable=False)
    protein = Column(Float, nullable=False)
    fat = Column(Float, nullable=False)
    saturated_fat = Column(Float, nullable=True)
    carbs = Column(Float, nullable=False)
    fiber = Column(Float, nullable=True)
    sugar = Column(Float, nullable=True)
    sodium = Column(Float, nullable=True)
    potassium = Column(Float, nullable=True)
    vitamins = Column(_json_text(), nullable=True)
    minerals = Column(_json_text(), nullable=True)

    additives = Column(_json_text(), nullable=True)
    additive_count = Column(Integer, nullable=True)
    ingredients = Column(Text, nullable=True)
    allergens = Column(_json_text(), nullable=True)

    health_score = Column(Float, nullable=True)
    nova_class = Column(Integer, nullable=True)
    glycemic_index = Column(Float, nullable=True)
    glycemic_load = Column(Float, nullable=True)
    protein_quality = Column(Float, nullable=True)

    weight_loss_score = Column(Float, nullable=True)
    muscle_gain_score = Column(Float, nullable=True)
    diabetes_score = Column(Float, nullable=True)
    hypertension_score = Column(Float, nullable=True)


class DietRecord(Base):
    __tablename__ = "diet_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    meal_type = Column(String(16), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="records")
    items = relationship("DietRecordItem", back_populates="record", cascade="all, delete-orphan")


class DietRecordItem(Base):
    __tablename__ = "diet_record_items"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("diet_records.id"), nullable=False)
    food_id = Column(Integer, ForeignKey("foods.id"), nullable=False)
    amount = Column(Float, nullable=False)

    calories = Column(Float, nullable=False)
    protein = Column(Float, nullable=False)
    fat = Column(Float, nullable=False)
    carbs = Column(Float, nullable=False)
    fiber = Column(Float, nullable=True)
    sugar = Column(Float, nullable=True)
    sodium = Column(Float, nullable=True)

    nutrients = Column(_json_text(), nullable=True)

    record = relationship("DietRecord", back_populates="items")
    food = relationship("Food")
