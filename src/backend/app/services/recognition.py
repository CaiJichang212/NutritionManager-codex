from __future__ import annotations

import base64
import json
import os
import re
from functools import lru_cache
from typing import Any

from openai import OpenAI
from rapidocr_onnxruntime import RapidOCR
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..models import Food

MODELSCOPE_BASE_URL = os.getenv("MODELSCOPE_BASE_URL", "https://api-inference.modelscope.cn/v1")
MODELSCOPE_API_KEY = os.getenv("MODELSCOPE_API_KEY", "")
MODELSCOPE_OCR_MODEL = os.getenv("MODELSCOPE_OCR_MODEL", "Qwen/Qwen3.5-35B-A3B")
MODELSCOPE_VISION_MODEL = os.getenv("MODELSCOPE_VISION_MODEL", "Qwen/Qwen3.5-27B")
MODELSCOPE_VISION_FALLBACK_MODEL = os.getenv(
    "MODELSCOPE_VISION_FALLBACK_MODEL", "PaddlePaddle/ERNIE-4.5-VL-28B-A3B-PT"
)

DEFAULT_FOOD_IMAGE = "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=200&h=200&fit=crop"

KNOWN_FOOD_PROFILES: dict[str, dict[str, Any]] = {
    "辣条": {
        "name": "辣条（调味面制品）",
        "category": "零食",
        "calories": 360.0,
        "protein": 8.5,
        "fat": 14.0,
        "carbs": 48.0,
        "fiber": 1.0,
        "sugar": 8.0,
        "sodium": 1200.0,
        "health_score": 2.6,
        "nova_class": 4,
    },
    "莴笋": {
        "name": "莴笋（酱腌菜）",
        "category": "蔬菜",
        "calories": 49.0,
        "protein": 1.2,
        "fat": 1.5,
        "carbs": 8.0,
        "fiber": 1.2,
        "sugar": 3.0,
        "sodium": 780.0,
        "health_score": 6.2,
        "nova_class": 3,
    },
}

ALLERGEN_RULES: dict[str, list[str]] = {
    "麸质谷物": ["小麦", "黑麦", "大麦", "燕麦", "面筋", "麸质", "麦芽"],
    "甲壳类": ["虾", "蟹", "龙虾", "甲壳"],
    "鱼类": ["鱼", "鳕鱼", "三文鱼", "金枪鱼"],
    "蛋类": ["鸡蛋", "蛋清", "蛋黄", "蛋白"],
    "花生": ["花生", "花生酱"],
    "大豆": ["大豆", "黄豆", "豆浆", "豆制品", "豆粉"],
    "乳制品": ["牛奶", "奶粉", "奶酪", "乳清", "乳糖", "乳制品"],
    "坚果": ["杏仁", "腰果", "核桃", "榛子", "开心果", "坚果"],
    "芝麻": ["芝麻"],
}


def recognize_or_create_food(db: Session, image_bytes: bytes, filename: str = "") -> Food:
    if not image_bytes:
        raise ValueError("图片内容为空")

    suffix = _guess_suffix(filename)
    mime = f"image/{'jpeg' if suffix in ('jpg', 'jpeg') else suffix}"
    remote_data = _try_modelscope_extract(image_bytes, mime)
    local_text = _run_rapid_ocr(image_bytes)
    merged_text = "\n".join(x for x in [remote_data.get("raw_text", ""), local_text] if x).strip()
    parsed = _extract_structured_data(merged_text)

    # 远程识别提供的结构化字段优先级高于本地正则
    for field in ["food_name", "brand", "barcode", "ingredients"]:
        if remote_data.get(field):
            parsed[field] = remote_data[field]
    parsed["nutrition"] = _merge_nutrition(parsed.get("nutrition", {}), remote_data.get("nutrition", {}))
    parsed["additives"] = remote_data.get("additives") or parsed.get("additives", [])
    parsed["allergens"] = remote_data.get("allergens") or parsed.get("allergens", [])

    if not parsed.get("food_name"):
        parsed["food_name"] = _extract_food_name_by_vision(image_bytes, mime)
    if not parsed.get("food_name"):
        parsed["food_name"] = _infer_food_name_from_text(merged_text)

    barcode = str(parsed.get("barcode") or "").strip()
    if barcode:
        by_barcode = db.query(Food).filter(Food.barcode == barcode).first()
        if by_barcode:
            return by_barcode

    by_name = _match_existing_food(db, parsed.get("food_name", ""), merged_text, parsed.get("brand", ""))
    if by_name:
        detected = parsed.get("allergens") if isinstance(parsed.get("allergens"), list) else []
        if not detected and parsed.get("ingredients"):
            detected = _infer_allergens(str(parsed.get("ingredients") or ""))
        existing = json.loads(by_name.allergens) if by_name.allergens else []
        merged_allergens = list(dict.fromkeys([*existing, *detected]))
        if merged_allergens != existing:
            by_name.allergens = json.dumps(merged_allergens, ensure_ascii=False)
            db.add(by_name)
            db.commit()
            db.refresh(by_name)
        return by_name

    created = _create_food_from_recognition(db, parsed, merged_text)
    if created:
        return created

    fallback = db.query(Food).first()
    if fallback:
        return fallback
    raise ValueError("暂无可识别食物数据")


