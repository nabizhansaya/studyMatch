# StudyMatch

StudyMatch helps university students find a study partner. A student posts a study request (subject, date and time, length, place), and other students accept it by swiping right. After a match, both students see each other's Telegram username and arrange the session there.

This is a working prototype for the ICT course project. It uses fake demo data only.

## What it does

- Create an account with a university e-mail address, confirmed by a link in an e-mail. The password must have at least 8 characters, an uppercase letter, a lowercase letter, a number and a special character.
- Sign in with the option Keep me signed in. Without it you are signed out when the tab closes and after 1 hour without activity.
- Save the whole profile with one button, and pick subjects, places and faculties by typing.
- Choose in person or online first. Only an in-person request has a place, and the place "Other" asks where to meet.
- Reset a forgotten password with a code sent by e-mail, and delete your own account after confirming it with a code sent to your e-mail.
- Post a request with subject, date and time, length and place.
- Swipe through other students' requests: right to accept, left to skip, with undo.
- Browse the same requests as a list, with filters for subject, place, format and day.
- See your confirmed sessions, open requests and answers on the Sessions page, with a tab for each part.
- Switch between a light, dark and system theme with the button in the top bar. The bell next to it shows your notifications.
- Several students can accept a request. The owner confirms one, and only then do the two see each other's Telegram username.
- Cancel or delete requests and sessions, and get a notification (a message on screen, and an optional sound) about every change and 24 hours and 1 hour before a session.

## Built with

- HTML, CSS and plain JavaScript, with no framework and no build step.
- Supabase (PostgreSQL, login, API) on the free plan.
- GitHub Pages for publishing (optional).

## Folders

- index.html, login.html, register.html, forgot.html, profile.html, create.html, swipe.html, browse.html, matches.html: the pages.
- swipe-before.html: a copy used only for the image test, not part of the app.
- css: the style of all pages.
- js: the scripts. config.js (your Supabase values), theme.js, supabase-client.js, auth.js, password.js and requests-common.js are shared, and each page has its own script.
- assets: logo, icons, images and the notification sound. The folder source has the Python scripts that make them.
- database: the SQL files 01_schema.sql to 10_lockdown.sql, the ER diagram erd.dbml, and a history folder.
- assignment3-prototype: the three-file prototype from Assignment 3.

## How to build it

You need a free account at supabase.com, VS Code with the Live Server extension, and two e-mail addresses you can open for testing.

### Step 1. Get the files

Clone the repository, or download it as a ZIP from GitHub and unzip it.

### Step 2. Create the Supabase project

1. In Supabase press New project. Choose a name, a region and a strong database password. Save the password and never put it in the repository.
2. Wait until the project is ready.
3. Open Project Settings, then API. Copy the Project URL and the public key (called publishable or anon). Never use the secret or service_role key.

### Step 3. Build the database

Open the SQL Editor and create a new query. Paste each file below, press Run, and check that it finishes without an error. Run them in this order, each one once.

1. database/01_schema.sql creates the base tables.
2. database/02_seed.sql adds 120 fake students, 10 faculties and 30 subjects. It ends with a list of row counts.
3. database/03_migration.sql adds accounts, Telegram contacts, notifications and the security rules.
4. database/04_open_requests.sql adds open requests and 90 demo requests. Its last query should show 90 requests.
5. database/05_request_lifecycle.sql adds the rules for accepting, confirming, declining and cancelling requests, and blocks duplicate requests.
6. database/06_account_automation.sql adds account deletion, the nightly removal of unconfirmed accounts, and the session reminders. It needs the pg_cron extension. If it fails on that line, enable pg_cron in Database, then Extensions, and run the file again.
7. database/07_profile_save.sql adds the function that saves the whole profile in one step.
8. database/08_subject_catalog.sql adds majors and the curriculum (which subject belongs to which major, year and trimester), with demo data.
9. database/09_request_details.sql adds the place details: a request chooses the format first, and the place "Other" asks where to meet.

### Step 4. Set up sign-up

1. Allow your university e-mail domain. Run this in a new query, with your own domain (the part after the @, in lowercase):

insert into allowed_email_domains (domain) values ('youruniversity.edu');

