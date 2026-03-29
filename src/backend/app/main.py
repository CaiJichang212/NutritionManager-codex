from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import Base, engine, SessionLocal
from .seed import seed_data
from .routers import auth, users, foods, records, nutrition

app = FastAPI(title="Nutrition Manager MVP API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"] ,
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_data(db)
    finally:
        db.close()


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(foods.router)
app.include_router(records.router)
app.include_router(nutrition.router)

# 兼容前端可能的 /api 前缀
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(foods.router, prefix="/api")
app.include_router(records.router, prefix="/api")
app.include_router(nutrition.router, prefix="/api")
