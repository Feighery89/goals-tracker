"""Pydantic models for request/response validation."""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


# ============ Milestone Models ============

class MilestoneCreate(BaseModel):
    """Schema for creating a milestone."""
    title: str = Field(..., min_length=1, max_length=200)


class MilestoneUpdate(BaseModel):
    """Schema for updating a milestone."""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    completed: Optional[bool] = None
    order: Optional[int] = None


class MilestoneResponse(BaseModel):
    """Schema for milestone response."""
    id: int
    goal_id: int
    title: str
    completed: bool
    order: int
    created_at: datetime
    
    class Config:
        from_attributes = True


# ============ Goal Models ============

class GoalCreate(BaseModel):
    """Schema for creating a new goal."""
    year: int = Field(default=2026)
    person: str = Field(..., min_length=1, max_length=50)
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    category: str = Field(default="Personal", max_length=50)
    target_date: Optional[str] = None  # YYYY-MM-DD format
    is_habit: bool = Field(default=False)
    milestones: List[str] = Field(default=[])  # List of milestone titles


class GoalUpdate(BaseModel):
    """Schema for updating an existing goal."""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    category: Optional[str] = Field(None, max_length=50)
    progress: Optional[int] = Field(None, ge=0, le=100)
    target_date: Optional[str] = None
    is_habit: Optional[bool] = None


class CheckInCreate(BaseModel):
    """Schema for creating a check-in."""
    note: str = Field(..., min_length=1, max_length=1000)


class CheckInResponse(BaseModel):
    """Schema for check-in response."""
    id: int
    goal_id: int
    note: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class GoalResponse(BaseModel):
    """Schema for goal response."""
    id: int
    year: int
    person: str
    title: str
    description: str
    category: str
    progress: int
    target_date: Optional[str]
    is_habit: bool
    created_at: datetime
    updated_at: datetime
    checkins: List[CheckInResponse] = []
    milestones: List[MilestoneResponse] = []
    
    class Config:
        from_attributes = True


# ============ Auth Models ============

class LoginRequest(BaseModel):
    """Schema for login request."""
    password: str


class LoginResponse(BaseModel):
    """Schema for login response."""
    success: bool
    token: Optional[str] = None
    message: str = ""


# ============ Email Models ============

class EmailTestRequest(BaseModel):
    """Schema for testing email sending."""
    recipient: str


# ============ Person Config ============

VALID_CATEGORIES = [
    "Health",
    "Finance", 
    "Career",
    "Relationship",
    "Personal",
    "Other"
]
