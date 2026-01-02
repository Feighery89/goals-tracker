/**
 * Goals Tracker - Frontend Application
 * A couples' New Year's resolution tracker
 */

// ============ State ============
let config = { persons: ['Mark', 'Partner'], categories: [] };
let goals = [];

// ============ API Helpers ============
async function api(endpoint, options = {}) {
    const response = await fetch(`/api${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        credentials: 'include',
    });
    
    if (response.status === 401) {
        showLogin();
        throw new Error('Unauthorized');
    }
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Request failed');
    }
    
    if (response.status === 204) return null;
    return response.json();
}

// ============ Auth ============
async function checkAuth() {
    try {
        await api('/auth/check');
        await loadApp();
    } catch {
        showLogin();
    }
}

function showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
}

function showApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
}

async function handleLogin(e) {
    e.preventDefault();
    const password = document.getElementById('password-input').value;
    const errorEl = document.getElementById('login-error');
    
    try {
        const result = await api('/login', {
            method: 'POST',
            body: JSON.stringify({ password }),
        });
        
        if (result.success) {
            errorEl.textContent = '';
            await loadApp();
        } else {
            errorEl.textContent = result.message || 'Incorrect password';
            document.getElementById('password-input').focus();
        }
    } catch (err) {
        errorEl.textContent = 'Connection error. Please try again.';
    }
}

async function handleLogout() {
    try {
        await api('/logout', { method: 'POST' });
    } catch {}
    showLogin();
    document.getElementById('password-input').value = '';
}

// ============ Load App ============
async function loadApp() {
    showApp();
    
    // Load config
    try {
        config = await api('/config');
    } catch (err) {
        console.error('Failed to load config:', err);
    }
    
    // Populate category dropdown
    const categorySelect = document.getElementById('goal-category');
    categorySelect.innerHTML = config.categories
        .map(cat => `<option value="${cat}">${cat}</option>`)
        .join('');
    
    // Load goals
    await loadGoals();
    
    // Render dashboard
    renderDashboard();
}

async function loadGoals() {
    try {
        goals = await api('/goals');
    } catch (err) {
        console.error('Failed to load goals:', err);
        goals = [];
    }
}

// ============ Render Dashboard ============
function renderDashboard() {
    const grid = document.getElementById('dashboard-grid');
    grid.innerHTML = config.persons.map((person, index) => `
        <div class="person-column">
            <div class="person-header">
                <h2>
                    <div class="person-avatar">${getPersonEmoji(index)}</div>
                    ${escapeHtml(person)}'s Goals
                </h2>
                <button class="add-goal-btn" onclick="openAddGoalModal('${escapeHtml(person)}')" title="Add new goal">+</button>
            </div>
            <div class="goals-list" id="goals-${index}">
                ${renderGoalsForPerson(person)}
            </div>
        </div>
    `).join('');
}

function renderGoalsForPerson(person) {
    const personGoals = goals.filter(g => g.person === person);
    
    if (personGoals.length === 0) {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">🎯</div>
                <p>No goals yet.<br>Add your first one!</p>
            </div>
        `;
    }
    
    return personGoals.map(goal => renderGoalCard(goal)).join('');
}

