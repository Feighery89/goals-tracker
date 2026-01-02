"""
G&M Yearly Goals Tracker - FastAPI backend for couples' yearly resolution tracking.
"""

import os
from datetime import datetime, timedelta
from typing import List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, status, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session
from jose import jwt, JWTError

from database import init_db, get_db, Goal, CheckIn, Milestone
from models import (
    GoalCreate, GoalUpdate, GoalResponse,
    CheckInCreate, CheckInResponse,
    MilestoneCreate, MilestoneUpdate, MilestoneResponse,
    LoginRequest, LoginResponse,
    VALID_CATEGORIES
)

# ============ Configuration ============

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

# Password hashing - use bcrypt directly
import bcrypt as bcrypt_lib

class SimplePasswordContext:
    """Simple password hashing using bcrypt directly."""
    def hash(self, password: str) -> str:
        return bcrypt_lib.hashpw(password.encode('utf-8'), bcrypt_lib.gensalt()).decode('utf-8')
    
    def verify(self, plain_password: str, hashed_password: str) -> bool:
        try:
            return bcrypt_lib.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
        except Exception:
            return False

pwd_context = SimplePasswordContext()

# App password (hashed version stored in env, or use plain for dev)
APP_PASSWORD_HASH = os.environ.get("APP_PASSWORD_HASH")
if not APP_PASSWORD_HASH:
    # For development, create hash from plain password
    plain_password = os.environ.get("APP_PASSWORD", "goals2026")
    APP_PASSWORD_HASH = pwd_context.hash(plain_password)

# Person names (configurable via env)
PERSON_1_NAME = os.environ.get("PERSON_1_NAME", "Mark")
PERSON_2_NAME = os.environ.get("PERSON_2_NAME", "Gabs")

# Current year default
CURRENT_YEAR = int(os.environ.get("CURRENT_YEAR", datetime.now().year))


# ============ App Setup ============

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    init_db()
    yield

app = FastAPI(
    title="G&M Yearly Goals Tracker",
    description="Track yearly goals together - Mark & Gabs",
    version="2.0.0",
    lifespan=lifespan
)

# CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ Auth Helpers ============

def verify_password(plain_password: str) -> bool:
    """Verify password against stored hash."""
    return pwd_context.verify(plain_password, APP_PASSWORD_HASH)


