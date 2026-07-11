# 🏆 FIFA World Cup 2026™ — VIP RSVP System

**Hosted by Commercial Bank of Ethiopia (CBE) & Visa**

A full-stack VIP event registration and check-in system with QR code ticketing, email confirmation, real-time guest verification, and a secure staff portal.

---

## 📁 Project Structure

```
fifa/
├── server.js          ← Express backend (API + static file server)
├── index.html         ← Guest-facing RSVP website
├── script.js          ← Frontend JavaScript for RSVP form
├── styles.css         ← Styles for index.html
├── checkin.html        ← Staff-only check-in portal
├── checkin.js          ← Frontend JavaScript for check-in portal
├── checkin.css         ← Styles for checkin.html
├── assets/
│   └── brand/         ← CBE & Visa logo assets
├── data/
│   └── sent_emails/   ← QR code PNG files saved locally
├── .env               ← Environment variables (DB + SMTP + PORT)
└── package.json       ← Node.js dependencies
```

---

## ⚙️ Prerequisites

Make sure the following are installed on your machine:

| Tool | Version | Check |
|------|---------|-------|
| **Node.js** | v18+ | `node --version` |
| **npm** | v8+ | `npm --version` |
| **PostgreSQL** | v14+ | `psql --version` |

---

## 🚀 Step 1 — Set Up Environment Variables

The `.env` file is already configured. Verify or update it:

```bash
# Open the env file
nano /home/blengebre/Documents/Rsvp/fifa/.env
```

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=NewPassword123
DB_NAME=rsvp

# Email (optional — leave blank to skip email sending)
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=

# Server port
PORT=3000
```

---

## 🗄️ Step 2 — Set Up the PostgreSQL Database

The database and table are **created automatically** when the server starts. You only need to make sure PostgreSQL is running.

### Start PostgreSQL (if not running)

```bash
sudo systemctl start postgresql
```

### Verify PostgreSQL is running

```bash
sudo systemctl status postgresql
```

### (One-time) Create the `rsvp` database if it doesn't exist

```bash
sudo -u postgres psql -c "CREATE DATABASE rsvp;"
```

> ✅ The `rsvps` table is created **automatically** the first time you start the server.

---

## 📦 Step 3 — Install Dependencies

```bash
cd /home/blengebre/Documents/Rsvp/fifa
npm install
```

---

## ▶️ Step 4 — Start the Backend Server

### Development mode (auto-restarts on file changes)

```bash
cd /home/blengebre/Documents/Rsvp/fifa
npm run dev
```

### Production mode

```bash
cd /home/blengebre/Documents/Rsvp/fifa
npm start
```

### Expected output on success

```
✅ PostgreSQL connected successfully.
✅ Table "rsvps" is ready.
🚀 Server running on http://localhost:3000
```

> ⚠️ If you see `❌ PostgreSQL connection failed`, check that:
> - PostgreSQL is running (`sudo systemctl start postgresql`)
> - The password in `.env` matches your PostgreSQL user password

---

## 🌐 Step 5 — Access the Frontend

Once the server is running, open your browser and go to:

| Page | URL | Who Uses It |
|------|-----|-------------|
| **RSVP Invitation Site** | `http://localhost:3000/` | VIP Guests |
| **Staff Check-in Portal** | `http://localhost:3000/checkin.html` | Reception Staff Only |

### Pages inside the RSVP site (`index.html`):
1. **Loading Screen** — Animated intro with CBE & Visa branding
2. **Home / Hero Screen** — Event details (date, venue, dress code) + RSVP Now button
3. **Registration Form** — Guest fills in name, email, phone, organization, meal preference
4. **Success / Ticket Screen** — Shows guest's unique ID and QR code after registration

---

## 🖥️ Step 6 — View the Database

### Open the PostgreSQL interactive shell

```bash
sudo -u postgres psql -d rsvp
```

### Useful database commands

```sql
-- See all registered guests
SELECT * FROM rsvps;

-- See only checked-in guests
SELECT name, email, check_in_status, check_in_time
FROM rsvps
WHERE check_in_status = 'Checked In';

-- Count total registrations
SELECT COUNT(*) FROM rsvps;

-- Count checked-in guests
SELECT COUNT(*) FROM rsvps WHERE check_in_status = 'Checked In';

-- See a specific guest by ID
SELECT * FROM rsvps WHERE id = 'VIP-2026-000100';

-- See a specific guest by email
SELECT * FROM rsvps WHERE email = 'example@email.com';

-- Delete all records (for testing — use carefully!)
DELETE FROM rsvps;

-- Exit the psql shell
\q
```

### View formatted table (column-aligned output)

```sql
\x on
SELECT * FROM rsvps ORDER BY created_at DESC LIMIT 10;
```

---

## 🧾 API Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/rsvp` | Submit a new guest registration |
| `GET` | `/api/rsvp/:id` | Look up a guest by their ticket ID |
| `POST` | `/api/rsvp/:id/checkin` | Mark a guest as checked in |
| `GET` | `/qrcodes/:id.png` | View a guest's QR code image |

---

## 📧 Email Configuration (Optional)

To enable confirmation emails with QR code attachments, fill in the SMTP settings in `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

> 💡 For Gmail, use an **App Password** (not your regular password). Go to Google Account → Security → 2-Step Verification → App Passwords.

If SMTP is not configured, the system still works — QR codes are saved locally to `data/sent_emails/` and linked in the success screen.

---

## 🔍 Troubleshooting

| Problem | Fix |
|---------|-----|
| `Cannot connect to PostgreSQL` | Run `sudo systemctl start postgresql` |
| `Port 3000 already in use` | Run `kill $(lsof -t -i:3000)` then restart |
| `npm: command not found` | Install Node.js from https://nodejs.org |
| `Module not found` | Run `npm install` in the `/fifa/` directory |
| QR camera not working on phone | Must use `https://` or `localhost` — camera API requires secure context |
| Guest already registered error | Each email/phone can only register once |

---

## 🗑️ Reset the Database (for testing)

```bash
sudo -u postgres psql -d rsvp -c "DELETE FROM rsvps;"
```

---

*Built for CBE & Visa — FIFA World Cup 2026™ VIP Final Viewing Party | Addis Ababa, Ethiopia*
# VisaandCbe
