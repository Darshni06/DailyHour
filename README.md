# DailyHour

Timetable and substitution manager for a school. When a teacher is absent, the coordinator marks them absent, DailyHour suggests the best free teachers, and the cover list goes out on WhatsApp so teachers never have to keep checking the site.

```
DailyHour/
  frontend/   React + Vite website (all screens and design). Edit freely.
  backend/    Firebase config: security rules and indexes. No server code.
```

## What it does

| Who | What they can do |
| --- | --- |
| Admin | Everything a coordinator can, plus create coordinators |
| Coordinator | Mark absences, assign or auto-assign cover, share the cover list, edit class timetables, see any teacher or class, add teachers, set periods, import the timetable |
| Teacher | See their own day and week (cover duties highlighted), look up any class timetable |

Sharing without opening the site:
- Each day gets a private link (`/s/...`) that works without signing in and updates live when cover changes.
- One tap sends the whole list to the staff WhatsApp group.
- One tap per covering teacher opens WhatsApp to that teacher with their own periods already typed.
- Any timetable can be shared as text, copied, or printed and saved as PDF.

How cover is suggested: same subject first, then teachers who already teach that class, then whoever has covered the fewest periods this month and today. Teachers who are busy, absent or already covering in that period are never offered.

## Step 1. Install the tools (once)

1. Node.js 18 or newer from nodejs.org
2. Firebase CLI: `npm install -g firebase-tools`
3. A free Firebase account (Google login), a free Vercel account, and a GitHub account

## Step 2. Create the Firebase project

1. Go to console.firebase.google.com, Add project, name it `dailyhour`. Google Analytics can be off.
2. Build, Authentication, Get started, Sign-in method, turn on **Email/Password**.
3. Build, Firestore Database, Create database, choose a region near the school (for India: `asia-south1`), start in **production mode**.
4. Project settings (gear icon), General, Your apps, click the web icon `</>`, register an app named `dailyhour-web`. Copy the `firebaseConfig` values shown. Hosting is not needed.

The free Spark plan is enough. DailyHour uses no Cloud Functions, so no card is needed.

## Step 3. Connect the frontend

```
cd frontend
cp .env.example .env
```

Open `.env` and fill the six values from `firebaseConfig`:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## Step 4. Deploy the security rules (backend)

1. Open `backend/.firebaserc` and replace `YOUR_FIREBASE_PROJECT_ID` with your project ID (Project settings, General).
2. Run:

```
cd backend
firebase login
firebase deploy --only firestore
```

This uploads `firestore.rules`. Without it, the app shows "Missing or insufficient permissions".

## Step 5. Create the first admin (only manual step)

1. Firebase console, Authentication, Users, **Add user**. Enter the admin email and a password. Copy the **User UID** shown in the list.
2. Firestore Database, **Start collection**, Collection ID `users`.
3. Document ID: paste the **UID** exactly. Add these fields:

| Field | Type | Value |
| --- | --- | --- |
| name | string | Admin's name |
| email | string | same email, lowercase |
| role | string | `admin` |
| active | **boolean** | `true` |
| phone | string | optional |

`active` must be a boolean, not the text "true".

## Step 6. Run it on your computer

```
cd frontend
npm install
npm run dev
```

Open the address it prints (usually http://localhost:5173) and sign in as the admin.

## Step 7. Set up the school (about 20 minutes)

Sign in as admin, then open **Manage**:

1. **Periods**: school name, WhatsApp country code, working days, period and break times. The defaults are only a starting point.
2. **People**: **Add many**, paste one teacher per line as `name, email, phone`. Send each teacher their login with the Send button. Add the coordinator with **Add person** and Role = Coordinator.
3. **Classes**: add class names, one per line.
4. **Import**: download the template, fill your existing timetable in Excel or Google Sheets, save as CSV, upload it. Columns: `class, day, period, teacher, subject`. Day can be Mon, Tuesday or 1 to 7. Period can be 1, 2, 3 (teaching periods, breaks not counted) or the label. Teacher is the email or exact name. The preview lists any row that cannot be imported and why.

Individual lessons can be fixed later in **Classes**, Week, Edit timetable.

## Step 8. Deploy to Vercel

1. Put the whole `DailyHour` folder on GitHub (new private repository).
2. vercel.com, Add New, Project, import the repository.
3. **Root Directory**: `frontend`. Framework Preset: Vite.
4. Environment Variables: add the same six `VITE_FIREBASE_...` values from `.env`.
5. Deploy.
6. Firebase console, Authentication, Settings, **Authorized domains**, Add domain: your Vercel address (for example `dailyhour.vercel.app`). This makes password-reset emails work.

Every push to GitHub redeploys automatically.

## Handover checklist

1. Admin login given to the school (change the password first with "Forgot password").
2. Coordinator account created and tested on a phone.
3. Show the coordinator the daily routine below.
4. Tell teachers to tap **Forgot password** on first login to set their own password.

## Daily routine for the coordinator

1. Open **Substitutions** (today is selected).
2. **Mark absent**, tick the teachers, choose whole day or some periods, Save.
3. Tap **Auto-assign**, or change any suggestion from the dropdown on each card.
4. Tap **Share**. Send to the staff group, or message each covering teacher.

If something changes later, edit the cards. The shared link updates by itself.

## Design decisions

- **Firebase Auth and Firestore only**, free plan, no server code, so there is nothing to maintain after handover.
- **Logins use email.** Admin creates accounts from inside the app using a temporary second Firebase connection, so the admin is never signed out. Teachers set their own password through Forgot password.
- **People are switched off, not deleted.** The free plan cannot delete another person's login safely; switching off blocks access immediately and keeps history.
- **One Firestore document per class** holds its weekly timetable. A full load is about one read per class, which keeps a school well inside the free quota.
- **The base timetable is never altered by absences.** Absences and cover are stored per date on top of it.
- **The public link is unguessable** (random token per day) and shows only class, period and teacher names, no phone numbers or emails.
- **Every signed-in user can read all names and phone numbers** (needed for class and teacher lookup and WhatsApp). Only coordinators and the admin can change anything.

## Troubleshooting

| Message | Fix |
| --- | --- |
| Firebase is not connected yet | `.env` missing (local) or environment variables not set in Vercel. Add them and redeploy. |
| Missing or insufficient permissions | Step 4 not done, or the admin document in `users` has the wrong UID, `role`, or `active` is not a boolean. |
| Your account is not set up | Signed in with an email that has no document in `users`. |
| auth/operation-not-allowed | Email/Password sign-in is not enabled (Step 2). |
| Blank page after Vercel deploy | Root Directory must be `frontend`. |
| A page refresh shows 404 on Vercel | `frontend/vercel.json` must be present (it is included). |

## Changing the look

All colours and fonts are at the top of `frontend/src/index.css`. Pages are in `frontend/src/pages`, shared pieces in `frontend/src/components`. The backend folder never needs to change for design work.