def create_access_token(data: dict) -> str:
    """Create JWT access token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(request: Request) -> bool:
    """Validate JWT token from cookie or header."""
    # Check cookie first
    token = request.cookies.get("auth_token")
    
    # Fallback to Authorization header
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("authenticated") != True:
            raise HTTPException(status_code=401, detail="Invalid token")
        return True
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )


# ============ Auth Routes ============

@app.post("/api/login", response_model=LoginResponse)
async def login(request: LoginRequest, response: Response):
    """Authenticate with shared password."""
    if not verify_password(request.password):
        return LoginResponse(success=False, message="Incorrect password")
    
    token = create_access_token({"authenticated": True})
    
    # Set HTTP-only cookie
    response.set_cookie(
        key="auth_token",
        value=token,
        httponly=True,
        max_age=ACCESS_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        samesite="lax",
        secure=os.environ.get("RENDER", False)  # Secure in production
    )
    
    return LoginResponse(success=True, token=token, message="Welcome!")


@app.post("/api/logout")
async def logout(response: Response):
    """Clear authentication cookie."""
    response.delete_cookie("auth_token")
    return {"message": "Logged out"}


@app.get("/api/auth/check")
async def check_auth(authenticated: bool = Depends(get_current_user)):
    """Check if current session is authenticated."""
    return {"authenticated": True}


# ============ Config Routes ============

@app.get("/api/config")
async def get_config(authenticated: bool = Depends(get_current_user)):
    """Get app configuration."""
    return {
        "persons": [PERSON_1_NAME, PERSON_2_NAME],
        "categories": VALID_CATEGORIES,
        "currentYear": CURRENT_YEAR
    }


@app.get("/api/years")
async def get_years(
    db: Session = Depends(get_db),
    authenticated: bool = Depends(get_current_user)
):
    """Get all years that have goals."""
    years = db.query(Goal.year).distinct().order_by(Goal.year.desc()).all()
    year_list = [y[0] for y in years]
    # Always include current year
    if CURRENT_YEAR not in year_list:
        year_list.insert(0, CURRENT_YEAR)
    return {"years": year_list}


# ============ Goal Routes ============

@app.get("/api/goals", response_model=List[GoalResponse])
async def list_goals(
    year: Optional[int] = None,
    person: Optional[str] = None,
    db: Session = Depends(get_db),
    authenticated: bool = Depends(get_current_user)
):
    """List all goals, optionally filtered by year and/or person."""
    query = db.query(Goal)
    if year:
        query = query.filter(Goal.year == year)
    if person:
        query = query.filter(Goal.person == person)
    goals = query.order_by(Goal.created_at.desc()).all()
    return goals


@app.post("/api/goals", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
async def create_goal(
    goal: GoalCreate,
    db: Session = Depends(get_db),
    authenticated: bool = Depends(get_current_user)
):
    """Create a new goal with optional milestones."""
    db_goal = Goal(
        year=goal.year,
        person=goal.person,
        title=goal.title,
        description=goal.description,
        category=goal.category,
        target_date=goal.target_date,
        is_habit=goal.is_habit
    )
    db.add(db_goal)
    db.commit()
    db.refresh(db_goal)
    
    # Add milestones if provided
    for i, milestone_title in enumerate(goal.milestones):
        milestone = Milestone(
            goal_id=db_goal.id,
            title=milestone_title,
            order=i
        )
        db.add(milestone)
    
    db.commit()
    db.refresh(db_goal)
    return db_goal


@app.get("/api/goals/{goal_id}", response_model=GoalResponse)
async def get_goal(
    goal_id: int,
    db: Session = Depends(get_db),
    authenticated: bool = Depends(get_current_user)
):
    """Get a specific goal by ID."""
    goal = db.query(Goal).filter(Goal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal


@app.patch("/api/goals/{goal_id}", response_model=GoalResponse)
async def update_goal(
    goal_id: int,
    goal_update: GoalUpdate,
    db: Session = Depends(get_db),
    authenticated: bool = Depends(get_current_user)
):
    """Update a goal."""
    goal = db.query(Goal).filter(Goal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    update_data = goal_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(goal, key, value)
    
    db.commit()
    db.refresh(goal)
    return goal


@app.delete("/api/goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: int,
    db: Session = Depends(get_db),
    authenticated: bool = Depends(get_current_user)
):
    """Delete a goal and all its check-ins and milestones."""
    goal = db.query(Goal).filter(Goal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    db.delete(goal)
    db.commit()
    return None


# ============ Milestone Routes ============

@app.post("/api/goals/{goal_id}/milestones", response_model=MilestoneResponse, status_code=status.HTTP_201_CREATED)
async def create_milestone(
    goal_id: int,
    milestone: MilestoneCreate,
    db: Session = Depends(get_db),
    authenticated: bool = Depends(get_current_user)
):
    """Add a milestone to a goal."""
    goal = db.query(Goal).filter(Goal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    # Get max order
    max_order = db.query(Milestone).filter(Milestone.goal_id == goal_id).count()
    
    db_milestone = Milestone(
        goal_id=goal_id,
        title=milestone.title,
        order=max_order
    )
    db.add(db_milestone)
    db.commit()
    db.refresh(db_milestone)
    return db_milestone


@app.patch("/api/milestones/{milestone_id}", response_model=MilestoneResponse)
async def update_milestone(
    milestone_id: int,
    milestone_update: MilestoneUpdate,
    db: Session = Depends(get_db),
    authenticated: bool = Depends(get_current_user)
):
    """Update a milestone (e.g., mark as completed)."""
    milestone = db.query(Milestone).filter(Milestone.id == milestone_id).first()
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")
    
    update_data = milestone_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(milestone, key, value)
    
    db.commit()
    db.refresh(milestone)
    
    # Auto-update goal progress based on milestones
    goal = milestone.goal
    if goal.milestones:
        completed = sum(1 for m in goal.milestones if m.completed)
        total = len(goal.milestones)
        goal.progress = int((completed / total) * 100)
        db.commit()
    
    return milestone


@app.delete("/api/milestones/{milestone_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_milestone(
    milestone_id: int,
    db: Session = Depends(get_db),
    authenticated: bool = Depends(get_current_user)
):
    """Delete a milestone."""
    milestone = db.query(Milestone).filter(Milestone.id == milestone_id).first()
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")
    
    db.delete(milestone)
    db.commit()
    return None


# ============ Check-in Routes ============

@app.post("/api/goals/{goal_id}/checkins", response_model=CheckInResponse, status_code=status.HTTP_201_CREATED)
async def create_checkin(
    goal_id: int,
    checkin: CheckInCreate,
    db: Session = Depends(get_db),
    authenticated: bool = Depends(get_current_user)
):
    """Add a check-in to a goal."""
    goal = db.query(Goal).filter(Goal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    db_checkin = CheckIn(
        goal_id=goal_id,
        note=checkin.note
    )
    db.add(db_checkin)
    db.commit()
    db.refresh(db_checkin)
    return db_checkin


@app.delete("/api/checkins/{checkin_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_checkin(
    checkin_id: int,
    db: Session = Depends(get_db),
    authenticated: bool = Depends(get_current_user)
):
    """Delete a check-in."""
    checkin = db.query(CheckIn).filter(CheckIn.id == checkin_id).first()
    if not checkin:
        raise HTTPException(status_code=404, detail="Check-in not found")
    
    db.delete(checkin)
    db.commit()
    return None


# ============ Email Routes ============

# Cron job secret for triggering monthly emails
CRON_SECRET = os.environ.get("CRON_SECRET", "dev-cron-secret")

@app.post("/api/email/monthly-summary")
async def trigger_monthly_summary(
    request: Request,
    db: Session = Depends(get_db)
):
    """Trigger monthly summary email (called by Render cron job)."""
    # Verify cron secret
    auth_header = request.headers.get("Authorization")
    if auth_header != f"Bearer {CRON_SECRET}":
        raise HTTPException(status_code=403, detail="Invalid cron secret")
    
    from email_service import send_monthly_summary
    
    # Get current year goals with check-ins
    goals = db.query(Goal).filter(Goal.year == CURRENT_YEAR).all()
    goals_data = []
    for goal in goals:
        goal_dict = {
            "id": goal.id,
            "person": goal.person,
            "title": goal.title,
            "description": goal.description,
            "category": goal.category,
            "progress": goal.progress,
            "target_date": goal.target_date,
            "is_habit": goal.is_habit,
            "created_at": goal.created_at.isoformat() if goal.created_at else None,
            "checkins": [
                {
                    "id": c.id,
                    "note": c.note,
                    "created_at": c.created_at.isoformat() if c.created_at else None
                }
                for c in goal.checkins
            ],
            "milestones": [
                {
                    "id": m.id,
                    "title": m.title,
                    "completed": m.completed
                }
                for m in goal.milestones
            ]
        }
        goals_data.append(goal_dict)
    
    success = await send_monthly_summary(goals_data)
    
    if success:
        return {"message": "Monthly summary sent successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to send email")


@app.post("/api/email/test")
async def send_test_email(
    db: Session = Depends(get_db),
    authenticated: bool = Depends(get_current_user)
):
    """Send a test email to verify configuration."""
    from email_service import send_monthly_summary
    
    # Get current year goals with check-ins
    goals = db.query(Goal).filter(Goal.year == CURRENT_YEAR).all()
    goals_data = []
    for goal in goals:
        goal_dict = {
            "id": goal.id,
            "person": goal.person,
            "title": goal.title,
            "description": goal.description,
            "category": goal.category,
            "progress": goal.progress,
            "target_date": goal.target_date,
            "is_habit": goal.is_habit,
            "created_at": goal.created_at.isoformat() if goal.created_at else None,
            "checkins": [
                {
                    "id": c.id,
                    "note": c.note,
                    "created_at": c.created_at.isoformat() if c.created_at else None
                }
                for c in goal.checkins
            ],
            "milestones": [
                {
                    "id": m.id,
                    "title": m.title,
                    "completed": m.completed
                }
                for m in goal.milestones
            ]
        }
        goals_data.append(goal_dict)
    
    success = await send_monthly_summary(goals_data)
    
    if success:
        return {"message": "Test email sent successfully"}
    else:
        raise HTTPException(
            status_code=500, 
            detail="Failed to send email. Check GMAIL_ADDRESS, GMAIL_APP_PASSWORD, and RECIPIENT_EMAILS environment variables."
        )


# ============ Static Files ============

# Mount frontend static files (must be after API routes)
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.exists(frontend_path):
    app.mount("/static", StaticFiles(directory=frontend_path), name="static")
    
    @app.get("/")
    async def serve_frontend():
        """Serve the frontend HTML."""
        return FileResponse(os.path.join(frontend_path, "index.html"))


# ============ Health Check ============

@app.get("/health")
async def health_check():
    """Health check endpoint for Render."""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