2. For testing only, you may also add gmail.com the same way. Delete it again before real students use the site.
3. In the dashboard open Authentication, then Hooks. For Before User Created choose the function hook_restrict_signup_by_email_domain and save. Without this, anyone can register.
4. Check that Confirm e-mail is switched on.
5. Set the password rules in Supabase, because checks in the browser can be bypassed. Open Authentication, then Sign In / Providers, then the e-mail settings. Set the minimum password length to 8 and the required characters to lowercase, uppercase, digits and symbols. The names of the settings may differ slightly.
6. Edit two e-mail templates in Authentication, then Email Templates, so the e-mail has a code and NO link. Mail programs open links automatically, and that uses the code up, so the code then looks expired. In Magic Link (used by delete account) and in Reset Password (used by forgot password), replace the message with: Your code: {{ .Token }}. Keep the Confirm signup template as it is.
7. In Authentication, URL Configuration, make sure the Redirect URLs end with /** (for example http://127.0.0.1:5500/**), so the confirmation link can return to the site.
8. Open Authentication, then URL Configuration. Set Site URL to http://127.0.0.1:5500 and add the same address to Redirect URLs. Use the address that Live Server shows.

### Step 5. Connect the website

Open js/config.js and replace the two placeholder values with your Project URL and public key. This is the only file that holds your values, so future updates will not overwrite them.

### Step 6. Run it on your computer

1. In VS Code choose File, then Open Folder, and select the folder that contains login.html.
2. Right-click login.html and choose Open with Live Server.
3. Always use the Live Server address. Opening the files by double-click breaks the confirmation link and the icons.

### Step 7. Try it

1. Create an account, click the link in the confirmation e-mail, and sign in.
2. On the Profile page add a Telegram username and tick some subjects.
3. Open Swipe or Browse and accept a demo request. A match window shows a Telegram link.
4. Create your own request. In another browser, create a second account and accept it.
5. In the first account the Sessions tab shows a badge and the match.

### Step 8. Publish with GitHub Pages (optional)

1. Push the files to GitHub.
2. In the repository open Settings, then Pages. Choose Deploy from a branch, the main branch and the root folder, and save.
3. Your site will be at https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/
4. In Supabase set that address as the Site URL and add it to Redirect URLs.

### Step 9. Lock down the database (last step)

When the website works, run database/10_lockdown.sql once. It closes access for visitors who are not logged in, hides e-mail addresses from the API, and gives each table only the permissions the website needs. Then test everything again.

## Adding your real data

The real majors and subjects from Majors.pdf are ready in data/catalog.csv (17 majors, 456 subjects, 950 curriculum rows). The meeting places are in data/locations.csv. Read data/catalog_review.txt first: it lists every automatic decision, and a few items to check. The demo data is replaced in these steps. Real accounts are never deleted.

1. Take a backup: in Supabase export the tables as CSV.
2. In Table Editor open New table, Import data from CSV. Import data/catalog.csv as a table named import_catalog.
3. Run database/tools/import_catalog.sql in the SQL Editor. It only adds and updates. Look at its two last results: the numbers, and the rows that did not fit (it should be empty).
4. Run database/tools/set_real_locations.sql to change the six demo places into Library, Coworking zone, Open space, Dormitory, Online and Other.
5. Run database/tools/demo_data_preview.sql. It changes nothing. Check that the numbers make sense.
6. Run database/tools/remove_demo_data.sql. It deletes the demo students, requests, majors, subjects and faculties.
7. Drop the helper table: drop table import_catalog;
8. Ask every real student to open Profile, choose a major and a year, and save.

## Common problems

- Message "Open js/config.js and paste your Supabase URL": Step 5 is not done.
- "Invalid path specified in request URL": the Project URL has something after .supabase.co. Remove it.
- "Please sign up with your university e-mail address": the domain is not in the allowed list (Step 4).
- No confirmation e-mail: check the spam folder. The built-in e-mail service of Supabase is for testing only. It allows very few e-mails per hour for the whole project, and may send only to members of your Supabase team.
- "email rate limit exceeded": the hourly limit is used up. Wait an hour and reuse the same account. For testing you can switch Confirm e-mail off, or create a test user in Authentication, then Users, with Auto Confirm. For real use, set up your own SMTP provider in the Authentication settings.
- The confirmation link shows an error: Site URL and Redirect URLs do not match your browser address.
- A code (forgot password or delete account) is always "wrong or expired": the e-mail template still contains a link. Remove the link and keep only the code (Step 4, point 6), then ask for a new code and use the newest e-mail.
- "No profile found for this account": the account was created before file 03 was run. Create a new account.
- Icons are missing: open the site through Live Server or GitHub Pages.
- "Database error saving new user": an old profile with the same e-mail is still in the database. Delete it, or run database/history/step5_profile_delete_cascade.sql once.
- New profile rows are not visible in the Table Editor: the demo data fills the first pages. Sort by profile_id descending, or use the SQL Editor.

## Security notes

- The public key is meant to be public. The protection comes from the database rules created by files 03 and 10.
- Never commit the database password or the secret key.
- Telegram usernames are shown only to the two students who share an accepted request.
