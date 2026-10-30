const app = document.querySelector("#app");
const toast = document.querySelector("#toast");

const icons = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="10" width="8" height="11" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/></svg>',
  workouts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5v11m11-11v11M3 9v6m18-6v6M6.5 12h11"/></svg>',
  bmi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5m0 14h16M8 15l3-4 3 2 5-7"/><path d="M16 6h3v3"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17l5-5-5-5m5 5H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></svg>',
  strength: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5v11m11-11v11M3 9v6m18-6v6M6.5 12h11"/></svg>',
  cardio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 8.6c0 5.2-8.8 11-8.8 11s-8.8-5.8-8.8-11a4.6 4.6 0 0 1 8.8-1.8 4.6 4.6 0 0 1 8.8 1.8Z"/></svg>',
  walk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="5" r="2"/><path d="m8 21 3-6-3-3 3-4 3 4 4 2m-7 1 4 2 1 4"/></svg>',
  yoga: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2"/><path d="m12 8-2 5 4 2 2 5m-6-7-4 3m4-3 4-2 4 2M8 20h8"/></svg>',
  cycling: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="16" r="4"/><circle cx="18" cy="16" r="4"/><path d="m6 16 4-8h4m-4 8 4-5 4 5m-5-9h2"/></svg>',
  other: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8m-4-4h8"/></svg>',
};

const state = { user: null, workouts: [], bmiRecords: [], page: "dashboard", pageHistory: [], authMode: "login", toastTimer: null, stepWatchId: null, lastGpsPosition: null, gpsStatus: "Location tracking is off." };
const workoutTypes = ["Strength", "Cardio", "Yoga", "Walk", "Cycling", "Other"];
const goals = ["Build strength", "Get more active", "Improve endurance", "Feel healthier"];
const dailyStepGoal = 10000;
const workoutMetValues = { Strength: 5, Cardio: 7.5, Yoga: 3, Walk: 3.5, Cycling: 7.5, Other: 4 };

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

function notify(message, type = "success") {
  window.clearTimeout(state.toastTimer);
  toast.textContent = message;
  toast.className = `toast show${type === "error" ? " error" : ""}`;
  state.toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2800);
}

function dateLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(date);
}

function initials(name) {
  return String(name || "F").split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("");
}

function logo() {
  return '<span class="brand"><span class="brand-mark">f.</span><span>fitday</span></span>';
}

function showAuth(mode = "login") {
  state.authMode = mode;
  const signup = mode === "signup";
  app.innerHTML = `
    <div class="auth-layout">
      <section class="auth-story">
        ${logo()}
        <div class="story-copy">
          <p class="eyebrow">A little better, every day</p>
          <h1>Your kind of fit.<br><span>Your kind of day.</span></h1>
          <p>Make room for movement, find your rhythm, and celebrate the progress that feels good to you.</p>
          <div class="story-note"><span class="note-dot"></span> Small steps. Real progress. All yours.</div>
        </div>
      </section>
      <section class="auth-panel">
        <form class="auth-form" id="auth-form">
          <h2>${signup ? "Start your Fitday" : "Welcome back"}</h2>
          <p class="auth-subtitle">${signup ? "A fresh start is one small step away." : "Your next good day starts right here."}</p>
          <div id="auth-error" class="auth-error" role="alert"></div>
          ${signup ? '<div class="field"><label for="auth-name">Your name</label><input id="auth-name" name="name" autocomplete="name" placeholder="How should we call you?" maxlength="80" required /></div>' : ""}
          <div class="field"><label for="auth-email">Email address</label><input id="auth-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" maxlength="254" required /></div>
          <div class="field"><label for="auth-password">Password</label><input id="auth-password" name="password" type="password" autocomplete="${signup ? "new-password" : "current-password"}" placeholder="${signup ? "At least 8 characters" : "Enter your password"}" minlength="8" maxlength="256" required /></div>
          <button class="primary-button" type="submit">${signup ? "Create your account" : "Sign in to Fitday"}</button>
          <p class="auth-switch">${signup ? "Already have an account?" : "New to Fitday?"} <button type="button" class="text-button" data-auth-toggle>${signup ? "Sign in" : "Create an account"}</button></p>
        </form>
      </section>
    </div>`;
  app.querySelector("[data-auth-toggle]").addEventListener("click", () => showAuth(signup ? "login" : "signup"));
  app.querySelector("#auth-form").addEventListener("submit", handleAuthSubmit);
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  const error = form.querySelector("#auth-error");
  submit.disabled = true;
  submit.textContent = "One moment…";
  error.classList.remove("visible");
  const values = Object.fromEntries(new FormData(form));
  try {
    const data = await api(state.authMode === "signup" ? "/api/register" : "/api/login", {
      method: "POST",
      body: JSON.stringify(values),
    });
    state.user = data.user;
    if (!data.user.heightCm || !data.user.weightKg) showOnboarding();
    else await loadApp();
  } catch (err) {
    error.textContent = err.message;
    error.classList.add("visible");
    submit.disabled = false;
    submit.textContent = state.authMode === "signup" ? "Create your account" : "Sign in to Fitday";
  }
}

