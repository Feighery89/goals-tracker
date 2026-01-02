"""
Email service for sending monthly goal summaries via Gmail SMTP.
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import List, Dict, Any

# Gmail SMTP configuration
GMAIL_ADDRESS = os.environ.get("GMAIL_ADDRESS", "")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "")
RECIPIENT_EMAILS = os.environ.get("RECIPIENT_EMAILS", "").split(",")

# Person names
PERSON_1_NAME = os.environ.get("PERSON_1_NAME", "Mark")
PERSON_2_NAME = os.environ.get("PERSON_2_NAME", "Partner")


def get_motivational_quote() -> str:
    """Return a random motivational quote for the email."""
    quotes = [
        "The secret of getting ahead is getting started. – Mark Twain",
        "It does not matter how slowly you go as long as you do not stop. – Confucius",
        "Success is the sum of small efforts repeated day in and day out. – Robert Collier",
        "A year from now you may wish you had started today. – Karen Lamb",
        "The only impossible journey is the one you never begin. – Tony Robbins",
        "Progress, not perfection. – Unknown",
        "Small steps every day lead to big changes. – Unknown",
        "Together you can achieve anything. – Unknown",
        "Believe you can and you're halfway there. – Theodore Roosevelt",
        "Every accomplishment starts with the decision to try. – John F. Kennedy",
    ]
    import random
    return random.choice(quotes)


def generate_progress_bar(progress: int, width: int = 20) -> str:
    """Generate a text-based progress bar."""
    filled = int(width * progress / 100)
    empty = width - filled
    return f"[{'█' * filled}{'░' * empty}] {progress}%"


def format_goals_html(goals: List[Dict[str, Any]], person_name: str) -> str:
    """Format goals for a person as HTML."""
    person_goals = [g for g in goals if g.get('person') == person_name]
    
    if not person_goals:
        return f"<p><em>No goals set yet for {person_name}</em></p>"
    
    html = ""
    for goal in person_goals:
        progress = goal.get('progress', 0)
        status_emoji = "🎉" if progress == 100 else "🔥" if progress >= 75 else "💪" if progress >= 50 else "🌱"
        
        # Get recent check-ins
        checkins = goal.get('checkins', [])
        recent_checkins = sorted(checkins, key=lambda x: x.get('created_at', ''), reverse=True)[:2]
        
        checkin_html = ""
        if recent_checkins:
            checkin_html = "<ul style='margin: 8px 0 0 0; padding-left: 20px; color: #6b5c52;'>"
            for checkin in recent_checkins:
                date = datetime.fromisoformat(checkin['created_at'].replace('Z', '+00:00')).strftime('%b %d')
                checkin_html += f"<li><em>{date}:</em> {checkin.get('note', '')[:100]}</li>"
            checkin_html += "</ul>"
        
        html += f"""
        <div style="background: #fffbf7; border: 1px solid #e8ddd4; border-radius: 12px; padding: 16px; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 24px;">{status_emoji}</span>
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: #3d3029; margin-bottom: 4px;">{goal.get('title', 'Untitled')}</div>
                    <div style="font-size: 13px; color: #9a8b80;">{goal.get('category', 'Personal')}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 24px; font-weight: bold; color: {'#5b8a72' if progress >= 75 else '#e07b53'};">{progress}%</div>
                </div>
            </div>
            <div style="margin-top: 12px; background: #e8ddd4; border-radius: 4px; height: 8px; overflow: hidden;">
                <div style="background: linear-gradient(90deg, #e07b53, #f5a882); height: 100%; width: {progress}%; transition: width 0.3s;"></div>
            </div>
            {checkin_html}
        </div>
        """
    
    return html


def generate_monthly_email(goals: List[Dict[str, Any]]) -> tuple[str, str]:
    """Generate the monthly summary email content."""
    month_name = datetime.now().strftime("%B %Y")
    quote = get_motivational_quote()
    
    # Calculate stats
    total_goals = len(goals)
    completed_goals = sum(1 for g in goals if g.get('progress', 0) == 100)
    avg_progress = sum(g.get('progress', 0) for g in goals) / total_goals if total_goals > 0 else 0
    
    subject = f"🎯 Your Goals Update – {month_name}"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #fef3e2 0%, #fce7d6 50%, #fad4c0 100%); min-height: 100vh;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 32px;">
                <div style="font-size: 48px; margin-bottom: 16px;">🌅</div>
                <h1 style="font-size: 28px; color: #3d3029; margin: 0 0 8px 0;">Your Goals Update</h1>
                <p style="color: #6b5c52; margin: 0;">{month_name}</p>
            </div>
            
            <!-- Stats Card -->
            <div style="background: white; border-radius: 16px; padding: 24px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(61, 48, 41, 0.1);">
                <div style="display: flex; justify-content: space-around; text-align: center;">
                    <div>
                        <div style="font-size: 32px; font-weight: bold; color: #e07b53;">{total_goals}</div>
                        <div style="font-size: 13px; color: #9a8b80;">Total Goals</div>
                    </div>
                    <div>
                        <div style="font-size: 32px; font-weight: bold; color: #5b8a72;">{completed_goals}</div>
                        <div style="font-size: 13px; color: #9a8b80;">Completed</div>
                    </div>
                    <div>
                        <div style="font-size: 32px; font-weight: bold; color: #d4a253;">{avg_progress:.0f}%</div>
                        <div style="font-size: 13px; color: #9a8b80;">Avg Progress</div>
                    </div>
                </div>
            </div>
            
            <!-- Person 1 Goals -->
            <div style="background: white; border-radius: 16px; padding: 24px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(61, 48, 41, 0.1);">
                <h2 style="font-size: 20px; color: #3d3029; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px;">
                    <span style="width: 32px; height: 32px; background: linear-gradient(135deg, #f5a882, #e07b53); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;">👤</span>
                    {PERSON_1_NAME}'s Goals
                </h2>
                {format_goals_html(goals, PERSON_1_NAME)}
            </div>
            
            <!-- Person 2 Goals -->
            <div style="background: white; border-radius: 16px; padding: 24px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(61, 48, 41, 0.1);">
                <h2 style="font-size: 20px; color: #3d3029; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px;">
                    <span style="width: 32px; height: 32px; background: linear-gradient(135deg, #7ba893, #5b8a72); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;">💕</span>
                    {PERSON_2_NAME}'s Goals
                </h2>
                {format_goals_html(goals, PERSON_2_NAME)}
            </div>
            
            <!-- Motivation -->
            <div style="background: white; border-radius: 16px; padding: 24px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(61, 48, 41, 0.1); text-align: center;">
                <div style="font-size: 24px; margin-bottom: 12px;">💭</div>
                <p style="color: #3d3029; font-style: italic; margin: 0; line-height: 1.6;">"{quote}"</p>
            </div>
            
            <!-- CTA -->
            <div style="text-align: center;">
                <p style="color: #6b5c52; margin-bottom: 16px;">Time to check in on your progress!</p>
                <a href="{os.environ.get('APP_URL', 'https://your-app.onrender.com')}" 
                   style="display: inline-block; background: #e07b53; color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 600;">
                    Update Your Goals →
                </a>
            </div>
            
            <!-- Footer -->
            <div style="text-align: center; margin-top: 40px; color: #9a8b80; font-size: 13px;">
                <p>Keep crushing it together! 💪</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return subject, html_content


def send_email(subject: str, html_content: str, recipients: List[str] = None) -> bool:
    """Send an email via Gmail SMTP."""
    if not GMAIL_ADDRESS or not GMAIL_APP_PASSWORD:
        print("Email not configured: Missing GMAIL_ADDRESS or GMAIL_APP_PASSWORD")
        return False
    
    if recipients is None:
        recipients = [r.strip() for r in RECIPIENT_EMAILS if r.strip()]
    
    if not recipients:
        print("No recipients configured")
        return False
    
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"Goals Tracker <{GMAIL_ADDRESS}>"
        msg['To'] = ", ".join(recipients)
        
        # Plain text fallback
        plain_text = f"Your monthly goals update is ready! Visit your Goals Tracker to see your progress."
        msg.attach(MIMEText(plain_text, 'plain'))
        msg.attach(MIMEText(html_content, 'html'))
        
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(GMAIL_ADDRESS, GMAIL_APP_PASSWORD)
            server.sendmail(GMAIL_ADDRESS, recipients, msg.as_string())
        
        print(f"Email sent successfully to {recipients}")
        return True
        
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False


async def send_monthly_summary(goals: List[Dict[str, Any]]) -> bool:
    """Generate and send the monthly summary email."""
    subject, html_content = generate_monthly_email(goals)
    return send_email(subject, html_content)

