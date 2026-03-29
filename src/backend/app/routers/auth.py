from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import json
from ..db import get_db
from ..models import User
from ..schemas import RegisterRequest, LoginRequest, Token, UserOut
from ..auth import get_current_user, get_password_hash, verify_password, create_access_token
from ..utils import compute_user_metrics

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=Token)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if not payload.phone and not payload.email:
        raise HTTPException(status_code=400, detail="手机号或邮箱不能为空")
    if payload.phone:
        if db.query(User).filter(User.phone == payload.phone).first():
            raise HTTPException(status_code=400, detail="手机号已注册")
    if payload.email:
        if db.query(User).filter(User.email == payload.email).first():
            raise HTTPException(status_code=400, detail="邮箱已注册")

    user = User(
        phone=payload.phone,
        email=str(payload.email) if payload.email else None,
        password_hash=get_password_hash(payload.password or "123456"),
        nickname=payload.nickname or "新用户",
        gender=payload.gender,
        age=payload.age,
        height=payload.height,
        weight=payload.weight,
        activity_level=payload.activity_level or "久坐",
        goal_type=payload.goal_type or "减脂",
        target_weight=payload.target_weight,
        weekly_target=payload.weekly_target or 0.5,
    )
    compute_user_metrics(user)
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(str(user.id))
    return Token(access_token=token)


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = None
    if payload.phone:
        user = db.query(User).filter(User.phone == payload.phone).first()
    if not user and payload.email:
        user = db.query(User).filter(User.email == str(payload.email)).first()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="账号不存在")

    if payload.code:
        token = create_access_token(str(user.id))
        return Token(access_token=token)

    if not payload.password or not user.password_hash:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="密码错误")

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="密码错误")

    token = create_access_token(str(user.id))
    return Token(access_token=token)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return UserOut(
        id=current_user.id,
        phone=current_user.phone,
        email=current_user.email,
        nickname=current_user.nickname,
        avatar=current_user.avatar,
        gender=current_user.gender,
        age=current_user.age,
        height=current_user.height,
        weight=current_user.weight,
        activity_level=current_user.activity_level,
        health_conditions=json.loads(current_user.health_conditions) if current_user.health_conditions else [],
        allergies=json.loads(current_user.allergies) if current_user.allergies else [],
        goal_type=current_user.goal_type,
        target_weight=current_user.target_weight,
        weekly_target=current_user.weekly_target,
        daily_calorie_goal=current_user.daily_calorie_goal,
        nutrition_goals=json.loads(current_user.nutrition_goals) if current_user.nutrition_goals else {},
        bmr=current_user.bmr,
        tdee=current_user.tdee,
        bmi=current_user.bmi,
        bmi_category=current_user.bmi_category,
    )