function showOnboarding() {
  const user = state.user;
  app.innerHTML = `
    <div class="auth-layout">
      <section class="auth-story">
        ${logo()}
        <div class="story-copy">
          <p class="eyebrow">Let's make it yours</p>
          <h1>A plan that<br><span>starts with you.</span></h1>
          <p>Tell us a little about yourself. You can always update your details later.</p>
          <div class="story-note"><span class="note-dot"></span> Your information stays yours.</div>
        </div>
      </section>
      <section class="auth-panel">
        <form class="auth-form" id="onboarding-form">
          <div class="onboard-steps"><span class="active"></span><span class="active"></span><span></span></div>
          <h2>Make it personal</h2>
          <p class="auth-subtitle">A starting point, not a finish line. Your BMI is just one part of your health story.</p>
          <div id="auth-error" class="auth-error" role="alert"></div>
          <div class="field"><label for="profile-height">Height (cm)</label><input id="profile-height" name="heightCm" type="number" min="100" max="250" step="0.1" placeholder="e.g. 170" value="${escapeHtml(user.heightCm ?? "")}" required /></div>
          <div class="field"><label for="profile-weight">Weight (kg)</label><input id="profile-weight" name="weightKg" type="number" min="25" max="350" step="0.1" placeholder="e.g. 68" value="${escapeHtml(user.weightKg ?? "")}" required /></div>
          <div class="field"><label for="profile-goal">What would you like to focus on?</label><select id="profile-goal" name="goal" required><option value="">Choose a goal</option>${goals.map((goal) => `<option>${goal}</option>`).join("")}</select></div>
          <button class="primary-button" type="submit">Build my dashboard</button>
        </form>
      </section>
    </div>`;
  app.querySelector("#onboarding-form").addEventListener("submit", handleOnboardingSubmit);
}

async function handleOnboardingSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const error = form.querySelector("#auth-error");
  button.disabled = true;
  button.textContent = "Setting things up…";
  error.classList.remove("visible");
  try {
    const values = Object.fromEntries(new FormData(form));
    const data = await api("/api/profile", { method: "PUT", body: JSON.stringify(values) });
    state.user = data.user;
    await loadApp();
  } catch (err) {
    error.textContent = err.message;
    error.classList.add("visible");
    button.disabled = false;
    button.textContent = "Build my dashboard";
  }
}

async function loadApp() {
  const [workouts, bmi] = await Promise.all([api("/api/workouts"), api("/api/bmi")]);
  state.workouts = workouts.workouts;
  state.bmiRecords = bmi.records;
  renderShell();
}

function navigateToPage(page) {
  if (page === state.page) return;
  if (page !== "dashboard") stopStepTracking("Location tracking paused when you left the dashboard.");
  state.pageHistory.push(state.page);
  state.page = page;
  renderShell();
}

function goBack() {
  const previousPage = state.pageHistory.pop();
  if (!previousPage) return;
  state.page = previousPage;
  renderShell();
}

function navButton(page, label) {
  return `<button type="button" class="nav-link${state.page === page ? " active" : ""}" data-page="${page}"><span class="nav-icon">${icons[page]}</span>${label}</button>`;
}

