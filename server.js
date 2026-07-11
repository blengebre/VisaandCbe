require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');
const QRCode   = require('qrcode');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── PostgreSQL Connection Pool ────────────────────────────────────────────────
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'rsvp',
});

// Test connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ PostgreSQL connection failed:', err.message);
    console.error('   Check your .env credentials and that PostgreSQL is running.');
  } else {
    console.log('✅ PostgreSQL connected successfully.');
    release();
    initializeDatabase();
  }
});

// ─── Auto-create table if it doesn't exist ────────────────────────────────────
async function initializeDatabase() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS rsvps (
      id               VARCHAR(20)  PRIMARY KEY,
      name             VARCHAR(255) NOT NULL,
      email            VARCHAR(255) NOT NULL UNIQUE,
      phone            VARCHAR(50)  NOT NULL,
      organization     VARCHAR(255) NOT NULL,
      meal_preference  VARCHAR(100),
      special_requests TEXT,
      check_in_status  VARCHAR(20)  DEFAULT 'Not Yet',
      check_in_time    VARCHAR(20),
      created_at       TIMESTAMPTZ  DEFAULT NOW()
    );
  `;
  try {
    await pool.query(createTableSQL);
    console.log('✅ Table "rsvps" is ready.');
  } catch (err) {
    console.error('❌ Failed to create table:', err.message);
  }
}

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
// Serve QR code PNG images for external access
app.use('/qrcodes', express.static(path.join(__dirname, 'data', 'sent_emails')));

// Ensure local email backup directory exists
const EMAILS_DIR = path.join(__dirname, 'data', 'sent_emails');
if (!fs.existsSync(EMAILS_DIR)) {
  fs.mkdirSync(EMAILS_DIR, { recursive: true });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getFormattedTime() {
  const date = new Date();
  let hours   = date.getHours();
  const mins  = date.getMinutes().toString().padStart(2, '0');
  const ampm  = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${mins} ${ampm}`;
}

