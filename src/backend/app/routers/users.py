from __future__ import annotations

import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..auth import get_current_user
from ..models import User
from ..schemas import UserOut, UserUpdate, GoalUpdate
from ..utils import compute_user_metrics

router = APIRouter(prefix="/users", tags=["users"])


def _serialize_user(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        phone=user.phone,
        email=user.email,
        nickname=user.nickname,
        avatar=user.avatar,
        gender=user.gender,
        age=user.age,
        height=user.height,
        weight=user.weight,
        activity_level=user.activity_level,
        health_conditions=json.loads(user.health_conditions) if user.health_conditions else [],
        allergies=json.loads(user.allergies) if user.allergies else [],
        goal_type=user.goal_type,
        target_weight=user.target_weight,
        weekly_target=user.weekly_target,
        daily_calorie_goal=user.daily_calorie_goal,
        nutrition_goals=json.loads(user.nutrition_goals) if user.nutrition_goals else {},
        bmr=user.bmr,
        tdee=user.tdee,
        bmi=user.bmi,
        bmi_category=user.bmi_category,
    )


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return _serialize_user(current_user)


@router.put("/me", response_model=UserOut)
def update_me(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for field, value in payload.model_dump(exclude_unset=True).items():
        if field in {"health_conditions", "allergies"}:
            setattr(current_user, field, json.dumps(value or [], ensure_ascii=False))
        else:
            setattr(current_user, field, value)

    compute_user_metrics(current_user)
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return _serialize_user(current_user)


@router.put("/goal", response_model=UserOut)
def update_goal(
    payload: GoalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)

    compute_user_metrics(current_user)
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return _serialize_user(current_user)