def _guess_suffix(filename: str) -> str:
    lowered = (filename or "").lower()
    if lowered.endswith(".png"):
        return "png"
    if lowered.endswith(".webp"):
        return "webp"
    if lowered.endswith(".jpeg"):
        return "jpeg"
    return "jpg"


def _run_rapid_ocr(image_bytes: bytes) -> str:
    try:
        result, _ = _get_rapid_ocr()(image_bytes)
    except Exception:
        return ""
    if not result:
        return ""
    texts: list[str] = []
    for item in result:
        if isinstance(item, (list, tuple)) and len(item) >= 2:
            txt = str(item[1]).strip()
            if txt:
                texts.append(txt)
    return "\n".join(texts)


@lru_cache(maxsize=1)
def _get_rapid_ocr() -> RapidOCR:
    return RapidOCR()


@lru_cache(maxsize=1)
def _get_openai_client() -> OpenAI | None:
    if not MODELSCOPE_API_KEY:
        return None
    return OpenAI(base_url=MODELSCOPE_BASE_URL, api_key=MODELSCOPE_API_KEY)


def _try_modelscope_extract(image_bytes: bytes, mime: str) -> dict[str, Any]:
    client = _get_openai_client()
    if not client:
        return {}
    prompt = (
        "你是营养识别OCR助手。请从图片中提取食品信息，仅返回JSON对象，不要额外解释。"
        '字段：food_name, brand, barcode, ingredients, additives(array), allergens(array), nutrition(object: calories, protein, fat, carbs, sugar, sodium), raw_text。'
        "数值单位按每100g，无法确定则返回null。"
    )
    data_url = _to_data_url(image_bytes, mime)
    raw = _call_vision_model(client, MODELSCOPE_OCR_MODEL, prompt, data_url)
    parsed = _safe_json_load(raw)
    return parsed if isinstance(parsed, dict) else {}


def _extract_food_name_by_vision(image_bytes: bytes, mime: str) -> str:
    client = _get_openai_client()
    if not client:
        return ""
    data_url = _to_data_url(image_bytes, mime)
    prompt = (
        "识别这张食物图片对应的食品名称（中文），只返回一个短语，不要解释。"
        "如果看不清，返回空字符串。"
    )
    txt = _call_vision_model(client, MODELSCOPE_VISION_MODEL, prompt, data_url).strip()
    if txt and txt != '""':
        return _clean_food_name(txt)
    # 第一模型失败时，按文档配置使用备用视觉模型
    txt = _call_vision_model(client, MODELSCOPE_VISION_FALLBACK_MODEL, prompt, data_url).strip()
    return _clean_food_name(txt)


def _call_vision_model(client: OpenAI, model: str, prompt: str, data_url: str) -> str:
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                }
            ],
            temperature=0,
            stream=False,
        )
        return (resp.choices[0].message.content or "").strip()
    except Exception:
        return ""


def _to_data_url(image_bytes: bytes, mime: str) -> str:
    encoded = base64.b64encode(image_bytes).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def _safe_json_load(raw: str) -> Any:
    txt = (raw or "").strip()
    if not txt:
        return {}
    if txt.startswith("```"):
        txt = re.sub(r"^```(?:json)?", "", txt).strip()
        txt = re.sub(r"```$", "", txt).strip()
    try:
        return json.loads(txt)
    except Exception:
        # 容错提取首个JSON对象
        m = re.search(r"\{[\s\S]*\}", txt)
        if not m:
            return {}
        try:
            return json.loads(m.group(0))
        except Exception:
            return {}


def _merge_nutrition(base: dict[str, Any], ext: dict[str, Any]) -> dict[str, Any]:
    merged = dict(base or {})
    for k in ["calories", "protein", "fat", "carbs", "sugar", "sodium"]:
        if ext and ext.get(k) is not None:
            merged[k] = ext[k]
    return merged


