# StudyMatch

StudyMatch helps university students find a study partner. A student posts a study request (subject, date and time, length, place), and other students accept it by swiping right. After a match, both students see each other's Telegram username and arrange the session there.

This is a working prototype for the ICT course project. It uses fake demo data only.

## What it does

- Create an account with a university e-mail address, confirmed by a link in an e-mail.
- Post a request with subject, date and time, length and place.
- Swipe through other students' requests: right to accept, left to skip, with undo.
- Browse the same requests as a list, with filters for subject, place, format and day.
- See your matches and open requests on the Sessions page.
- Get a notification (a message on screen, and an optional sound) when someone accepts your request.

## Built with

- HTML, CSS and plain JavaScript, with no framework and no build step.
- Supabase (PostgreSQL, login, API) on the free plan.
- GitHub Pages for publishing (optional).

## Folders

- index.html, login.html, profile.html, create.html, swipe.html, browse.html, matches.html: the pages.
- swipe-before.html: a copy used only for the image test, not part of the app.
- css: the style of all pages.
- js: the scripts. supabase-client.js, auth.js and requests-common.js are shared, and each page has its own script.
- assets: logo, icons, images and the notification sound. The folder source has the Python scripts that make them.
- database: the SQL files 01_schema.sql to 05_lockdown.sql, the ER diagram erd.dbml, and a history folder.
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

### Step 4. Set up sign-up

1. Allow your university e-mail domain. Run this in a new query, with your own domain (the part after the @, in lowercase):

insert into allowed_email_domains (domain) values ('youruniversity.edu');

2. For testing only, you may also add gmail.com the same way. Delete it again before real students use the site.
3. In the dashboard open Authentication, then Hooks. For Before User Created choose the function hook_restrict_signup_by_email_domain and save. Without this, anyone can register.
4. Check that Confirm e-mail is switched on.
5. Open Authentication, then URL Configuration. Set Site URL to http://127.0.0.1:5500 and add the same address to Redirect URLs. Use the address that Live Server shows.

### Step 5. Connect the website

Open js/supabase-client.js and replace the two placeholder values with your Project URL and public key.

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

When the website works, run database/05_lockdown.sql once. It closes access for visitors who are not logged in, hides e-mail addresses from the API, and gives each table only the permissions the website needs. Then test everything again.

## Common problems

- Message "Open js/supabase-client.js and paste your Supabase URL": Step 5 is not done.
- "Invalid path specified in request URL": the Project URL has something after .supabase.co. Remove it.
- "Please sign up with your university e-mail address": the domain is not in the allowed list (Step 4).
- No confirmation e-mail: check the spam folder. The free e-mail service has a low limit, so wait and reuse the same account.
- The confirmation link shows an error: Site URL and Redirect URLs do not match your browser address.
- "No profile found for this account": the account was created before file 03 was run. Create a new account.
- Icons are missing: open the site through Live Server or GitHub Pages.

## Security notes

- The public key is meant to be public. The protection comes from the database rules created by files 03 and 05.
- Never commit the database password or the secret key.
- Telegram usernames are shown only to the two students who share an accepted request.
