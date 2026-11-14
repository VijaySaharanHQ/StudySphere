# StudySphere — GitHub Pages + Firebase

A shared Class 12 PCM planner for Vijay, Shambhavi and Palak.

## Files
- `index.html` — page structure
- `styles.css` — responsive dark UI
- `app.js` — Firebase Authentication, Firestore sync and app features
- `firestore.rules` — group-only Firestore security rules

## 1. Create the Firebase project
1. Open https://console.firebase.google.com/ and create a project named `StudySphere`.
2. Add a Web App from Project Overview (`</>`).
3. Copy the Firebase web configuration object.
4. Open `app.js` and replace the placeholder values in `firebaseConfig`.
5. In Firebase Console → Authentication → Sign-in method, enable **Email/Password**.
6. In Authentication → Users, create exactly three accounts for the intended students. Use email addresses and passwords managed privately by each account holder. Do not share passwords in the group chat.

## 2. Create the Firestore database and rules
1. Firebase Console → Firestore Database → Create database.
2. Choose production mode.
3. Open the Rules tab and replace the rules with the full contents of `firestore.rules`, then Publish.
4. In Firestore Data, create this structure manually:

`groups` (collection)
  `studysphere` (document)
    `members` (collection)
      `{Vijay_AUTH_UID}` (document) fields: `name` = `Vijay`, `role` = `student`
      `{Shambhavi_AUTH_UID}` (document) fields: `name` = `Shambhavi`, `role` = `student`
      `{Palak_AUTH_UID}` (document) fields: `name` = `Palak`, `role` = `student`

Get each exact UID from Authentication → Users. The document ID must be the UID, not the email address. You can leave the document fields as shown. Do not create the shared data collections; the app creates them when used.

**Important:** only add the three intended student accounts to this group. The security rules check for a matching membership document before allowing shared data access. Do not publish the Firebase Admin SDK key or service-account credentials in this website.

## 3. Publish on GitHub Pages
1. Create a GitHub repository, for example `studysphere`.
2. Upload `index.html`, `styles.css`, `app.js`, and `firestore.rules` to the repository root.
3. Open repository Settings → Pages.
4. Under Build and deployment, choose **Deploy from a branch**, select `main` and `/ (root)`, then Save.
5. Wait for GitHub Pages to publish the site. Open the URL it provides and sign in.

## 4. Features included
- Individual student login and profile name
- Shared live Firestore data across devices
- Class 12 PCM syllabus tracker for all three students
- Weekly timetable blocks for a student or the whole group
- Shared task/homework board with assignee, category, due date and completion
- Practical file, experiment, activity and project tracker
- JEE Main / CBSE pre-board / practical / board exam milestone planner
- Shared goals and study notes
- Dashboard progress indicators for each student
- Browser-local 25/5 Pomodoro focus timer

## 5. First-use notes
- The first member who signs in creates the initial PCM chapter rows and practical starter rows. Other members then see the same shared records.
- The syllabus list is a starter tracker based on the CBSE Class 12 PCM chapter structure used when this project was drafted. Always compare it with the current official CBSE curriculum and your school’s prescribed syllabus; remove or add chapters if needed.
- Exam dates are intentionally not hard-coded. Add dates only after confirming them from official CBSE / NTA notices.
- Timetable entries are added manually to suit each person's real live-class schedule.
- The focus timer is local to the browser and does not sync. Tasks, syllabus, timetable, practicals, goals, notes and milestones do sync.

## Security and privacy
- The Firebase web config is designed to be present in a client-side website; it is not an admin secret. Firestore security rules protect the data.
- Never place service-account JSON, private keys or admin credentials in GitHub.
- Use unique passwords and keep them private. If you accidentally expose a password, change it immediately.
- Firebase may require a billing/payment setup for some usage levels or services. Review Firebase plan limits and project settings before inviting users.
- This is a study organizer, not an official CBSE/NTA source or a substitute for teacher instructions.

## Official references
- Firebase web setup: https://firebase.google.com/docs/web/setup
- Firebase CDN setup: https://firebase.google.com/docs/web/alt-setup
- Firebase Authentication for web: https://firebase.google.com/docs/auth/web/password-auth
- Firestore security rules: https://firebase.google.com/docs/firestore/security/get-started
- CBSE curriculum: https://cbseacademic.nic.in/
- JEE Main official portal: https://jeemain.nta.nic.in/
