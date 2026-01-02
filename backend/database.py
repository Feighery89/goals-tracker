"""SQLite database setup with SQLAlchemy."""

import os
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

# Use persistent directory on Render, fallback to local for dev
DB_PATH = os.environ.get("DB_PATH", "./data/goals.db")
os.makedirs(os.path.dirname(DB_PATH) if os.path.dirname(DB_PATH) else ".", exist_ok=True)

SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Goal(Base):
    """Goal model for tracking New Year's resolutions."""
    __tablename__ = "goals"
    
    id = Column(Integer, primary_key=True, index=True)
    person = Column(String(50), nullable=False, index=True)  # "mark" or "fiancee"
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    category = Column(String(50), default="Personal")
    progress = Column(Integer, default=0)  # 0-100
    target_date = Column(String(10), nullable=True)  # YYYY-MM-DD
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    checkins = relationship("CheckIn", back_populates="goal", cascade="all, delete-orphan")


class CheckIn(Base):
    """Check-in model for goal progress updates."""
    __tablename__ = "checkins"
    
    id = Column(Integer, primary_key=True, index=True)
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=False)
    note = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    goal = relationship("Goal", back_populates="checkins")


def init_db():
    """Create all database tables."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency for getting database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