function renderShell() {
  const name = escapeHtml(state.user.name);
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        ${logo()}
        <p class="nav-label">Workspace</p>
        <nav class="nav-list" aria-label="Main navigation">
          ${navButton("dashboard", "Overview")}
          ${navButton("workouts", "My workouts")}
          ${navButton("bmi", "BMI tracker")}
        </nav>
        <div class="sidebar-bottom">
          <div class="sidebar-tip"><span class="tip-spark">✳</span><strong>Keep showing up</strong><p>Consistency isn't about being perfect. It's about coming back.</p></div>
          <div class="user-chip"><span class="avatar">${escapeHtml(initials(name))}</span><div class="user-meta"><strong>${name}</strong><span>${escapeHtml(state.user.email)}</span></div><button type="button" class="icon-button" data-logout aria-label="Sign out" title="Sign out">${icons.logout}</button></div>
        </div>
      </aside>
      <section class="main-content">
        <header class="topbar">
          <div class="topbar-left">
            <button type="button" class="back-button" data-back ${state.pageHistory.length === 0 ? "disabled" : ""} aria-label="Go back to the previous page">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/><path d="M9 12h12"/></svg>
              <span>Back</span>
            </button>
            <div class="breadcrumb"><strong>Workspace</strong> &nbsp;/&nbsp; ${state.page === "dashboard" ? "Overview" : state.page === "bmi" ? "BMI tracker" : "My workouts"}</div>
            <div class="mobile-brand">${logo()}</div>
          </div>
          <div class="topbar-right"><span class="date-label">${dateLabel()}</span><span class="avatar">${escapeHtml(initials(name))}</span></div>
        </header>
        <div id="page-content"></div>
      </section>
      <nav class="mobile-nav" aria-label="Main navigation">
        ${navButton("dashboard", "Overview")}
        ${navButton("workouts", "Workouts")}
        ${navButton("bmi", "BMI")}
      </nav>
    </div>`;
  app.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => navigateToPage(button.dataset.page)));
  app.querySelector("[data-back]").addEventListener("click", goBack);
  app.querySelector("[data-logout]").addEventListener("click", handleLogout);
  if (state.page === "bmi") renderBmi();
  else if (state.page === "workouts") renderWorkouts();
  else renderDashboard();
}

function thisWeekWorkouts() {
  const now = new Date();
  const day = (now.getDay() + 6) % 7;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(now.getDate() - day);
  return state.workouts.filter((workout) => new Date(workout.completedAt) >= start);
}

function weeklyChart(workouts) {
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const amounts = Array(7).fill(0);
  workouts.forEach((workout) => {
    const date = new Date(workout.completedAt);
    const index = Math.floor((date - monday) / 86_400_000);
    if (index >= 0 && index < 7) amounts[index] += Number(workout.duration);
  });
  const max = Math.max(60, ...amounts);
  const points = amounts.map((value, index) => {
    const x = 25 + index * 64;
    const y = 163 - (value / max) * 125;
    return [x, y];
  });
  const path = points.map(([x, y], index) => `${index ? "L" : "M"} ${x} ${y}`).join(" ");
  const area = `${path} L ${points[points.length - 1][0]} 174 L ${points[0][0]} 174 Z`;
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return `<svg viewBox="0 0 430 195" role="img" aria-label="Workout minutes this week">
    <defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#90b995" stop-opacity=".28"/><stop offset="100%" stop-color="#90b995" stop-opacity="0"/></linearGradient></defs>
    <line class="chart-grid" x1="16" y1="38" x2="420" y2="38"/><line class="chart-grid" x1="16" y1="92" x2="420" y2="92"/><line class="chart-grid" x1="16" y1="164" x2="420" y2="164"/>
    ${workouts.length ? `<path class="chart-area" d="${area}"/><path class="chart-line" d="${path}"/>${points.map(([x, y]) => `<circle class="chart-dot" cx="${x}" cy="${y}" r="3.5"/>`).join("")}` : ""}
    ${labels.map((label, index) => `<text class="chart-label" x="${25 + index * 64}" y="190" text-anchor="middle">${label}</text>`).join("")}
  </svg>`;
}

function workoutIcon(type) {
  return icons[String(type || "").toLowerCase()] || icons.other;
}

function workoutDate(dateString) {
  const date = new Date(dateString);
  if (date.toDateString() === new Date().toDateString()) return "Today";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function workoutRow(workout, deletable = false) {
  return `<div class="workout-row">
    <span class="workout-symbol">${workoutIcon(workout.type)}</span>
    <div class="workout-details"><strong>${escapeHtml(workout.type)} session</strong><span>${workoutDate(workout.completedAt)} · ${workout.duration} min${workout.notes ? ` · ${escapeHtml(workout.notes)}` : ""}</span></div>
    <span class="workout-calories">${workout.calories} kcal</span>
    ${deletable ? `<button type="button" class="icon-button workout-delete" data-delete-workout="${workout.id}" aria-label="Delete workout">×</button>` : ""}
  </div>`;
}

function renderDashboard() {
  const week = thisWeekWorkouts();
  const minutes = week.reduce((total, workout) => total + Number(workout.duration), 0);
  const calories = week.reduce((total, workout) => total + Number(workout.calories), 0);
  const bmi = state.bmiRecords[0]?.bmi ?? (state.user.heightCm && state.user.weightKg ? Number((state.user.weightKg / (state.user.heightCm / 100) ** 2).toFixed(1)) : null);
  const progress = Math.min(week.length / 3, 1);
  const steps = getTodaySteps();
  const stepProgress = Math.min(steps / dailyStepGoal, 1);
  document.querySelector(".breadcrumb").innerHTML = "<strong>Workspace</strong> &nbsp;/&nbsp; Overview";
  document.querySelector(".date-label").textContent = dateLabel();
  document.querySelector("#page-content").innerHTML = `
    <div class="page-heading"><div><h1>Good ${greeting()}, ${escapeHtml(state.user.name.split(" ")[0])} <span aria-hidden="true">✳</span></h1><p>A fresh day is a fresh chance to feel good.</p></div><button class="outline-button" type="button" data-log-workout>＋ &nbsp;Log a workout</button></div>
    <section class="activity-feature-grid" aria-label="Workout inspiration">
      <article class="activity-feature">
        <img src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=85" alt="Strength training equipment in a gym" />
        <div class="activity-feature-copy"><span>MAKE TIME FOR YOU</span><h2>Find your strength</h2><button type="button" data-workout-type="Strength">Log a gym session <span aria-hidden="true">→</span></button></div>
      </article>
      <article class="activity-feature">
        <img src="https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=1200&q=85" alt="Runner enjoying an outdoor run" />
        <div class="activity-feature-copy"><span>ONE STEP AT A TIME</span><h2>Take it outside</h2><button type="button" data-workout-type="Cardio">Log a run <span aria-hidden="true">→</span></button></div>
      </article>
    </section>
    <section class="overview-grid" aria-label="This week's activity">
      ${statCard("Workouts this week", week.length, "sessions", "dashboard")}
      ${statCard("Active minutes", minutes, "min", "workouts")}
      ${statCard("Calories burned", calories.toLocaleString(), "kcal", "cardio")}
      ${statCard("Latest BMI", bmi ?? "—", bmi ? "latest reading" : "add your first reading", "bmi")}
    </section>
    <section class="steps-panel" aria-labelledby="steps-title">
      <div class="steps-copy"><span class="steps-icon">${icons.walk}</span><div><h2 id="steps-title">Today's steps</h2><p>Your daily movement, one step at a time</p></div></div>
      <div class="steps-detail">
        <div class="steps-progress" id="steps-progress" role="progressbar" aria-label="Daily step goal progress" aria-valuemin="0" aria-valuemax="${dailyStepGoal}" aria-valuenow="${Math.min(steps, dailyStepGoal)}"><div style="width:${Math.round(stepProgress * 100)}%"></div></div>
        <div class="steps-summary"><strong id="steps-count">${steps.toLocaleString()} <span>/ ${dailyStepGoal.toLocaleString()} steps</span></strong><span id="steps-goal-status">${steps >= dailyStepGoal ? "Daily goal reached — great work!" : `${(dailyStepGoal - steps).toLocaleString()} steps to your goal`}</span></div>
      </div>
      <div class="steps-actions">
        <p class="gps-status" id="gps-status" role="status">${escapeHtml(state.gpsStatus)}</p>
        <div class="gps-controls"><button class="primary-button gps-start" id="gps-start" type="button" ${state.stepWatchId !== null ? "disabled" : ""}>Start GPS tracking</button><button class="outline-button gps-stop" id="gps-stop" type="button" ${state.stepWatchId === null ? "disabled" : ""}>Stop</button></div>
        <p class="gps-distance" id="gps-distance">GPS estimate: ${getTodayGpsSteps().toLocaleString()} steps · ${formatDistance(getTodayGpsDistance())} today</p>
        <form class="steps-form" id="steps-form">
          <label class="sr-only" for="steps-amount">Manual steps to add</label>
          <input id="steps-amount" name="steps" type="number" min="1" max="100000" step="1" placeholder="Add steps" required />
          <button class="primary-button" type="submit">Add manually</button>
        </form>
      </div>
      <p class="steps-note">GPS estimates steps from distance and your profile height. Location is processed on this device and isn’t saved or sent. Requires location permission and a secure connection (HTTPS or localhost).</p>
    </section>
    <div class="dashboard-grid">
      <section class="panel"><div class="panel-header"><div><h2>Your movement</h2><p>Active minutes · this week</p></div><span class="select-small">This week</span></div><div class="chart-wrap">${weeklyChart(week)}</div></section>
      <section class="panel goal-panel"><div class="panel-header"><div><h2>Weekly rhythm</h2><p>A gentle goal to keep you moving</p></div></div>
        <div class="goal-content"><div class="goal-ring" style="--progress:${Math.round(progress * 360)}deg"><div class="goal-ring-inner"><strong>${week.length}<small style="font:500 11px Manrope">/3</small></strong><span>workouts</span></div></div><div class="goal-copy"><strong>${week.length >= 3 ? "You're on a roll!" : "You're building momentum"}</strong><p>${week.length >= 3 ? "You reached your weekly movement goal. Take a moment to celebrate." : `${3 - week.length} more ${3 - week.length === 1 ? "session" : "sessions"} to reach your weekly goal.`}</p></div></div>
        <div class="goal-metric"><span>Your focus</span><strong>${escapeHtml(state.user.goal || "Feel healthier")}</strong></div>
      </section>
    </div>
    <div class="section-row"><h2>Recent workouts</h2><button type="button" data-view-workouts>View all &nbsp;→</button></div>
    <section class="recent-list">${state.workouts.length ? state.workouts.slice(0, 4).map((workout) => workoutRow(workout)).join("") : '<div class="empty-state"><strong>Your first workout starts here</strong>Log a session to see your progress take shape.</div>'}</section>`;
  document.querySelector("[data-log-workout]").addEventListener("click", () => {
    navigateToPage("workouts");
    document.querySelector("#workout-type")?.focus();
  });
  document.querySelector("[data-view-workouts]").addEventListener("click", () => {
    navigateToPage("workouts");
  });
  document.querySelectorAll("[data-workout-type]").forEach((button) => button.addEventListener("click", () => {
    navigateToPage("workouts");
    const typeSelect = document.querySelector("#workout-type");
    typeSelect.value = button.dataset.workoutType;
    typeSelect.focus();
  }));
  document.querySelector("#steps-form").addEventListener("submit", handleStepsSubmit);
  document.querySelector("#gps-start").addEventListener("click", startStepTracking);
  document.querySelector("#gps-stop").addEventListener("click", () => stopStepTracking("Location tracking stopped."));
  updateStepTrackerView();
}

function todayStepsStorageKey() {
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return `fitday:steps:${encodeURIComponent(String(state.user.email).toLowerCase())}:${date}`;
}

function todayGpsDistanceStorageKey() {
  return `${todayStepsStorageKey()}:gps-distance`;
}

function getStoredLocalNumber(key) {
  try {
    const savedValue = window.localStorage.getItem(key);
    if (savedValue === null) return 0;
    const value = Number(savedValue);
    if (!Number.isFinite(value) || value < 0) throw new Error("Saved activity data is invalid.");
    return value;
  } catch (error) {
    notify(error.message || "Saved activity data couldn't be read.", "error");
    return 0;
  }
}

function getTodayManualSteps() {
  const steps = getStoredLocalNumber(todayStepsStorageKey());
  if (!Number.isSafeInteger(steps)) {
    notify("Your saved manual step count is invalid.", "error");
    return 0;
  }
  return steps;
}

function getTodayGpsDistance() {
  return getStoredLocalNumber(todayGpsDistanceStorageKey());
}

function estimatedStrideMeters() {
  return Number(state.user.heightCm) * 0.415 / 100;
}

function getTodayGpsSteps() {
  return Math.floor(getTodayGpsDistance() / estimatedStrideMeters());
}

function getTodaySteps() {
  return getTodayManualSteps() + getTodayGpsSteps();
}

function formatDistance(meters) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`;
}