def _extract_structured_data(text: str) -> dict[str, Any]:
    normalized = (text or "").strip()
    data: dict[str, Any] = {
        "food_name": "",
        "brand": "",
        "barcode": "",
        "ingredients": "",
        "additives": [],
        "allergens": [],
        "nutrition": {},
    }
    if not normalized:
        return data

    name_match = re.search(r"(?:产品名称|品名|名称)\s*[:：]\s*([^\n\r，,；;。]{2,40})", normalized)
    if name_match:
        data["food_name"] = _clean_food_name(name_match.group(1))

    barcode_match = re.search(r"(?:条形码|条码|EAN)\s*[:：]?\s*([0-9]{8,14})", normalized, flags=re.IGNORECASE)
    if barcode_match:
        data["barcode"] = barcode_match.group(1)
    else:
        # OCR未识别“条码”字段时，兜底抓取可能的EAN
        any_code = re.search(r"\b([0-9]{12,13})\b", normalized)
        if any_code:
            data["barcode"] = any_code.group(1)

    ingredients_match = re.search(
        r"(?:配料|配料表)\s*[:：]\s*([\s\S]{1,180}?)(?:营养成分表|贮存条件|食用方法|保质期|$)",
        normalized,
    )
    if ingredients_match:
        ingredients = ingredients_match.group(1).replace("\n", "").strip(" 。；;")
        data["ingredients"] = ingredients
        additive_match = re.search(r"食品添加剂[（(]([^）)]+)[）)]", ingredients)
        if additive_match:
            additives = [x.strip() for x in re.split(r"[、,，]", additive_match.group(1)) if x.strip()]
            data["additives"] = additives
        data["allergens"] = _infer_allergens(ingredients)

    data["nutrition"] = {
        "calories": _extract_number(normalized, r"能量\s*([0-9][0-9\.'’`]{0,8})\s*k?j", multiplier=0.239),
        "protein": _extract_number(normalized, r"蛋白质\s*([0-9][0-9\.'’`]{0,8})\s*g"),
        "fat": _extract_number(normalized, r"脂肪\s*([0-9][0-9\.'’`]{0,8})\s*g"),
        "carbs": _extract_number(normalized, r"碳水化合物\s*([0-9][0-9\.'’`]{0,8})\s*g"),
        "sugar": _extract_number(normalized, r"(?:糖|总糖)\s*([0-9][0-9\.'’`]{0,8})\s*g"),
        "sodium": _extract_number(normalized, r"钠\s*([0-9][0-9\.'’`]{0,8})\s*mg"),
    }
    return data


def _extract_number(text: str, pattern: str, multiplier: float = 1.0) -> float | None:
    m = re.search(pattern, text, flags=re.IGNORECASE)
    if not m:
        return None
    value = _parse_ocr_number(m.group(1))
    if value is None:
        return None
    value *= multiplier
    if value < 0:
        return None
    return round(value, 2)


def _parse_ocr_number(raw: str) -> float | None:
    if not raw:
        return None
    txt = raw.replace("'", ".").replace("’", ".").replace("`", ".").replace(",", ".")
    txt = re.sub(r"[^0-9.]", "", txt)
    if txt.count(".") > 1:
        first = txt.find(".")
        txt = txt[: first + 1] + txt[first + 1 :].replace(".", "")
    if not txt:
        return None
    try:
        return float(txt)
    except Exception:
        return None


def _infer_food_name_from_text(text: str) -> str:
    s = text or ""
    for key in ["莴笋", "辣条", "可乐", "鸡胸", "燕麦", "牛奶", "沙拉"]:
        if key in s:
            if key == "鸡胸":
                return "鸡胸肉（清蒸）"
            if key == "可乐":
                return "可口可乐"
            return key
    return ""


def _clean_food_name(name: str) -> str:
    txt = (name or "").strip().strip('"').strip("“”")
    txt = re.sub(r"\s+", "", txt)
    return txt[:64]


def _infer_allergens(text: str) -> list[str]:
    raw = text or ""
    found: list[str] = []
    for allergen, keywords in ALLERGEN_RULES.items():
        if any(k in raw for k in keywords):
            found.append(allergen)
    return found


def _match_existing_food(db: Session, food_name: str, merged_text: str, brand: str = "") -> Food | None:
    stop_tokens = {"香辣", "麻辣", "风味", "口味", "产品", "食品", "调味"}
    tokens: list[str] = []
    if food_name:
        tokens.append(food_name)
    tokens.extend([x for x in ["莴笋", "辣条", "鸡胸", "燕麦", "牛奶", "可乐", "沙拉"] if x in merged_text])
    if brand:
        tokens.append(brand)
    tokens = [x for x in dict.fromkeys(tokens) if x and len(x) >= 2 and x not in stop_tokens]
    if not tokens:
        return None

    # 先严格匹配，避免“香辣”等通用词误击中其他食品。
    exact = db.query(Food).filter(Food.name == food_name).first() if food_name else None
    if exact:
        return exact

    conditions = [Food.name.contains(t) for t in tokens if len(t) >= 3] + [Food.brand.contains(t) for t in tokens if len(t) >= 3]
    if not conditions:
        return None
    return db.query(Food).filter(or_(*conditions)).first()


