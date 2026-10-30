# Fitday

Fitday is a small, full-stack workout and wellness tracker. It uses a responsive browser UI and a Python standard-library backend with SQLite persistence; no third-party packages are required.

## Run locally

1. Install Python 3.10 or later.
2. From this folder, run `python server.py`.
3. Open [http://127.0.0.1:8000](http://127.0.0.1:8000).
4. Create an account and complete the short profile setup.

The SQLite database is created as `fitday.db` on first launch. Set the `PORT` environment variable to use a different local port.

## Features

- Account registration, sign-in, and sign-out with password hashing and server-managed sessions.
- A personalized dashboard with weekly workout minutes, active sessions, calories, and a weekly goal.
- A daily step counter with manual entry and opt-in GPS distance-based step estimates saved locally in the browser; it requires location permission and HTTPS or localhost.
- Workout calorie estimates based on workout type, duration, and the user's latest recorded weight. Estimates are approximate, not measured.
- Gym and running photos on the dashboard with shortcuts to log a strength or cardio session.
- In-app Back button that returns to the previous Fitday section you visited.
- Workout logging and deletion, with activity history saved per account.
- BMI calculation and measurement history. BMI is shown as a general screening measure, not a diagnosis.
- Responsive layouts for desktop and mobile.
