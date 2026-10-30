import hashlib
import json
import math
import os
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
DATABASE = ROOT / "fitday.db"
SESSION_DAYS = 30
MAX_BODY_SIZE = 1_000_000


@contextmanager
def connect_db():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        with connection:
            yield connection
    finally:
        connection.close()


def initialize_db():
    with connect_db() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                display_name TEXT NOT NULL,
                height_cm REAL,
                weight_kg REAL,
                goal TEXT,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS workouts (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                workout_type TEXT NOT NULL,
                duration_minutes INTEGER NOT NULL,
                calories INTEGER NOT NULL,
                notes TEXT NOT NULL DEFAULT '',
                completed_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS bmi_records (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                height_cm REAL NOT NULL,
                weight_kg REAL NOT NULL,
                bmi REAL NOT NULL,
                recorded_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS workouts_user_date
                ON workouts(user_id, completed_at);
            CREATE INDEX IF NOT EXISTS bmi_user_date
                ON bmi_records(user_id, recorded_at);
            """
        )


def now_utc():
    return datetime.now(timezone.utc).isoformat()


def hash_password(password, salt=None):
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 310_000)
    return f"{salt.hex()}:{digest.hex()}"


def verify_password(password, stored):
    try:
        salt_hex, digest_hex = stored.split(":", 1)
        candidate = hash_password(password, bytes.fromhex(salt_hex)).split(":", 1)[1]
        return secrets.compare_digest(candidate, digest_hex)
    except (ValueError, TypeError):
        return False


def bmi_category(bmi):
    if bmi < 18.5:
        return "Below healthy range"
    if bmi < 25:
        return "Healthy range"
    if bmi < 30:
        return "Above healthy range"
    return "High range"


class FitdayHandler(BaseHTTPRequestHandler):
    server_version = "Fitday/1.0"

    def log_message(self, fmt, *args):
        print(f"{self.log_date_time_string()} {fmt % args}")

    def send_json(self, status, payload, headers=None):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if headers:
            for name, value in headers.items():
                self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            raise ValueError("Invalid request size.")
        if length <= 0 or length > MAX_BODY_SIZE:
            raise ValueError("Request body is missing or too large.")
        try:
            result = json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            raise ValueError("Please send valid JSON.")
        if not isinstance(result, dict):
            raise ValueError("Please send a JSON object.")
        return result

    def current_user(self):
        cookie = SimpleCookie()
        cookie.load(self.headers.get("Cookie", ""))
        session = cookie.get("fitday_session")
        if session is None:
            return None
        token_hash = hashlib.sha256(session.value.encode("utf-8")).hexdigest()
        with connect_db() as db:
            row = db.execute(
                """
                SELECT users.* FROM sessions
                JOIN users ON users.id = sessions.user_id
                WHERE sessions.token_hash = ? AND sessions.expires_at > ?
                """,
                (token_hash, now_utc()),
            ).fetchone()
        return row

    def require_user(self):
        user = self.current_user()
        if user is None:
            self.send_json(401, {"error": "Please sign in to continue."})
        return user

    def do_GET(self):
        path = urlparse(self.path).path
        if path.startswith("/api/"):
            self.handle_api("GET", path)
        else:
            self.serve_static(path)

    def do_POST(self):
        self.handle_api("POST", urlparse(self.path).path)

    def do_PUT(self):
        self.handle_api("PUT", urlparse(self.path).path)

    def do_DELETE(self):
        self.handle_api("DELETE", urlparse(self.path).path)

    def handle_api(self, method, path):
        try:
            if method == "POST" and path in ("/api/register", "/api/login"):
                self.handle_auth(path)
                return
            if method == "POST" and path == "/api/logout":
                self.handle_logout()
                return
            if path == "/api/me" and method == "GET":
                user = self.require_user()
                if user is None:
                    return
                self.send_json(200, {"user": self.public_user(user)})
                return

            user = self.require_user()
            if user is None:
                return
            if path == "/api/profile" and method == "PUT":
                self.handle_profile(user)
            elif path == "/api/workouts" and method == "GET":
                self.handle_get_workouts(user)
            elif path == "/api/workouts" and method == "POST":
                self.handle_add_workout(user)
            elif path.startswith("/api/workouts/") and method == "DELETE":
                self.handle_delete_workout(user, path)
            elif path == "/api/bmi" and method == "GET":
                self.handle_get_bmi(user)
            elif path == "/api/bmi" and method == "POST":
                self.handle_add_bmi(user)
            else:
                self.send_json(404, {"error": "That endpoint was not found."})
        except ValueError as error:
            self.send_json(400, {"error": str(error)})
        except sqlite3.IntegrityError:
            self.send_json(409, {"error": "That email address is already registered."})
        except Exception:
            self.log_error("Unexpected API error")
            self.send_json(500, {"error": "Something went wrong. Please try again."})

    def handle_auth(self, path):
        data = self.read_json()
        email = str(data.get("email", "")).strip().lower()
        password = data.get("password", "")
        if not isinstance(password, str) or len(password) < 8 or len(password) > 256:
            raise ValueError("Password must be between 8 and 256 characters.")
        if len(email) > 254 or "@" not in email or "." not in email.rsplit("@", 1)[-1]:
            raise ValueError("Enter a valid email address.")
        with connect_db() as db:
            if path == "/api/register":
                name = str(data.get("name", "")).strip()
                if not name or len(name) > 80:
                    raise ValueError("Enter a name between 1 and 80 characters.")
                cursor = db.execute(
                    "INSERT INTO users (email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?)",
                    (email, hash_password(password), name, now_utc()),
                )
                user = db.execute("SELECT * FROM users WHERE id = ?", (cursor.lastrowid,)).fetchone()
            else:
                user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
                if user is None or not verify_password(password, user["password_hash"]):
                    self.send_json(401, {"error": "Email or password is incorrect."})
                    return
            token = secrets.token_urlsafe(32)
            token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
            expires = (datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)).isoformat()
            db.execute(
                "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
                (token_hash, user["id"], expires),
            )
        self.send_json(
            200,
            {"user": self.public_user(user)},
            {
                "Set-Cookie": (
                    f"fitday_session={token}; HttpOnly; SameSite=Lax; Path=/; "
                    f"Max-Age={SESSION_DAYS * 24 * 60 * 60}"
                )
            },
        )

    def handle_logout(self):
        cookie = SimpleCookie()
        cookie.load(self.headers.get("Cookie", ""))
        session = cookie.get("fitday_session")
        if session:
            token_hash = hashlib.sha256(session.value.encode("utf-8")).hexdigest()
            with connect_db() as db:
                db.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))
        self.send_json(
            200,
            {"ok": True},
            {"Set-Cookie": "fitday_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"},
        )

    def public_user(self, user):
        return {
            "id": user["id"],
            "email": user["email"],
            "name": user["display_name"],
            "heightCm": user["height_cm"],
            "weightKg": user["weight_kg"],
            "goal": user["goal"],
        }

    def handle_profile(self, user):
        data = self.read_json()
        height = self.positive_number(data.get("heightCm"), "Height", 100, 250)
        weight = self.positive_number(data.get("weightKg"), "Weight", 25, 350)
        goal = str(data.get("goal", "")).strip()
        if goal not in ("Build strength", "Get more active", "Improve endurance", "Feel healthier"):
            raise ValueError("Choose one of the available fitness goals.")
        with connect_db() as db:
            db.execute(
                "UPDATE users SET height_cm = ?, weight_kg = ?, goal = ? WHERE id = ?",
                (height, weight, goal, user["id"]),
            )
            updated = db.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
            self.save_bmi_record(db, user["id"], height, weight)
        self.send_json(200, {"user": self.public_user(updated)})

    def handle_get_workouts(self, user):
        with connect_db() as db:
            rows = db.execute(
                """
                SELECT id, workout_type AS type, duration_minutes AS duration,
                       calories, notes, completed_at AS completedAt
                FROM workouts WHERE user_id = ?
                ORDER BY completed_at DESC LIMIT 100
                """,
                (user["id"],),
            ).fetchall()
        self.send_json(200, {"workouts": [dict(row) for row in rows]})

    def handle_add_workout(self, user):
        data = self.read_json()
        workout_type = str(data.get("type", "")).strip()
        if workout_type not in ("Strength", "Cardio", "Yoga", "Walk", "Cycling", "Other"):
            raise ValueError("Choose a workout type from the list.")
        duration = self.whole_number(data.get("duration"), "Duration", 1, 600)
        calories = self.whole_number(data.get("calories"), "Calories", 0, 10000)
        notes = str(data.get("notes", "")).strip()
        if len(notes) > 300:
            raise ValueError("Notes must be 300 characters or fewer.")
        completed_at = now_utc()
        with connect_db() as db:
            cursor = db.execute(
                """
                INSERT INTO workouts (user_id, workout_type, duration_minutes, calories, notes, completed_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (user["id"], workout_type, duration, calories, notes, completed_at),
            )
        self.send_json(
            201,
            {
                "workout": {
                    "id": cursor.lastrowid,
                    "type": workout_type,
                    "duration": duration,
                    "calories": calories,
                    "notes": notes,
                    "completedAt": completed_at,
                }
            },
        )

    def handle_delete_workout(self, user, path):
        workout_id = path.rsplit("/", 1)[-1]
        if not workout_id.isdigit():
            self.send_json(404, {"error": "Workout not found."})
            return
        with connect_db() as db:
            cursor = db.execute(
                "DELETE FROM workouts WHERE id = ? AND user_id = ?",
                (int(workout_id), user["id"]),
            )
        if cursor.rowcount == 0:
            self.send_json(404, {"error": "Workout not found."})
            return
        self.send_json(200, {"ok": True})

    def handle_get_bmi(self, user):
        with connect_db() as db:
            rows = db.execute(
                """
                SELECT id, height_cm AS heightCm, weight_kg AS weightKg,
                       bmi, recorded_at AS recordedAt
                FROM bmi_records WHERE user_id = ?
                ORDER BY recorded_at DESC LIMIT 30
                """,
                (user["id"],),
            ).fetchall()
        self.send_json(200, {"records": [dict(row) for row in rows]})

    def handle_add_bmi(self, user):
        data = self.read_json()
        height = self.positive_number(data.get("heightCm"), "Height", 100, 250)
        weight = self.positive_number(data.get("weightKg"), "Weight", 25, 350)
        with connect_db() as db:
            record = self.save_bmi_record(db, user["id"], height, weight)
            db.execute(
                "UPDATE users SET height_cm = ?, weight_kg = ? WHERE id = ?",
                (height, weight, user["id"]),
            )
        self.send_json(201, {"record": record})

    def save_bmi_record(self, db, user_id, height, weight):
        bmi = round(weight / ((height / 100) ** 2), 1)
        recorded_at = now_utc()
        cursor = db.execute(
            """
            INSERT INTO bmi_records (user_id, height_cm, weight_kg, bmi, recorded_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (user_id, height, weight, bmi, recorded_at),
        )
        return {
            "id": cursor.lastrowid,
            "heightCm": height,
            "weightKg": weight,
            "bmi": bmi,
            "recordedAt": recorded_at,
        }

    def positive_number(self, value, label, minimum, maximum):
        try:
            number = float(value)
        except (TypeError, ValueError):
            raise ValueError(f"{label} must be a number.")
        if not math.isfinite(number) or not minimum <= number <= maximum:
            raise ValueError(f"{label} must be between {minimum} and {maximum}.")
        return number

    def whole_number(self, value, label, minimum, maximum):
        try:
            number = int(value)
        except (TypeError, ValueError):
            raise ValueError(f"{label} must be a whole number.")
        if isinstance(value, bool) or str(number) != str(value).strip() or not minimum <= number <= maximum:
            raise ValueError(f"{label} must be a whole number between {minimum} and {maximum}.")
        return number

    def serve_static(self, path):
        if path == "/":
            path = "/index.html"
        requested = (ROOT / path.lstrip("/")).resolve()
        if ROOT not in requested.parents and requested != ROOT:
            self.send_error(403)
            return
        if not requested.is_file():
            self.send_error(404)
            return
        content_types = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".svg": "image/svg+xml",
        }
        content = requested.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_types.get(requested.suffix, "application/octet-stream"))
        self.send_header("Content-Length", str(len(content)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(content)


if __name__ == "__main__":
    initialize_db()
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("0.0.0.0", port), FitdayHandler)
    print(f"Fitday is running at http://127.0.0.1:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nFitday server stopped.")
    finally:
        server.server_close()