function updateStepTrackerView() {
  const count = document.querySelector("#steps-count");
  if (!count) return;
  const steps = getTodaySteps();
  const progress = Math.min(steps / dailyStepGoal, 1);
  const progressBar = document.querySelector("#steps-progress");
  progressBar.setAttribute("aria-valuenow", String(Math.min(steps, dailyStepGoal)));
  progressBar.firstElementChild.style.width = `${Math.round(progress * 100)}%`;
  count.innerHTML = `${steps.toLocaleString()} <span>/ ${dailyStepGoal.toLocaleString()} steps</span>`;
  document.querySelector("#steps-goal-status").textContent = steps >= dailyStepGoal
    ? "Daily goal reached — great work!"
    : `${(dailyStepGoal - steps).toLocaleString()} steps to your goal`;
  document.querySelector("#gps-status").textContent = state.gpsStatus;
  document.querySelector("#gps-distance").textContent = `GPS estimate: ${getTodayGpsSteps().toLocaleString()} steps · ${formatDistance(getTodayGpsDistance())} today`;
  document.querySelector("#gps-start").disabled = state.stepWatchId !== null;
  document.querySelector("#gps-stop").disabled = state.stepWatchId === null;
}

function saveTodaySteps(steps) {
  try {
    window.localStorage.setItem(todayStepsStorageKey(), String(steps));
    return true;
  } catch (error) {
    notify(error.message || "Your step count couldn't be saved in this browser.", "error");
    return false;
  }
}