// ─── API: Submit RSVP ─────────────────────────────────────────────────────────
app.post('/api/rsvp', async (req, res) => {
  const { name, email, phone, organization, mealPreference, specialRequests } = req.body;

  // Required field validation
  if (!name || !email || !phone || !organization) {
    return res.status(400).json({ error: 'Please fill in all required fields.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = phone.trim();

  try {
    // ── 1. Duplicate check ──────────────────────────────────────────────────
    const dupCheck = await pool.query(
      'SELECT id FROM rsvps WHERE email = $1 OR phone = $2',
      [cleanEmail, cleanPhone]
    );

    if (dupCheck.rows.length > 0) {
      return res.status(400).json({
        error: 'A reservation with this email or phone number already exists.'
      });
    }

    // ── 2. Generate sequential Reservation ID ───────────────────────────────
    const countResult  = await pool.query('SELECT COUNT(*) FROM rsvps');
    const nextCounter  = 100 + parseInt(countResult.rows[0].count, 10);
    const reservationId = `VIP-2026-${String(nextCounter).padStart(6, '0')}`;

    // ── 3. Generate QR Code ─────────────────────────────────────────────────
    const qrDataUrl = await QRCode.toDataURL(reservationId, {
      color: { dark: '#3A125E', light: '#FFFFFF' },
      width: 300,
      margin: 2
    });

    const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
    fs.writeFileSync(path.join(EMAILS_DIR, `qrcode-${reservationId}.png`), qrBuffer);

    // ── 4. Save to PostgreSQL ───────────────────────────────────────────────
    await pool.query(
      `INSERT INTO rsvps
         (id, name, email, phone, organization, meal_preference, special_requests)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        reservationId,
        name.trim(),
        cleanEmail,
        cleanPhone,
        organization.trim(),
        (mealPreference  || '').trim(),
        (specialRequests || '').trim()
      ]
    );

    console.log(`✅ RSVP saved: ${reservationId} — ${name.trim()} <${cleanEmail}>`);

    // ── 5. Build confirmation email HTML ────────────────────────────────────
    const emailBodyHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Inter', -apple-system, sans-serif; background:#f7f7f9; color:#333; margin:0; padding:0; }
          .card { max-width:600px; margin:40px auto; background:#fff; border-radius:12px;
                  overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,.08); border-top:6px solid #3A125E; }
          .hdr  { background:#3A125E; color:#fff; text-align:center; padding:30px 20px; }
          .hdr h1 { margin:0; font-size:20px; font-weight:700; letter-spacing:2px; color:#D4AF37; }
          .hdr p  { margin:5px 0 0; font-size:13px; opacity:.9; letter-spacing:1px; }
          .body { padding:40px 30px; }
          .greeting { font-size:18px; font-weight:600; margin-bottom:20px; color:#3A125E; }
          .msg  { line-height:1.6; margin-bottom:30px; color:#555; }
          .box  { background:#fcf8ff; border:1px solid #e8dbf5; border-radius:8px; padding:20px; margin-bottom:30px; }
          .lbl  { font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#888; margin-bottom:2px; }
          .val  { font-size:15px; font-weight:600; color:#3A125E; margin-bottom:12px; }
          .qrc  { text-align:center; margin:30px 0; padding:20px; border:1px dashed #d1c4e9; border-radius:8px; }
          .qrc img { width:200px; height:200px; display:block; margin:0 auto 10px; }
          .cap  { font-size:12px; color:#666; margin-top:8px; }
          .ftr  { background:#fafafa; border-top:1px solid #eee; padding:20px 30px;
                  text-align:center; font-size:13px; color:#666; }
          .ftr strong { color:#3A125E; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="hdr">
            <h1>FIFA WORLD CUP 2026™</h1>
            <p>FINAL VIEWING PARTY</p>
          </div>
          <div class="body">
            <div class="greeting">Dear ${name.trim()},</div>
            <div class="msg">
              Thank you for confirming your attendance.<br><br>
              Your reservation has been successfully received.
              Please present the QR Code below upon arrival at the venue.
            </div>
            <div class="box">
              <div class="lbl">Reservation ID</div>
              <div class="val">${reservationId}</div>
              <div class="lbl">Date</div>
              <div class="val">July 19, 2026</div>
              <div class="lbl">Venue</div>
              <div class="val">VIP Lounge, Commercial Bank of Ethiopia HQ, Addis Ababa</div>
            </div>
            <div class="qrc">
              <img src="cid:qrcode" alt="QR Code Ticket">
              <div class="cap">Scan this code at the entrance for VIP entry</div>
              <div class="qr-link" style="margin-top:10px; text-align:center;">
                <a href="http://localhost:${PORT}/qrcodes/${reservationId}.png" target="_blank" style="color:#3A125E; text-decoration:none; font-weight:600;">View QR Code Image</a>
              </div>
            </div>
            <div class="msg" style="text-align:center;font-style:italic;margin-top:20px;">
              See you at the FIFA World Cup 2026 Final Viewing Party.
            </div>
          </div>
          <div class="ftr">
            <strong>Commercial Bank of Ethiopia</strong> &amp; <strong>Visa</strong>
          </div>
        </div>
      </body>
      </html>
    `;

    // ── 6. Save local email backup ──────────────────────────────────────────
    const localBackup = emailBodyHTML.replace('src="cid:qrcode"', `src="${qrDataUrl}"`);
    fs.writeFileSync(path.join(EMAILS_DIR, `email-${reservationId}.html`), localBackup);

    // ── 7. Send email if SMTP is configured ─────────────────────────────────
    let emailSent = false;
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          host:   process.env.SMTP_HOST,
          port:   parseInt(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        });
        await transporter.sendMail({
          from:        `"CBE & Visa VIP Events" <${process.env.SMTP_USER}>`,
          to:          cleanEmail,
          subject:     'Your FIFA World Cup 2026 VIP Reservation',
          html:        emailBodyHTML,
          attachments: [{ filename: `qrcode-${reservationId}.png`, content: qrBuffer, cid: 'qrcode' }]
        });
        emailSent = true;
        console.log(`📧 Email sent to ${cleanEmail}`);
      } catch (err) {
        console.error('⚠️  SMTP send failed (local backup still saved):', err.message);
      }
    } else {
      console.log(`📁 Email backup saved: data/sent_emails/email-${reservationId}.html`);
    }

    return res.status(200).json({ success: true, reservationId, qrDataUrl, emailSent });

  } catch (err) {
    console.error('❌ RSVP error:', err.message);
    return res.status(500).json({ error: 'Internal server error. Please try again.' });
  }
});

// ─── API: Lookup Reservation (Scanner) ────────────────────────────────────────
app.get('/api/rsvp/:id', async (req, res) => {
  const id = req.params.id.trim().toUpperCase();
  try {
    const result = await pool.query('SELECT * FROM rsvps WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reservation not found.' });
    }

    // Map snake_case DB columns → camelCase for frontend
    const r = result.rows[0];
    return res.status(200).json({
      id:              r.id,
      name:            r.name,
      email:           r.email,
      phone:           r.phone,
      organization:    r.organization,
      mealPreference:  r.meal_preference,
      specialRequests: r.special_requests,
      checkInStatus:   r.check_in_status,
      checkInTime:     r.check_in_time,
      createdAt:       r.created_at
    });
  } catch (err) {
    console.error('❌ Lookup error:', err.message);
    return res.status(500).json({ error: 'Database error.' });
  }
});

// ─── API: Check In Guest ──────────────────────────────────────────────────────
app.post('/api/rsvp/:id/checkin', async (req, res) => {
  const id = req.params.id.trim().toUpperCase();
  try {
    // Find guest
    const found = await pool.query('SELECT * FROM rsvps WHERE id = $1', [id]);
    if (found.rows.length === 0) {
      return res.status(404).json({ error: 'Reservation not found.' });
    }

    const rsvp = found.rows[0];

    // Already checked in?
    if (rsvp.check_in_status === 'Checked In') {
      return res.status(400).json({
        error:       'Already Checked In',
        checkInTime: rsvp.check_in_time
      });
    }

    // Perform check-in
    const checkInTime = getFormattedTime();
    const updated = await pool.query(
      `UPDATE rsvps
          SET check_in_status = $1, check_in_time = $2
        WHERE id = $3
        RETURNING *`,
      ['Checked In', checkInTime, id]
    );

    const r = updated.rows[0];
    console.log(`✅ Checked in: ${r.name} (${id}) at ${checkInTime}`);

    return res.status(200).json({
      success: true,
      rsvp: {
        id:              r.id,
        name:            r.name,
        email:           r.email,
        phone:           r.phone,
        organization:    r.organization,
        mealPreference:  r.meal_preference,
        specialRequests: r.special_requests,
        checkInStatus:   r.check_in_status,
        checkInTime:     r.check_in_time
      }
    });
  } catch (err) {
    console.error('❌ Check-in error:', err.message);
    return res.status(500).json({ error: 'Database error during check-in.' });
  }
});

// ─── API: Serve QR Code Image ────────────────────────────────────────
app.get('/qrcodes/:id.png', (req, res) => {
  const id = req.params.id;
  const filePath = path.join(__dirname, 'data', 'sent_emails', `qrcode-${id}.png`);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'QR code not found.' });
  }
});
