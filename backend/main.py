import io
import json
import os
import time
from contextlib import asynccontextmanager
from datetime import datetime

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session
from PIL import Image

import logger  # noqa: F401
from loguru import logger as log
from auth import (
    create_access_token,
    get_current_user,
    hash_password,
    is_single_user_mode,
    verify_password,
    verify_single_user,
)
from database import Base, engine, get_db
from model import TASK_PROMPTS, vision_model
import models

load_dotenv()
Base.metadata.create_all(bind=engine)

PROCESS_METRICS = {"requests": 0, "successes": 0, "failures": 0, "total_duration_ms": 0.0}


@asynccontextmanager
async def lifespan(app: FastAPI):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")
    vision_model.load(api_key)
    log.success("Server startup complete")
    yield
    log.info("Server shutting down")


app = FastAPI(title="Vision AI API", version="3.0.0", lifespan=lifespan)

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    # Add your Vercel URL here after deploying, e.g.:
    # "https://your-app.vercel.app",
]
_extra = os.getenv("ALLOWED_ORIGINS", "")
if _extra:
    ALLOWED_ORIGINS += [o.strip() for o in _extra.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    t0 = time.perf_counter()
    response = await call_next(request)
    ms = (time.perf_counter() - t0) * 1000
    level = "warning" if response.status_code >= 400 else "info"
    getattr(log, level)(f"{request.method} {request.url.path} | {response.status_code} | {ms:.1f}ms")
    return response


@app.exception_handler(Exception)
async def global_error(request: Request, exc: Exception):
    log.exception(f"Unhandled error | {exc}")
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class RegisterBody(BaseModel):
    username: str
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AgentMessage(BaseModel):
    role: str
    content: str


# ── Auth routes ───────────────────────────────────────────────────────────────

@app.post("/api/auth/register", response_model=UserOut)
def register(body: RegisterBody, db: Session = Depends(get_db)):
    if is_single_user_mode():
        raise HTTPException(status_code=403, detail="Registration is disabled")

    if db.query(models.User).filter(
        (models.User.username == body.username) | (models.User.email == body.email)
    ).first():
        raise HTTPException(status_code=400, detail="Username or email already taken")

    try:
        hashed = hash_password(body.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    user = models.User(
        username=body.username,
        email=body.email,
        hashed_password=hashed,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log.info(f"New user registered | username={body.username}")
    return user


@app.post("/api/auth/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    if is_single_user_mode():
        if not verify_single_user(form.username, form.password):
            log.warning(f"Failed private login | username={form.username}")
            raise HTTPException(status_code=401, detail="Invalid username or password")

        token = create_access_token(1)
        log.info(f"Private user logged in | username={form.username}")
        return {"access_token": token, "token_type": "bearer"}

    user = db.query(models.User).filter(models.User.username == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        log.warning(f"Failed login | username={form.username}")
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_access_token(user.id)
    log.info(f"User logged in | username={user.username}")
    return {"access_token": token, "token_type": "bearer"}


@app.get("/api/auth/me", response_model=UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user


# ── Vision routes ─────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "model": "gemini-3.6-flash"}


@app.get("/api/tasks")
def get_tasks():
    return {
        "tasks": [
            {"id": "caption", "label": "Caption", "description": "One-sentence image description"},
            {"id": "detailed_caption", "label": "Detailed Caption", "description": "Multi-sentence detailed description"},
            {"id": "more_detailed_caption", "label": "More Detailed Caption", "description": "Exhaustive description of every element"},
            {"id": "object_detection", "label": "Object Detection", "description": "Detect objects with bounding boxes"},
            {"id": "ocr", "label": "OCR", "description": "Extract all visible text"},
            {"id": "scene_analysis", "label": "Scene Analysis", "description": "Comprehensive scene and context breakdown"},
        ]
    }


async def _run_analysis(image: UploadFile, task: str, current_user: models.User, db: Session):
    if task not in TASK_PROMPTS:
        raise HTTPException(status_code=400, detail=f"Unknown task '{task}'")

    contents = await image.read()
    started = time.perf_counter()
    PROCESS_METRICS["requests"] += 1
    log.info(f"Analyze | user={current_user.username} | task={task} | size_kb={len(contents) / 1024:.1f}")

    record = models.Analysis(
        user_id=current_user.id,
        filename=image.filename or "upload",
        task=task,
        file_size_bytes=len(contents),
        status="processing",
    )
    db.add(record)
    db.flush()

    try:
        pil_image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        record.status = "failed"
        record.error_message = "Could not decode image file"
        record.duration_ms = (time.perf_counter() - started) * 1000
        db.commit()
        PROCESS_METRICS["failures"] += 1
        raise HTTPException(status_code=400, detail=record.error_message)

    try:
        result = vision_model.analyze(pil_image, task)
    except Exception:
        record.status = "failed"
        record.error_message = "Vision analysis failed"
        record.duration_ms = (time.perf_counter() - started) * 1000
        db.commit()
        PROCESS_METRICS["failures"] += 1
        log.exception("Vision analysis failed")
        raise HTTPException(status_code=502, detail=record.error_message)

    duration_ms = (time.perf_counter() - started) * 1000
    record.status = "completed"
    record.result_json = json.dumps(result)
    record.image_width = pil_image.width
    record.image_height = pil_image.height
    record.duration_ms = duration_ms
    db.commit()
    PROCESS_METRICS["successes"] += 1
    PROCESS_METRICS["total_duration_ms"] += duration_ms
    return {
        "id": record.id,
        "task": task,
        "result": result,
        "image_size": {"width": pil_image.width, "height": pil_image.height},
        "metrics": {"duration_ms": round(duration_ms, 2), "file_size_bytes": len(contents)},
    }


@app.post("/api/analyze")
async def analyze(
    image: UploadFile = File(...),
    task: str = Form(default="caption"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return await _run_analysis(image, task, current_user, db)


@app.post("/api/analyze/batch")
async def analyze_batch(
    images: list[UploadFile] = File(...),
    task: str = Form(default="caption"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not images or len(images) > 10:
        raise HTTPException(status_code=400, detail="Upload between 1 and 10 images")

    results = []
    for image in images:
        try:
            results.append(await _run_analysis(image, task, current_user, db))
        except HTTPException as exc:
            results.append({
                "filename": image.filename or "upload",
                "status": "failed",
                "error": exc.detail,
            })
    return {"task": task, "count": len(results), "results": results}


@app.get("/api/history")
def analysis_history(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    limit = max(1, min(limit, 100))
    records = (
        db.query(models.Analysis)
        .filter(models.Analysis.user_id == current_user.id)
        .order_by(models.Analysis.created_at.desc())
        .limit(limit)
        .all()
    )
    return {
        "items": [
            {
                "id": item.id,
                "filename": item.filename,
                "task": item.task,
                "status": item.status,
                "result": json.loads(item.result_json) if item.result_json else None,
                "error": item.error_message,
                "duration_ms": item.duration_ms,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in records
        ]
    }


@app.get("/api/monitoring")
def monitoring(db: Session = Depends(get_db)):
    completed = db.query(models.Analysis).filter(models.Analysis.status == "completed").count()
    failed = db.query(models.Analysis).filter(models.Analysis.status == "failed").count()
    average_duration = db.query(models.Analysis.duration_ms).filter(
        models.Analysis.status == "completed",
        models.Analysis.duration_ms.isnot(None),
    ).all()
    average_ms = sum(row[0] for row in average_duration) / len(average_duration) if average_duration else 0
    return {
        "stored_analyses": {"completed": completed, "failed": failed},
        "process_metrics": {
            **PROCESS_METRICS,
            "average_duration_ms": round(average_ms, 2),
        },
    }


@app.post("/api/agent/chat")
async def agent_chat(
    image: UploadFile = File(...),
    message: str = Form(...),
    history: str = Form(default="[]"),
    current_user: models.User = Depends(get_current_user),
):
    if not message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    try:
        conversation = json.loads(history)
        messages = [AgentMessage.model_validate(item).model_dump() for item in conversation]
    except (json.JSONDecodeError, TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid conversation history")

    contents = await image.read()
    try:
        pil_image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not decode image file")

    log.info(f"Agent chat | user={current_user.username} | message_chars={len(message)}")
    try:
        response = vision_model.chat(pil_image, message, messages)
    except Exception as exc:
        status_code = getattr(exc, "status_code", getattr(exc, "code", None))
        if status_code in {500, 502, 503, 504}:
            log.warning("Agent provider temporarily unavailable")
            raise HTTPException(
                status_code=503,
                detail="The vision service is temporarily busy. Please try again in a moment.",
                headers={"Retry-After": "5"},
            )
        log.exception("Agent inference failed")
        raise HTTPException(status_code=502, detail="The vision agent could not answer right now")

    return {"response": response}
