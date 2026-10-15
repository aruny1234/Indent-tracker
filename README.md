# Indent Tracker

Purchase Indent Tracking & Performance Management for NetSuite Purchase Requisition exports.
React + Vite + Tailwind, Firebase Authentication + Firestore, SheetJS for Excel, FCM for push alerts.
Deploys to GitHub Pages through GitHub Actions.

## What it does

**Manager:** import the NetSuite Excel (preview, validation, duplicate check, import history), assign one or many indent lines to an employee with an expected receiving date, see every indent, filter/search/export to Excel, see employee and department performance (OTD %, average delay), manage users, read the audit log.

**Employee:** sees only indents assigned to them, enters the actual receiving date and remarks, sees their own performance, receives alerts.

**Status rules** (calculated from the expected receiving date):

| Status | Rule |
|---|---|
| Not Scheduled | No expected receiving date yet |
| Pending | More than 7 days left |
| Due Soon | 4 to 7 days left (reminder alert) |
| Urgent | 0 to 3 days left (stronger alert) |
| Overdue | Expected date passed, not received |
| Completed - On Time | Actual date ≤ expected date |
| Completed - Late | Actual date > expected date |

A record is identified by **Document Number + Item**. Re-importing the same line updates only the NetSuite fields (date, status, quantity, price…); assignment, dates and remarks are kept.

---

## Setup (one time, about 30 minutes)

### 1. Firebase project
1. Go to https://console.firebase.google.com, create a project.
2. **Build > Authentication > Get started > Email/Password > Enable.**
3. **Build > Firestore Database > Create database** (production mode, region `asia-south1` Mumbai).
4. **Project settings (gear) > General > Your apps > Web (</>)**. Register the app and copy the `firebaseConfig` values.

### 2. Security rules (no install needed)
Firestore > **Rules** tab > paste the full contents of `firestore.rules` > **Publish**.
These rules are what stop an employee from reading someone else's indents. Do not skip this.

### 3. Create the first manager
1. Authentication > Users > **Add user** (your email + password). Copy the **User UID**.
2. Firestore > Data > **Start collection** `users` > Document ID = that UID. Add fields:
   - `name` (string) e.g. `Ajay Kumar`
   - `email` (string)
   - `role` (string) `manager`
   - `active` (boolean) `true`
   - `department` (string), `employeeId` (string)

All other users can then be added from the app's **Users** page.

### 4. Put the code on GitHub
1. Create a repository (e.g. `indent-tracker`) and upload all these files (keep the `.github` folder).
2. **Settings > Secrets and variables > Actions > New repository secret**, add each value from step 1.4:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`
   (and `VITE_FIREBASE_VAPID_KEY` if you set up push, step 6).
3. **Settings > Pages > Source: GitHub Actions.**
4. **Actions** tab > run "Deploy to GitHub Pages" (or push any change). The app URL appears when it finishes, e.g. `https://<username>.github.io/indent-tracker/`.

### 5. Allow the GitHub domain to sign in
Firebase > Authentication > **Settings > Authorized domains > Add domain** > `<username>.github.io`.
Without this, login fails on the live site.

### 6. Alerts

**Works on the free (Spark) plan:** whenever an employee opens the app, it creates their Due Soon / Urgent / Overdue alerts (one per stage per indent) and shows a browser notification if they allowed it on the Alerts page.

**Push to phones even when the app is closed (optional):**
1. Project settings > **Cloud Messaging > Web Push certificates > Generate key pair**. Add it as the `VITE_FIREBASE_VAPID_KEY` secret and redeploy.
2. Upgrade to the **Blaze (pay-as-you-go)** plan. Scheduled Cloud Functions are not available on the free plan. At this scale (one run per day) the usage normally stays inside the free quota, but a billing account is required. Set a budget alert in Google Cloud Billing.
3. Install Node.js 20 and the Firebase CLI, then:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add            # pick your project
   cd functions && npm install && cp .env.example .env   # put your app URL in .env
   cd .. && firebase deploy --only functions,firestore
   ```
   The job `dailyIndentAlerts` runs every day at 08:00 IST: it refreshes statuses, creates alerts, pushes them to employees' devices and sends managers an overdue summary.

Note: on iPhone, web push only works after the user adds the site to the Home Screen.

---

## Run on your computer (optional)
```bash
npm install
cp .env.example .env   # fill in the Firebase values
npm run dev
```

## Project structure
```
src/
  utils/status.js        status rules (keep in sync with functions/index.js)
  utils/excel.js         NetSuite Excel reading, header detection, validation, duplicate check
  utils/performance.js   OTD %, average delay, employee/department summaries
  services/db.js         all Firestore reads/writes, audit log, user creation
  services/alerts.js     in-app alerts, browser notifications, FCM token
  pages/manager/         Dashboard, Indents, Import, Users, Audit log
  pages/employee/        My indents, My performance
functions/index.js       daily scheduled alert job
firestore.rules          role-based access rules
```

## Performance definitions
- **OTD % (On-Time Delivery)** = items received on or before the expected date ÷ (on time + received late + still overdue). Overdue items count as misses, so leaving items open does not improve the figure.
- **Average delay** = average days late, for items received late.