function saveTodayGpsDistance(distance) {
  try {
    window.localStorage.setItem(todayGpsDistanceStorageKey(), String(distance));
    return true;
  } catch (error) {
    notify(error.message || "GPS activity couldn't be saved in this browser.", "error");
    return false;
  }
}

function addSteps(amount) {
  if (!Number.isSafeInteger(amount) || amount < 1) {
    notify("Enter a whole number of steps greater than zero.", "error");
    return;
  }
  const manualSteps = getTodayManualSteps();
  if (!Number.isSafeInteger(manualSteps + amount)) {
    notify("That step count is too large to save.", "error");
    return;
  }
  if (!saveTodaySteps(manualSteps + amount)) return;
  updateStepTrackerView();
  notify(`${amount.toLocaleString()} steps added.`);
}

function handleStepsSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const amount = Number(new FormData(form).get("steps"));
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100000) {
    notify("Enter a whole number from 1 to 100,000.", "error");
    return;
  }
  addSteps(amount);
}

function distanceBetween(first, second) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const firstLatitude = radians(first.latitude);
  const secondLatitude = radians(second.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  const boundedHaversine = Math.min(1, Math.max(0, haversine));
  return 6371000 * 2 * Math.atan2(Math.sqrt(boundedHaversine), Math.sqrt(1 - boundedHaversine));
}