function renderGoalCard(goal) {
    const circumference = 2 * Math.PI * 23;
    const offset = circumference - (goal.progress / 100) * circumference;
    
    return `
        <div class="goal-card" onclick="openGoalDetail(${goal.id})">
            <div class="goal-card-header">
                <div class="progress-ring">
                    <svg width="56" height="56" viewBox="0 0 56 56">
                        <circle class="progress-ring-bg" cx="28" cy="28" r="23"/>
                        <circle 
                            class="progress-ring-fill" 
                            cx="28" cy="28" r="23"
                            stroke-dasharray="${circumference}"
                            stroke-dashoffset="${offset}"
                            style="stroke: ${getCategoryColor(goal.category)}"
                        />
                    </svg>
                    <span class="progress-ring-text">${goal.progress}%</span>
                </div>
                <div class="goal-card-info">
                    <div class="goal-card-title">${escapeHtml(goal.title)}</div>
                    <div class="goal-card-meta">
                        <span class="goal-category" data-category="${escapeHtml(goal.category)}">${escapeHtml(goal.category)}</span>
                        ${goal.target_date ? `<span>📅 ${formatDate(goal.target_date)}</span>` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function getPersonEmoji(index) {
    return index === 0 ? '👤' : '💕';
}

function getCategoryColor(category) {
    const colors = {
        'Health': '#5b8a72',
        'Finance': '#4a7c9b',
        'Career': '#8b6bb5',
        'Relationship': '#c75d7a',
        'Personal': '#d4a253',
        'Other': '#6b5c52',
    };
    return colors[category] || colors['Other'];
}

// ============ Modals ============
function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
    document.body.style.overflow = '';
}

function openAddGoalModal(person) {
    document.getElementById('goal-person').value = person;
    document.getElementById('add-goal-form').reset();
    document.getElementById('goal-person').value = person;
    openModal('add-goal-modal');
}

async function handleAddGoal(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    
    const goal = {
        person: formData.get('person'),
        title: formData.get('title'),
        description: formData.get('description') || '',
        category: formData.get('category'),
        target_date: formData.get('target_date') || null,
    };
    
    try {
        await api('/goals', {
            method: 'POST',
            body: JSON.stringify(goal),
        });
        
        closeModal('add-goal-modal');
        await loadGoals();
        renderDashboard();
    } catch (err) {
        alert('Failed to create goal: ' + err.message);
    }
}

// ============ Goal Detail ============
async function openGoalDetail(goalId) {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    
    document.getElementById('detail-goal-title').textContent = goal.title;
    
    const content = document.getElementById('goal-detail-content');
    content.innerHTML = `
        <div class="detail-section">
            <h3>Progress</h3>
            <div class="progress-slider-container">
                <input 
                    type="range" 
                    class="progress-slider" 
                    min="0" max="100" 
                    value="${goal.progress}"
                    onchange="updateProgress(${goal.id}, this.value)"
                >
                <span class="progress-value" id="progress-value-${goal.id}">${goal.progress}%</span>
            </div>
        </div>
        
        ${goal.description ? `
            <div class="detail-section">
                <h3>Description</h3>
                <p class="detail-description">${escapeHtml(goal.description)}</p>
            </div>
        ` : ''}
        
        <div class="detail-section">
            <h3>Details</h3>
            <div class="detail-meta">
                <div class="detail-meta-item">
                    <span class="goal-category" data-category="${escapeHtml(goal.category)}">${escapeHtml(goal.category)}</span>
                </div>
                ${goal.target_date ? `
                    <div class="detail-meta-item">
                        📅 Target: ${formatDate(goal.target_date)}
                    </div>
                ` : ''}
                <div class="detail-meta-item">
                    🗓️ Created: ${formatDate(goal.created_at)}
                </div>
            </div>
        </div>
        
        <div class="detail-section">
            <h3>Check-ins</h3>
            <div class="checkins-list" style="margin-left: 1rem; border-left: 2px solid var(--color-border-light); padding-left: 1rem;">
                ${goal.checkins.length > 0 ? goal.checkins
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                    .map(checkin => `
                        <div class="checkin-item">
                            <p class="checkin-note">${escapeHtml(checkin.note)}</p>
                            <span class="checkin-date">${formatDateTime(checkin.created_at)}</span>
                            <button class="btn btn-icon checkin-delete" onclick="event.stopPropagation(); deleteCheckin(${checkin.id}, ${goal.id})" title="Delete">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                </svg>
                            </button>
                        </div>
                    `).join('') : '<p style="color: var(--color-text-muted); font-style: italic;">No check-ins yet</p>'
                }
            </div>
        </div>
        
        <div class="detail-actions">
            <button class="btn btn-secondary" onclick="openCheckinModal(${goal.id})">
                ✏️ Add Check-in
            </button>
            <button class="btn btn-ghost" onclick="deleteGoal(${goal.id})" style="color: var(--color-danger);">
                🗑️ Delete Goal
            </button>
        </div>
    `;
    
    // Add progress slider event listener
    const slider = content.querySelector('.progress-slider');
    slider.addEventListener('input', (e) => {
        document.getElementById(`progress-value-${goal.id}`).textContent = e.target.value + '%';
    });
    
    openModal('goal-detail-modal');
}

async function updateProgress(goalId, value) {
    const oldGoal = goals.find(g => g.id === goalId);
    const wasNotComplete = oldGoal && oldGoal.progress < 100;
    
    try {
        await api(`/goals/${goalId}`, {
            method: 'PATCH',
            body: JSON.stringify({ progress: parseInt(value) }),
        });
        
        await loadGoals();
        renderDashboard();
        
        // Confetti for hitting 100%!
        if (wasNotComplete && parseInt(value) === 100) {
            triggerConfetti();
        }
    } catch (err) {
        alert('Failed to update progress: ' + err.message);
    }
}

async function deleteGoal(goalId) {
    if (!confirm('Are you sure you want to delete this goal and all its check-ins?')) return;
    
    try {
        await api(`/goals/${goalId}`, { method: 'DELETE' });
        closeModal('goal-detail-modal');
        await loadGoals();
        renderDashboard();
    } catch (err) {
        alert('Failed to delete goal: ' + err.message);
    }
}

// ============ Check-ins ============
function openCheckinModal(goalId) {
    document.getElementById('checkin-goal-id').value = goalId;
    document.getElementById('checkin-form').reset();
    document.getElementById('checkin-goal-id').value = goalId;
    closeModal('goal-detail-modal');
    openModal('checkin-modal');
}

async function handleAddCheckin(e) {
    e.preventDefault();
    const goalId = document.getElementById('checkin-goal-id').value;
    const note = document.getElementById('checkin-note').value;
    
    try {
        await api(`/goals/${goalId}/checkins`, {
            method: 'POST',
            body: JSON.stringify({ note }),
        });
        
        closeModal('checkin-modal');
        await loadGoals();
        renderDashboard();
        openGoalDetail(parseInt(goalId));
    } catch (err) {
        alert('Failed to add check-in: ' + err.message);
    }
}

async function deleteCheckin(checkinId, goalId) {
    if (!confirm('Delete this check-in?')) return;
    
    try {
        await api(`/checkins/${checkinId}`, { method: 'DELETE' });
        await loadGoals();
        renderDashboard();
        openGoalDetail(goalId);
    } catch (err) {
        alert('Failed to delete check-in: ' + err.message);
    }
}

// ============ Confetti ============
function triggerConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const particles = [];
    const colors = ['#e07b53', '#5b8a72', '#d4a253', '#c75d7a', '#4a7c9b', '#8b6bb5'];
    
    for (let i = 0; i < 150; i++) {
        particles.push({
            x: canvas.width / 2,
            y: canvas.height / 2,
            vx: (Math.random() - 0.5) * 20,
            vy: (Math.random() - 0.5) * 20 - 10,
            size: Math.random() * 10 + 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 10,
        });
    }
    
    let frame = 0;
    const maxFrames = 120;
    
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.3; // gravity
            p.rotation += p.rotationSpeed;
            p.vx *= 0.99;
            
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rotation * Math.PI) / 180);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size / 2);
            ctx.restore();
        });
        
        frame++;
        if (frame < maxFrames) {
            requestAnimationFrame(animate);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    
    animate();
}

// ============ Utilities ============
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

// ============ Event Listeners ============
document.getElementById('login-form').addEventListener('submit', handleLogin);
document.getElementById('logout-btn').addEventListener('click', handleLogout);
document.getElementById('add-goal-form').addEventListener('submit', handleAddGoal);
document.getElementById('checkin-form').addEventListener('submit', handleAddCheckin);

// Close modals on backdrop click
document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', () => {
        backdrop.closest('.modal').classList.add('hidden');
        document.body.style.overflow = '';
    });
});

// Close modals on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal:not(.hidden)').forEach(modal => {
            modal.classList.add('hidden');
        });
        document.body.style.overflow = '';
    }
});

// ============ Init ============
checkAuth();

