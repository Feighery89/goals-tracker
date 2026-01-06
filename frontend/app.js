/**
 * G&M Yearly Goals Tracker - Frontend Application
 */

// ============ State ============

let config = { persons: [], categories: [], currentYear: 2026 };
let goals = [];
let selectedYear = 2026;

// ============ API Helpers ============

async function api(endpoint, options = {}) {
    const res = await fetch(`/api${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        credentials: 'include'
    });

    if (res.status === 401) {
        showLogin();
        throw new Error('Unauthorized');
    }

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'An error occurred' }));
        throw new Error(err.detail || 'An error occurred');
    }

    if (res.status === 204) return null;
    return res.json();
}

// ============ Auth ============

async function login(password) {
    try {
        const result = await api('/login', {
            method: 'POST',
            body: JSON.stringify({ password })
        });

        if (result.success) {
            showApp();
            return true;
        } else {
            return false;
        }
    } catch (e) {
        console.error('Login error:', e);
        return false;
    }
}

async function logout() {
    await api('/logout', { method: 'POST' });
    showLogin();
}

async function checkAuth() {
    try {
        await api('/auth/check');
        return true;
    } catch {
        return false;
    }
}

// ============ Data Loading ============

async function loadConfig() {
    config = await api('/config');
    selectedYear = config.currentYear;
    populateCategories();
}

async function loadYears() {
    const result = await api('/years');
    populateYearSelector(result.years);
}

async function loadGoals() {
    goals = await api(`/goals?year=${selectedYear}`);
    renderGoals();
}

// ============ UI Population ============

function populateCategories() {
    const select = document.getElementById('goal-category');
    select.innerHTML = config.categories.map(cat =>
        `<option value="${cat}">${cat}</option>`
    ).join('');
}

function populateYearSelector(years) {
    const select = document.getElementById('year-select');
    select.innerHTML = years.map(year =>
        `<option value="${year}" ${year === selectedYear ? 'selected' : ''}>${year}</option>`
    ).join('');
}

// ============ Rendering ============

function renderGoals() {
    const grid = document.getElementById('dashboard-grid');

    grid.innerHTML = config.persons.map((person, idx) => {
        const personGoals = goals.filter(g => g.person === person);
        const emoji = idx === 0 ? '👨' : '👩';

        return `
            <div class="person-column">
                <div class="person-header">
                    <h2>
                        <span class="person-avatar">${emoji}</span>
                        ${person}
                    </h2>
                    <button class="add-goal-btn" onclick="openAddGoalModal('${person}')" title="Add goal">
                        +
                    </button>
                </div>
                <div class="goals-list">
                    ${personGoals.length === 0
                ? `<div class="empty-state">
                               <div class="empty-state-icon">🎯</div>
                               <p>No goals yet for ${selectedYear}</p>
                               <p style="font-size: 0.875rem">Click + to add one!</p>
                           </div>`
                : personGoals.map(renderGoalCard).join('')
            }
                </div>
            </div>
        `;
    }).join('');
}

function renderGoalCard(goal) {
    const circumference = 2 * Math.PI * 22;
    const offset = circumference - (goal.progress / 100) * circumference;

    const completedMilestones = goal.milestones?.filter(m => m.completed).length || 0;
    const totalMilestones = goal.milestones?.length || 0;

    let milestonesHtml = '';
    if (totalMilestones > 0) {
        milestonesHtml = `
            <div class="milestones-list">
                <h4>Milestones (${completedMilestones}/${totalMilestones})</h4>
                ${goal.milestones.slice(0, 3).map(m => `
                    <div class="milestone-item ${m.completed ? 'completed' : ''}">
                        <div class="milestone-checkbox ${m.completed ? 'completed' : ''}" 
                             onclick="event.stopPropagation(); toggleMilestone(${m.id}, ${!m.completed})"></div>
                        <span class="milestone-title">${escapeHtml(m.title)}</span>
                    </div>
                `).join('')}
                ${totalMilestones > 3 ? `<p style="font-size: 0.75rem; color: var(--color-text-muted); padding-top: 0.5rem;">+${totalMilestones - 3} more</p>` : ''}
            </div>
        `;
    }

    return `
        <div class="goal-card" onclick="openGoalDetail(${goal.id})">
            ${goal.is_habit ? '<span class="habit-badge">Habit</span>' : ''}
            <div class="goal-card-header">
                <div class="progress-ring">
                    <svg width="56" height="56">
                        <circle class="progress-ring-bg" cx="28" cy="28" r="22"/>
                        <circle class="progress-ring-fill" cx="28" cy="28" r="22"
                            stroke-dasharray="${circumference}"
                            stroke-dashoffset="${offset}"/>
                    </svg>
                    <span class="progress-ring-text">${goal.progress}%</span>
                </div>
                <div class="goal-card-info">
                    <div class="goal-card-title">${escapeHtml(goal.title)}</div>
                    <div class="goal-card-meta">
                        <span class="goal-category" data-category="${goal.category}">${goal.category}</span>
                        ${goal.target_date ? `<span>📅 ${formatDate(goal.target_date)}</span>` : ''}
                    </div>
                </div>
            </div>
            ${milestonesHtml}
            <div class="goal-card-actions">
                <button class="btn btn-secondary" onclick="event.stopPropagation(); openCheckinModal(${goal.id})">
                    + Check-in
                </button>
                <button class="btn btn-secondary" onclick="event.stopPropagation(); openGoalDetail(${goal.id})">
                    View
                </button>
            </div>
        </div>
    `;
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
    document.getElementById('milestones-container').innerHTML = '';
    // Add one empty milestone input
    addMilestoneInput();
    openModal('add-goal-modal');
}

function addMilestoneInput() {
    const container = document.getElementById('milestones-container');
    const count = container.children.length;

    if (count >= 10) return; // Max 10 milestones

    const row = document.createElement('div');
    row.className = 'milestone-input-row';
    row.innerHTML = `
        <input type="text" name="milestone_${count}" placeholder="e.g., Complete first week">
        <button type="button" class="btn btn-ghost" onclick="this.parentElement.remove()" title="Remove">✕</button>
    `;
    container.appendChild(row);
}

function openCheckinModal(goalId) {
    document.getElementById('checkin-goal-id').value = goalId;
    document.getElementById('checkin-form').reset();
    openModal('checkin-modal');
}

async function openGoalDetail(goalId) {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    document.getElementById('detail-goal-title').textContent = goal.title;

    const content = document.getElementById('goal-detail-content');
    const circumference = 2 * Math.PI * 40;
    const offset = circumference - (goal.progress / 100) * circumference;

    let milestonesHtml = '';
    if (goal.milestones?.length > 0) {
        milestonesHtml = `
            <div class="detail-section">
                <h3>📋 Milestones</h3>
                <div class="milestones-list" style="border-top: none; margin-top: 0; padding-top: 0;">
                    ${goal.milestones.map(m => `
                        <div class="milestone-item ${m.completed ? 'completed' : ''}">
                            <div class="milestone-checkbox ${m.completed ? 'completed' : ''}" 
                                 onclick="toggleMilestone(${m.id}, ${!m.completed})"></div>
                            <span class="milestone-title">${escapeHtml(m.title)}</span>
                            <button class="btn btn-icon milestone-delete" onclick="deleteMilestone(${m.id})" title="Delete">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                </svg>
                            </button>
                        </div>
                    `).join('')}
                </div>
                <button class="btn btn-secondary btn-sm" onclick="openAddMilestoneModal(${goal.id})" style="margin-top: 0.75rem">
                    + Add milestone
                </button>
            </div>
        `;
    } else {
        milestonesHtml = `
            <div class="detail-section">
                <h3>📋 Milestones</h3>
                <p style="color: var(--color-text-muted); margin-bottom: 0.75rem;">Break this goal into smaller steps</p>
                <button class="btn btn-secondary btn-sm" onclick="openAddMilestoneModal(${goal.id})">
                    + Add milestone
                </button>
            </div>
        `;
    }

    content.innerHTML = `
        <div style="display: flex; gap: 2rem; align-items: flex-start; margin-bottom: 1.5rem;">
            <div class="progress-ring" style="width: 100px; height: 100px;">
                <svg width="100" height="100">
                    <circle class="progress-ring-bg" cx="50" cy="50" r="40"/>
                    <circle class="progress-ring-fill" cx="50" cy="50" r="40"
                        stroke-dasharray="${circumference}"
                        stroke-dashoffset="${offset}"/>
                </svg>
                <span class="progress-ring-text" style="font-size: 1.25rem">${goal.progress}%</span>
            </div>
            <div style="flex: 1;">
                <div class="detail-meta">
                    <div class="detail-meta-item">
                        <span class="goal-category" data-category="${goal.category}">${goal.category}</span>
                    </div>
                    ${goal.target_date ? `<div class="detail-meta-item">📅 ${formatDate(goal.target_date)}</div>` : ''}
                    ${goal.is_habit ? `<div class="detail-meta-item">🔄 Habit</div>` : ''}
                </div>
                ${goal.description ? `<p class="detail-description" style="margin-top: 1rem">${escapeHtml(goal.description)}</p>` : ''}
            </div>
        </div>
        
        <div class="detail-section">
            <h3>📊 Progress</h3>
            <div class="progress-slider-container">
                <input type="range" class="progress-slider" min="0" max="100" value="${goal.progress}"
                    onchange="updateGoalProgress(${goal.id}, this.value)">
                <span class="progress-value">${goal.progress}%</span>
            </div>
        </div>
        
        ${milestonesHtml}
        
        <div class="detail-section">
            <h3>📝 Check-ins (${goal.checkins?.length || 0})</h3>
            <div class="checkins-list" style="padding-left: 1.25rem;">
                ${goal.checkins?.length > 0
            ? goal.checkins.map(c => `
                        <div class="checkin-item">
                            <p class="checkin-note">${escapeHtml(c.note)}</p>
                            <span class="checkin-date">${formatDateTime(c.created_at)}</span>
                            <button class="btn btn-icon checkin-delete" onclick="deleteCheckin(${c.id})" title="Delete">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                </svg>
                            </button>
                        </div>
                    `).join('')
            : '<p style="color: var(--color-text-muted)">No check-ins yet</p>'
        }
            </div>
        </div>
        
        <div class="detail-actions">
            <button class="btn btn-primary" onclick="openCheckinModal(${goal.id}); closeModal('goal-detail-modal')">
                Add Check-in
            </button>
            <button class="btn btn-secondary" onclick="deleteGoal(${goal.id})">
                Delete Goal
            </button>
        </div>
    `;

    openModal('goal-detail-modal');
}

function openAddMilestoneModal(goalId) {
    document.getElementById('milestone-goal-id').value = goalId;
    document.getElementById('add-milestone-form').reset();
    openModal('add-milestone-modal');
}

// ============ API Actions ============

async function createGoal(formData) {
    const milestones = [];
    for (let i = 0; i < 10; i++) {
        const val = formData.get(`milestone_${i}`);
        if (val && val.trim()) {
            milestones.push(val.trim());
        }
    }

    const goal = {
        year: selectedYear,
        person: formData.get('person'),
        title: formData.get('title'),
        description: formData.get('description') || '',
        category: formData.get('category'),
        target_date: formData.get('target_date') || null,
        is_habit: formData.get('is_habit') === 'on',
        milestones
    };

    await api('/goals', {
        method: 'POST',
        body: JSON.stringify(goal)
    });

    await loadGoals();
    closeModal('add-goal-modal');
}

async function updateGoalProgress(goalId, progress) {
    await api(`/goals/${goalId}`, {
        method: 'PATCH',
        body: JSON.stringify({ progress: parseInt(progress) })
    });

    // Check for 100% completion
    if (parseInt(progress) === 100) {
        triggerConfetti();
    }

    await loadGoals();

    // Update detail modal if open
    const goal = goals.find(g => g.id === goalId);
    if (goal && !document.getElementById('goal-detail-modal').classList.contains('hidden')) {
        openGoalDetail(goalId);
    }
}

async function deleteGoal(goalId) {
    if (!confirm('Are you sure you want to delete this goal and all its check-ins?')) return;

    await api(`/goals/${goalId}`, { method: 'DELETE' });
    closeModal('goal-detail-modal');
    await loadGoals();
}

async function createCheckin(goalId, note) {
    await api(`/goals/${goalId}/checkins`, {
        method: 'POST',
        body: JSON.stringify({ note })
    });

    await loadGoals();
    closeModal('checkin-modal');
}

async function deleteCheckin(checkinId) {
    if (!confirm('Delete this check-in?')) return;

    await api(`/checkins/${checkinId}`, { method: 'DELETE' });
    await loadGoals();

    // Refresh detail modal
    const goalId = parseInt(document.getElementById('checkin-goal-id').value);
    if (goalId) {
        openGoalDetail(goalId);
    }
}

async function createMilestone(goalId, title) {
    await api(`/goals/${goalId}/milestones`, {
        method: 'POST',
        body: JSON.stringify({ title })
    });

    await loadGoals();
    closeModal('add-milestone-modal');
    openGoalDetail(goalId);
}

async function toggleMilestone(milestoneId, completed) {
    await api(`/milestones/${milestoneId}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed })
    });

    await loadGoals();

    // Refresh detail modal if open
    const modal = document.getElementById('goal-detail-modal');
    if (!modal.classList.contains('hidden')) {
        const goalId = parseInt(document.getElementById('milestone-goal-id').value) ||
            goals.find(g => g.milestones?.some(m => m.id === milestoneId))?.id;
        if (goalId) {
            openGoalDetail(goalId);
        }
    }
}