function startStepTracking() {
  if (!navigator.geolocation) {
    state.gpsStatus = "This browser does not support location tracking.";
    updateStepTrackerView();
    notify(state.gpsStatus, "error");
    return;
  }
  if (!window.isSecureContext) {
    state.gpsStatus = "GPS tracking requires HTTPS or localhost.";
    updateStepTrackerView();
    notify(state.gpsStatus, "error");
    return;
  }
  if (state.stepWatchId !== null) return;
  state.gpsStatus = "Waiting for a GPS location fix…";
  updateStepTrackerView();
  try {
    state.stepWatchId = navigator.geolocation.watchPosition(handleGpsPosition, handleGpsError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 20000,
    });
  } catch (error) {
    state.gpsStatus = `GPS couldn't start: ${error.message}`;
    notify(state.gpsStatus, "error");
  }
  updateStepTrackerView();
}

function handleGpsPosition(position) {
  const { latitude, longitude, accuracy } = position.coords;
  const current = { latitude, longitude, accuracy, timestamp: position.timestamp };
  if (accuracy > 35) {
    state.gpsStatus = "GPS accuracy is low; waiting for a clearer location.";
    updateStepTrackerView();
    return;
  }
  if (!state.lastGpsPosition) {
    state.lastGpsPosition = current;
    state.gpsStatus = "GPS connected. Move outdoors for a better distance estimate.";
    updateStepTrackerView();
    return;
  }

  const distance = distanceBetween(state.lastGpsPosition, current);
  const elapsedSeconds = (current.timestamp - state.lastGpsPosition.timestamp) / 1000;
  const accuracyThreshold = Math.min(8, Math.max(2, (accuracy + state.lastGpsPosition.accuracy) * 0.25));
  if (distance < accuracyThreshold) {
    state.gpsStatus = "GPS connected. Tracking movement…";
    updateStepTrackerView();
    return;
  }
  if (elapsedSeconds <= 0 || distance > 100 || distance / elapsedSeconds > 12) {
    state.lastGpsPosition = current;
    state.gpsStatus = "GPS jump ignored; recalibrating location…";
    updateStepTrackerView();
    return;
  }

  const updatedDistance = getTodayGpsDistance() + distance;
  if (!saveTodayGpsDistance(updatedDistance)) {
    stopStepTracking("Tracking stopped because activity data could not be saved.");
    return;
  }
  state.lastGpsPosition = current;
  state.gpsStatus = "GPS connected. Tracking movement…";
  updateStepTrackerView();
}