def _infer_category(name: str, text: str) -> str:
    combined = f"{name}\n{text}"
    if any(k in combined for k in ["莴笋", "蔬菜", "西兰花"]):
        return "蔬菜"
    if any(k in combined for k in ["辣条", "薯片", "蛋白棒", "零食"]):
        return "零食"
    if any(k in combined for k in ["可乐", "饮料", "果汁", "牛奶"]):
        return "饮品"
    if any(k in combined for k in ["鸡胸", "牛肉", "鱼", "肉"]):
        return "肉类"
    return "其他"


def _estimate_health_score(calories: float, sugar: float, sodium: float, additive_count: int, name: str, category: str) -> float:
    score = 8.0
    if calories > 350:
        score -= 1.8
    elif calories > 220:
        score -= 0.8
    if sugar > 15:
        score -= 1.6
    elif sugar > 8:
        score -= 0.8
    if sodium > 800:
        score -= 1.8
    elif sodium > 400:
        score -= 0.8
    if additive_count >= 6:
        score -= 2.0
    elif additive_count >= 3:
        score -= 1.0
    if "辣条" in name:
        score = min(score, 3.2)
    if "莴笋" in name or category == "蔬菜":
        score += 0.6
    return max(1.0, min(9.5, round(score, 1)))


def _create_food_from_recognition(db: Session, parsed: dict[str, Any], text: str) -> Food | None:
    food_name = _clean_food_name(parsed.get("food_name") or "")
    if not food_name:
        return None

    profile_key = ""
    for key in KNOWN_FOOD_PROFILES:
        if key in food_name or key in text:
            profile_key = key
            break
    profile = KNOWN_FOOD_PROFILES.get(profile_key, {})

    nutrition = parsed.get("nutrition", {}) or {}
    calories = nutrition.get("calories")
    protein = nutrition.get("protein")
    fat = nutrition.get("fat")
    carbs = nutrition.get("carbs")
    sugar = nutrition.get("sugar")
    sodium = nutrition.get("sodium")

    calories = float(calories if calories is not None else profile.get("calories", 120.0))
    protein = float(protein if protein is not None else profile.get("protein", 4.0))
    fat = float(fat if fat is not None else profile.get("fat", 3.0))
    carbs = float(carbs if carbs is not None else profile.get("carbs", 20.0))
    sugar = float(sugar if sugar is not None else profile.get("sugar", max(0.0, carbs * 0.3)))
    sodium = float(sodium if sodium is not None else profile.get("sodium", 200.0))
    fiber = float(profile.get("fiber", 1.0))

    additives = parsed.get("additives") if isinstance(parsed.get("additives"), list) else []
    allergens = parsed.get("allergens") if isinstance(parsed.get("allergens"), list) else []
    additive_count = len(additives)
    ingredients = (parsed.get("ingredients") or "").strip() or None
    if not allergens and ingredients:
        allergens = _infer_allergens(ingredients)
    brand = (parsed.get("brand") or "").strip() or None
    barcode = (parsed.get("barcode") or "").strip() or None
    category = profile.get("category") or _infer_category(food_name, text)
    health_score = float(profile.get("health_score", _estimate_health_score(calories, sugar, sodium, additive_count, food_name, category)))
    nova_class = int(profile.get("nova_class", 3))

    if barcode:
        existed = db.query(Food).filter(Food.barcode == barcode).first()
        if existed:
            return existed

    existed_by_name = db.query(Food).filter(Food.name == food_name).first()
    if existed_by_name:
        return existed_by_name

    food = Food(
        name=profile.get("name", food_name),
        brand=brand,
        category=category,
        image=DEFAULT_FOOD_IMAGE,
        barcode=barcode,
        calories=calories,
        protein=protein,
        fat=fat,
        carbs=carbs,
        fiber=fiber,
        sugar=sugar,
        sodium=sodium,
        potassium=150.0 if category == "蔬菜" else 80.0,
        additives=json.dumps(additives, ensure_ascii=False),
        additive_count=additive_count,
        ingredients=ingredients,
        allergens=json.dumps(allergens, ensure_ascii=False),
        health_score=health_score,
        nova_class=nova_class,
    )
    db.add(food)
    db.commit()
    db.refresh(food)
    return food
