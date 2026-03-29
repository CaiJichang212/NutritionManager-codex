from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RegisterRequest(BaseModel):
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    nickname: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[int] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    activity_level: Optional[str] = None
    goal_type: Optional[str] = None
    target_weight: Optional[float] = None
    weekly_target: Optional[float] = None


class LoginRequest(BaseModel):
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    code: Optional[str] = None


class UserOut(BaseModel):
    id: int
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    nickname: Optional[str] = None
    avatar: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[int] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    activity_level: Optional[str] = None
    health_conditions: Optional[List[str]] = None
    allergies: Optional[List[str]] = None
    goal_type: Optional[str] = None
    target_weight: Optional[float] = None
    weekly_target: Optional[float] = None
    daily_calorie_goal: Optional[float] = None
    nutrition_goals: Optional[Dict[str, Any]] = None
    bmr: Optional[float] = None
    tdee: Optional[float] = None
    bmi: Optional[float] = None
    bmi_category: Optional[str] = None

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    nickname: Optional[str] = None
    avatar: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[int] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    activity_level: Optional[str] = None
    health_conditions: Optional[List[str]] = None
    allergies: Optional[List[str]] = None


class GoalUpdate(BaseModel):
    goal_type: Optional[str] = None
    target_weight: Optional[float] = None
    weekly_target: Optional[float] = None


class PasswordUpdate(BaseModel):
    old_password: str
    new_password: str


class BindContactRequest(BaseModel):
    phone: Optional[str] = None
    email: Optional[EmailStr] = None


class FoodOut(BaseModel):
    id: int
    name: str
    brand: Optional[str] = None
    category: Optional[str] = None
    image: Optional[str] = None
    barcode: Optional[str] = None
    calories: float
    protein: float
    fat: float
    carbs: float
    fiber: Optional[float] = None
    sugar: Optional[float] = None
    sodium: Optional[float] = None
    health_score: Optional[float] = None
    nova_class: Optional[int] = None

    class Config:
        from_attributes = True


class FoodDetail(FoodOut):
    saturated_fat: Optional[float] = None
    potassium: Optional[float] = None
    vitamins: Optional[Dict[str, Any]] = None
    minerals: Optional[Dict[str, Any]] = None
    additives: Optional[List[str]] = None
    additive_count: Optional[int] = None
    ingredients: Optional[str] = None
    allergens: Optional[List[str]] = None


class RecordItemCreate(BaseModel):
    food_id: int
    amount: float


class RecordItemUpdate(BaseModel):
    amount: float


class RecordCreate(BaseModel):
    date: Optional[date] = None
    meal_type: str
    items: List[RecordItemCreate]


class RecordFood(BaseModel):
    id: int
    record_id: Optional[int] = None
    record_item_id: Optional[int] = None
    name: str
    amount: str
    calories: float
    image: Optional[str] = None


class RecordMeal(BaseModel):
    meal_type: str
    time: Optional[str] = None
    calories: float
    foods: List[RecordFood]


class RecordsTodayResponse(BaseModel):
    date: date
    total_calories: float
    meals: List[RecordMeal]


class NutritionMacro(BaseModel):
    key: str
    name: str
    consumed: float
    target: float
    unit: str
    color: str
    tip: Optional[str] = None


class NutritionFocus(BaseModel):
    label: str
    consumed: float
    target: float
    unit: str
    warn: bool = False


class NutritionReminder(BaseModel):
    type: str
    text: str


class HealthDimension(BaseModel):
    label: str
    score: int
    max: int


class HealthScore(BaseModel):
    score: float
    level: str
    dimensions: List[HealthDimension]


class NutritionSummary(BaseModel):
    date: date
    calorie_consumed: float
    calorie_target: float
    calorie_remaining: float
    bmr: float
    tdee: float
    macros: List[NutritionMacro]
    focus: List[NutritionFocus]
    reminders: List[NutritionReminder]
    health_score: HealthScore
    weekly_calories: List[Dict[str, Any]]
    radar: List[Dict[str, Any]]
