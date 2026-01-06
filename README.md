# Goals Tracker 🎯

A couples' New Year's resolution tracker with progress visualization and monthly email summaries.

## Features

- **Goal Tracking** - Create goals with categories, descriptions, and target dates
- **Progress Visualization** - Circular progress rings for each goal
- **Check-ins** - Add notes and updates to track your journey
- **Two-Person View** - Side-by-side columns for accountability
- **Monthly Emails** - Automated progress summaries via Gmail
- **Password Protection** - Simple shared password authentication
- **Confetti Celebration** - When you hit 100% on a goal!

## Quick Start (Local Development)

```bash
cd goals-tracker

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt

# Run the server
cd backend
uvicorn main:app --reload

# Open http://localhost:8000
# Default password: goals2026
```

## Deploy to Render

### Option 1: One-Click Deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

### Option 2: Manual Setup

1. **Create a new Web Service** on [Render](https://render.com)
   - Connect your GitHub repo
   - Runtime: Python 3
   - Build Command: `pip install -r backend/requirements.txt`
   - Start Command: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`

2. **Add a Disk** for persistent SQLite storage:
   - Mount Path: `/var/data`
   - Size: 1 GB

3. **Set Environment Variables**:

   | Variable | Description | Example |
   |----------|-------------|---------|
   | `DB_PATH` | Database file path | `/var/data/goals.db` |
   | `APP_PASSWORD` | Shared login password | `yourpassword123` |
   | `PERSON_1_NAME` | First person's name | `Mark` |
   | `PERSON_2_NAME` | Second person's name | `Sarah` |
   | `GMAIL_ADDRESS` | Your Gmail address | `you@gmail.com` |
   | `GMAIL_APP_PASSWORD` | Gmail App Password | `xxxx xxxx xxxx xxxx` |
   | `RECIPIENT_EMAILS` | Email recipients | `you@gmail.com,partner@gmail.com` |
   | `APP_URL` | Your Render URL | `https://goals-tracker.onrender.com` |
   | `SECRET_KEY` | JWT secret (auto-generated) | - |
   | `CRON_SECRET` | Cron job secret (auto-generated) | - |

4. **Create a Cron Job** for monthly emails:
   - Schedule: `0 9 1 * *` (9 AM on the 1st of every month)
   - See `render.yaml` for the full configuration

## Gmail App Password Setup

To send emails via Gmail:

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable **2-Step Verification** if not already enabled
3. Go to **App passwords** (at the bottom of 2-Step Verification page)
4. Select **Mail** and **Other (Custom name)** → Enter "Goals Tracker"
5. Copy the 16-character password
6. Add it as `GMAIL_APP_PASSWORD` in Render environment variables

## Project Structure

```
goals-tracker/
├── backend/
│   ├── main.py              # FastAPI app
│   ├── database.py          # SQLite setup
│   ├── models.py            # Pydantic schemas
│   ├── email_service.py     # Gmail SMTP
│   └── requirements.txt
├── frontend/
│   ├── index.html           # Main page
│   ├── styles.css           # Styling
│   └── app.js               # JavaScript
├── render.yaml              # Render Blueprint
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/login` | Authenticate |
| POST | `/api/logout` | Logout |
| GET | `/api/config` | Get app config |
| GET | `/api/goals` | List all goals |
| POST | `/api/goals` | Create a goal |
| PATCH | `/api/goals/:id` | Update a goal |
| DELETE | `/api/goals/:id` | Delete a goal |
| POST | `/api/goals/:id/checkins` | Add check-in |
| DELETE | `/api/checkins/:id` | Delete check-in |
| POST | `/api/email/test` | Send test email |
| GET | `/health` | Health check |

## Tech Stack

- **Backend**: Python, FastAPI, SQLAlchemy, SQLite
- **Frontend**: Vanilla HTML/CSS/JS
- **Auth**: JWT tokens with HTTP-only cookies
- **Email**: Gmail SMTP
- **Hosting**: Render (free tier)

## License

MIT