async function deleteMilestone(milestoneId) {
    if (!confirm('Delete this milestone?')) return;

    const goal = goals.find(g => g.milestones?.some(m => m.id === milestoneId));

    await api(`/milestones/${milestoneId}`, { method: 'DELETE' });
    await loadGoals();

    if (goal) {
        openGoalDetail(goal.id);
    }
}

// ============ UI Helpers ============

function showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
}

function showApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    init();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatDateTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ============ Confetti ============

function triggerConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#e07b53', '#5b8a72', '#d4a253', '#8b6bb5', '#c75d7a', '#4a7c9b'];

    for (let i = 0; i < 150; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            vx: (Math.random() - 0.5) * 8,
            vy: Math.random() * 3 + 2,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: Math.random() * 8 + 4,
            rotation: Math.random() * 360
        });
    }

    let frame = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        particles.forEach(p => {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation * Math.PI / 180);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
            ctx.restore();

            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.1;
            p.rotation += 5;
        });

        frame++;
        if (frame < 150) {
            requestAnimationFrame(animate);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    animate();
}

// ============ Event Listeners ============

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('password-input').value;
    const errorEl = document.getElementById('login-error');

    const success = await login(password);
    if (!success) {
        errorEl.textContent = 'Incorrect password';
        document.getElementById('password-input').value = '';
    }
});

document.getElementById('logout-btn').addEventListener('click', logout);

document.getElementById('year-select').addEventListener('change', async (e) => {
    selectedYear = parseInt(e.target.value);
    await loadGoals();
});

document.getElementById('add-goal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await createGoal(new FormData(e.target));
});

document.getElementById('checkin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const goalId = parseInt(document.getElementById('checkin-goal-id').value);
    const note = document.getElementById('checkin-note').value;
    await createCheckin(goalId, note);
});

document.getElementById('add-milestone-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const goalId = parseInt(document.getElementById('milestone-goal-id').value);
    const title = document.getElementById('milestone-title').value;
    await createMilestone(goalId, title);
});

// Close modals on backdrop click
document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', () => {
        backdrop.closest('.modal').classList.add('hidden');
        document.body.style.overflow = '';
    });
});

// ============ Initialize ============

async function init() {
    try {
        await loadConfig();
        await loadYears();
        await loadGoals();
    } catch (e) {
        console.error('Init error:', e);
    }
}

// Check auth on load
(async () => {
    if (await checkAuth()) {
        showApp();
    } else {
        showLogin();
    }
})();