function handleGpsError(error) {
  const messages = {
    1: "Location permission was denied. Allow location access to track steps.",
    2: "Your location is unavailable. Try again outdoors.",
    3: "GPS timed out. Try again where you have a clearer signal.",
  };
  stopStepTracking(messages[error.code] || "GPS tracking stopped because of a location error.");
  notify(state.gpsStatus, "error");
}

function stopStepTracking(message = "Location tracking stopped.") {
  if (state.stepWatchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(state.stepWatchId);
  }
  state.stepWatchId = null;
  state.lastGpsPosition = null;
  state.gpsStatus = message;
  updateStepTrackerView();
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function statCard(label, value, unit, icon) {
  return `<article class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon">${icons[icon]}</span></div><div class="stat-number">${value}<small>${unit}</small></div><div class="stat-foot">This week, at your pace</div></article>`;
}

function currentWeightKg() {
  return Number(state.bmiRecords[0]?.weightKg || state.user.weightKg || 0);
}

function estimateWorkoutCalories(type, duration) {
  const weightKg = currentWeightKg();
  if (!weightKg || !duration) return 0;
  return Math.min(10000, Math.round((workoutMetValues[type] || workoutMetValues.Other) * weightKg * duration / 60));
}

function updateWorkoutCaloriesEstimate() {
  const form = document.querySelector("#workout-form");
  if (!form) return;
  const type = form.elements.type.value;
  const duration = Number(form.elements.duration.value);
  const weightKg = currentWeightKg();
  form.elements.calories.value = String(estimateWorkoutCalories(type, duration));
  form.querySelector("#calorie-estimate-note").textContent = weightKg
    ? `Estimated for ${weightKg} kg and ${type.toLowerCase()} activity. Actual calories vary.`
    : "Add your weight in the BMI tracker to personalize this estimate.";
}

function renderWorkouts() {
  const content = document.querySelector("#page-content");
  content.innerHTML = `
    <div class="page-heading"><div><h1>My workouts</h1><p>Every session counts. Keep your own kind of rhythm.</p></div></div>
    <section class="panel" style="padding-bottom:20px">
      <div class="panel-header"><div><h2>Log a workout</h2><p>Record a little movement from your day</p></div></div>
      <form id="workout-form" class="bmi-form-fields" style="grid-template-columns:repeat(2,minmax(0,1fr))">
        <div class="field"><label for="workout-type">Workout type</label><select id="workout-type" name="type" required>${workoutTypes.map((type) => `<option>${type}</option>`).join("")}</select></div>
        <div class="field"><label for="workout-duration">Duration (minutes)</label><input id="workout-duration" name="duration" type="number" min="1" max="600" placeholder="30" required /></div>
        <div class="field calorie-field"><label for="workout-calories">Estimated calories burned</label><input id="workout-calories" name="calories" type="number" min="0" max="10000" value="0" readonly aria-describedby="calorie-estimate-note" /><span class="calorie-estimate-note" id="calorie-estimate-note"></span></div>
        <div class="field"><label for="workout-notes">A note to yourself (optional)</label><input id="workout-notes" name="notes" maxlength="300" placeholder="How did it feel?" /></div>
        <button class="primary-button" type="submit" style="grid-column:1/-1">Save workout</button>
      </form>
    </section>
    <div class="section-row"><h2>All sessions <span style="color:#9aa49c;font:500 11px 'DM Sans',sans-serif">(${state.workouts.length})</span></h2></div>
    <section class="recent-list">${state.workouts.length ? state.workouts.map((workout) => workoutRow(workout, true)).join("") : '<div class="empty-state"><strong>No workouts logged yet</strong>Your sessions will show up here when you log your first one.</div>'}</section>`;
  content.querySelector("#workout-type").addEventListener("change", updateWorkoutCaloriesEstimate);
  content.querySelector("#workout-duration").addEventListener("input", updateWorkoutCaloriesEstimate);
  updateWorkoutCaloriesEstimate();
  content.querySelector("#workout-form").addEventListener("submit", handleWorkoutSubmit);
  content.querySelectorAll("[data-delete-workout]").forEach((button) => button.addEventListener("click", () => handleDeleteWorkout(button.dataset.deleteWorkout)));
}

async function handleWorkoutSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = "Saving…";
  try {
    const values = Object.fromEntries(new FormData(form));
    values.duration = Number(values.duration);
    values.calories = Number(values.calories || 0);
    await api("/api/workouts", { method: "POST", body: JSON.stringify(values) });
    await loadApp();
    notify("Workout saved. Nice work showing up!");
  } catch (error) {
    button.disabled = false;
    button.textContent = "Save workout";
    notify(error.message, "error");
  }
}

