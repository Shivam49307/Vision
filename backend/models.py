from datetime import datetime
from sqlalchemy import Column, DateTime, Float, Integer, String, Text
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    filename = Column(String, nullable=False)
    task = Column(String, nullable=False)
    status = Column(String, nullable=False, default="completed")
    result_json = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    file_size_bytes = Column(Integer, nullable=False, default=0)
    image_width = Column(Integer, nullable=True)
    image_height = Column(Integer, nullable=True)
    duration_ms = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
