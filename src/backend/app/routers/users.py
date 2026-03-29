from __future__ import annotations

import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..auth import get_current_user, verify_password, get_password_hash
from ..models import User
from ..schemas import UserOut, UserUpdate, GoalUpdate, PasswordUpdate, BindContactRequest
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


@router.put("/password")
def update_password(
    payload: PasswordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if len(payload.new_password.strip()) < 6:
        raise HTTPException(status_code=400, detail="新密码至少6位")
    if not current_user.password_hash or not verify_password(payload.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="旧密码错误")
    current_user.password_hash = get_password_hash(payload.new_password.strip())
    db.add(current_user)
    db.commit()
    return {"ok": True}


@router.put("/bind-contact", response_model=UserOut)
def bind_contact(
    payload: BindContactRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not payload.phone and not payload.email:
        raise HTTPException(status_code=400, detail="手机号或邮箱至少填写一项")

    if payload.phone and payload.phone != current_user.phone:
        exists_phone = db.query(User).filter(User.phone == payload.phone, User.id != current_user.id).first()
        if exists_phone:
            raise HTTPException(status_code=400, detail="手机号已被绑定")
        current_user.phone = payload.phone

    if payload.email and str(payload.email) != (current_user.email or ""):
        exists_email = db.query(User).filter(User.email == str(payload.email), User.id != current_user.id).first()
        if exists_email:
            raise HTTPException(status_code=400, detail="邮箱已被绑定")
        current_user.email = str(payload.email)

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return _serialize_user(current_user)