async function handleDeleteWorkout(id) {
  try {
    await api(`/api/workouts/${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadApp();
    notify("Workout removed.");
  } catch (error) {
    notify(error.message, "error");
  }
}

function bmiCategory(value) {
  if (value < 18.5) return "Below healthy range";
  if (value < 25) return "Healthy range";
  if (value < 30) return "Above healthy range";
  return "High range";
}

function renderBmi() {
  const content = document.querySelector("#page-content");
  const latest = state.bmiRecords[0];
  const height = state.user.heightCm || latest?.heightCm || "";
  const weight = state.user.weightKg || latest?.weightKg || "";
  const result = latest?.bmi;
  content.innerHTML = `
    <div class="page-heading"><div><h1>BMI tracker</h1><p>A simple snapshot of your measurements over time.</p></div></div>
    <div class="bmi-layout">
      <section class="panel bmi-form-panel">
        <div class="panel-header"><div><h2>Record your measurements</h2><p>Use your current height and weight</p></div></div>
        <form id="bmi-form">
          <div class="bmi-form-fields">
            <div class="field"><label for="bmi-height">Height (cm)</label><input id="bmi-height" name="heightCm" type="number" min="100" max="250" step="0.1" placeholder="170" value="${escapeHtml(height)}" required /></div>
            <div class="field"><label for="bmi-weight">Weight (kg)</label><input id="bmi-weight" name="weightKg" type="number" min="25" max="350" step="0.1" placeholder="68" value="${escapeHtml(weight)}" required /></div>
          </div>
          <button class="primary-button" type="submit">Save BMI reading</button>
        </form>
      </section>
      <section class="panel bmi-result">
        <span class="bmi-result-label">${result ? "Your latest BMI" : "Your BMI will appear here"}</span>
        <strong>${result ?? "—"}</strong>
        <span class="bmi-category">${result ? bmiCategory(result) : "Add a reading to get started"}</span>
        <div class="bmi-scale" aria-label="BMI categories"><span></span><span></span><span></span><span></span></div>
        <p>BMI is a general screening measure, not a diagnosis. It doesn't account for muscle mass or tell the whole story of your health.</p>
      </section>
    </div>
    <div class="section-row bmi-history"><h2>Measurement history</h2></div>
    <section class="recent-list">${state.bmiRecords.length ? state.bmiRecords.map((record) => `<div class="history-row"><span>${new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(record.recordedAt))} · ${record.heightCm} cm · ${record.weightKg} kg</span><strong>${record.bmi} BMI</strong></div>`).join("") : '<div class="empty-state"><strong>No readings yet</strong>Your BMI entries will be saved here over time.</div>'}</section>`;
  content.querySelector("#bmi-form").addEventListener("submit", handleBmiSubmit);
}

async function handleBmiSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = "Saving…";
  try {
    const values = Object.fromEntries(new FormData(form));
    values.heightCm = Number(values.heightCm);
    values.weightKg = Number(values.weightKg);
    await api("/api/bmi", { method: "POST", body: JSON.stringify(values) });
    await loadApp();
    notify("BMI reading saved.");
  } catch (error) {
    button.disabled = false;
    button.textContent = "Save BMI reading";
    notify(error.message, "error");
  }
}

async function handleLogout() {
  stopStepTracking("Location tracking stopped.");
  try {
    await api("/api/logout", { method: "POST", body: "{}" });
    state.user = null;
    state.workouts = [];
    state.bmiRecords = [];
    state.page = "dashboard";
    state.pageHistory = [];
    showAuth("login");
  } catch (error) {
    notify(error.message, "error");
  }
}

async function start() {
  try {
    const data = await api("/api/me");
    state.user = data.user;
    if (!data.user.heightCm || !data.user.weightKg || !data.user.goal) showOnboarding();
    else await loadApp();
  } catch (error) {
    if (error.message !== "Please sign in to continue.") notify(error.message, "error");
    showAuth("login");
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.stepWatchId !== null) {
    stopStepTracking("GPS tracking paused while Fitday is in the background.");
  }
});

start();
