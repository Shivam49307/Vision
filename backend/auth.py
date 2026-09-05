import os
import secrets
from datetime import datetime, timedelta

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from database import get_db
import models

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def _secret_key() -> str:
    return os.getenv("SECRET_KEY", "dev-secret-change-in-production")


def is_single_user_mode() -> bool:
    return bool(os.getenv("SINGLE_USER_USERNAME") and os.getenv("SINGLE_USER_PASSWORD"))


def single_user() -> models.User:
    username = os.getenv("SINGLE_USER_USERNAME")
    return models.User(
        id=1,
        username=username,
        email=f"{username}@private.local",
        created_at=datetime.utcnow(),
    )


def verify_single_user(username: str, password: str) -> bool:
    configured_username = os.getenv("SINGLE_USER_USERNAME", "")
    configured_password = os.getenv("SINGLE_USER_PASSWORD", "")
    return secrets.compare_digest(username, configured_username) and secrets.compare_digest(password, configured_password)


def hash_password(password: str) -> str:
    encoded = password.encode("utf-8")
    if len(encoded) > 72:
        raise ValueError("Password must be 72 characters or fewer")
    return bcrypt.hashpw(encoded, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    encoded = plain.encode("utf-8")
    if len(encoded) > 72:
        return False
    return bcrypt.checkpw(encoded, hashed.encode("utf-8"))


def create_access_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": str(user_id), "exp": expire}, _secret_key(), algorithm=ALGORITHM)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, _secret_key(), algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        raise exc

    if is_single_user_mode():
        if user_id != 1:
            raise exc
        return single_user()

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise exc
    return user
