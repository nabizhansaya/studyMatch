# Changelog

## Version 3.0 (in progress)

### Done so far

- Request lifecycle: several students can accept an open request, the owner confirms one, and then the request is closed. Telegram usernames are shown only after the confirmation, on both sides.
- The owner can decline a student, delete a request, and either side can cancel a confirmed session. The other side gets a notification.
- No duplicate requests: the same person cannot post the same subject, time and place twice.
- Session reminders 24 hours and 1 hour before a confirmed session (scheduled every 5 minutes).
- Delete my account (database function) and automatic removal of accounts that stay unconfirmed for 3 days.
- Sessions page rebuilt: notifications, confirmed sessions, my open requests with the students who accepted, and requests I accepted.
- New database files 05_request_lifecycle.sql and 06_account_automation.sql. The lock-down file is now 10_lockdown.sql.

- Top bar: a bell button with the list of notifications (it replaces the notifications card on the Sessions page), a theme button (system, light, dark, with monitor, sun and moon icons), and Sign out.
- Notification sound is now on by default, and can be switched off on the Profile page.
- Sessions page has tabs for Confirmed, My requests and I accepted (with counts), and a New request button.
- New look foundation: light and dark colours that follow the system or the button, a background image with a dim overlay, rounded cards with shadows, a sticky top bar.
- New files: js/theme.js, assets/background.webp, assets/source/make_background.py.

- Separate pages: login.html now only signs in, register.html creates an account, forgot.html resets a forgotten password with a code from the e-mail.
- Password rules (at least 8 characters, uppercase, lowercase, number, special character, not a common password) with a live checklist and strength bar, also set in Supabase.
- Keep me signed in: unticked means the login ends when the tab closes and after 1 hour without activity. Ticked keeps it on this device.
- Delete my account on the Profile page, confirmed with a code sent to the e-mail address.
- Light theme is now really light (white top bar and cards), and the two link buttons in the notifications panel and the accept window look like buttons.
- Your Supabase values now live in js/config.js. New files: register.html, forgot.html, js/config.js, js/password.js, js/register.js, js/forgot.js.

- Profile has one Save changes button that saves the details, the Telegram username and the subjects together (database function save_profile in 07_profile_save.sql). A note shows unsaved changes, and the browser asks before you leave the page with unsaved changes.
- Subject, place and faculty fields can be searched by typing (a text box with a suggestion list).
- Small screens and windows: the swipe page grows with its content, so the buttons never cover the text. Dialogs scroll, long words wrap, the top bar and tab bar get smaller on a phone held sideways, and large screens use a wider layout.
- Disabled buttons show a normal "not allowed" cursor instead of the loading cursor.
- Messages for users no longer talk about setup files. The hint for the developer is written to the browser console only.
- The lock-down file is now 10_lockdown.sql, and 07_profile_save.sql is new.

- Subjects are organised by major, year of study and trimester. Students now choose a major (the faculty follows from it). Swipe, Browse, Create and the profile show the subjects of the student's own major and year by default, with filters for any other major, year or trimester, and a button for all subjects. The profile list can also be searched by name or code, and ticked subjects stay ticked when hidden.
- New tables majors and curriculum, new column profiles.major_id. The request search can be limited to a major, year and trimester.
- Real data: spreadsheet templates in data/, and import tools in database/tools/ that read a CSV file and add faculties, majors, subjects and the curriculum.
- New files: database/08_subject_catalog.sql, database/tools/import_catalog.sql, database/tools/import_locations.sql, data/catalog_template.csv, data/locations_template.csv, js/subject-filter.js. The lock-down file is now 10_lockdown.sql.

- Real data prepared from Majors.pdf: data/catalog.csv (17 majors, 456 subjects, 950 curriculum rows), data/catalog_review.txt (what was cleaned or needs a check) and data/locations.csv. New tools: database/tools/set_real_locations.sql, demo_data_preview.sql and remove_demo_data.sql.
- Buttons in pop-up windows have the same size and line up, and a link button no longer stretches taller than the button beside it.

- Forgot password and delete account both use a code from the e-mail instead of a link, because mail programs open links automatically and that used the old token up. The page reset.html is gone, and there is a Send a new code button.
- Only 3 years of study: the year lists run from 1 to 3.
- A request chooses a format first (in person or online). Only an in-person request has a place, and the place Other asks the student to write where to meet. Swipe and Browse also show the format before the place, and the place filter is switched off for online requests.
- New file database/09_request_details.sql (places that need details, and a note on the request). The lock-down file is now 10_lockdown.sql.

### Still to do

- Running the real-data import on the live database, and more media and small animations.

All changes since Assignment 3 (version 1.0), which had three files: app.js, index.html and style.css.

## Version 2.0 (Assignment 4), 2026-10-25

### Files from Assignment 3

- index.html: was the whole application. Now it only redirects to swipe.html. The old version is in assignment3-prototype.
- app.js: replaced by nine scripts in the js folder.
- style.css: moved to css/style.css and rewritten (light and dark colours, bottom tab bar, swipe card, dialogs, notification message, animation, visible focus, large touch targets).
- README.md: rewritten to explain how to build the whole project.
- policies.sql: replaced by login-based rules in database/03_migration.sql and 10_lockdown.sql.

### New files

- Pages: login.html, profile.html, create.html, swipe.html, browse.html, matches.html, and swipe-before.html (used only for the image test).
- Scripts: supabase-client.js, auth.js, requests-common.js, and one script for each page.
- Media: logo.svg, icons.svg, icons-preview.html, three illustrations in two sizes each (WebP), notify.mp3, and the Python scripts that make them.
- Database: 01_schema.sql to 10_lockdown.sql, erd.dbml, and a history folder with the steps taken along the way.
- Documents: CHANGELOG.md.

### Features

- Accounts: before, a drop-down chose a fake user. Now there is e-mail sign-up with confirmation, only for university domains.
- Profile: new page with name, faculty, year, usual place, subjects and Telegram username.
- Requests: before, a student sent a request to one chosen person. Now a student posts an open request, and others accept it with one swipe.
- Finding partners: before, one list with a subject filter. Now swipe cards and a list, with filters for subject, place, format, day and my subjects.
- Writing data: post, accept, skip, undo, cancel, update the profile, add or remove subjects, save the Telegram username.
- Contact: Telegram link shown only after a match.
- Notifications: badge on the Sessions tab, a message on screen, and an optional sound that is off by default.
- Interface: six pages with a bottom tab bar, designed for phones first, plus a help dialog on the first visit.

### Database

- availability table removed, because students have no fixed free time. The time is chosen in each request.
- study_requests: receiver_id removed, as the instructor asked. A request is now an open post with subject, time, length, place, message and status.
- request_responses: new table that links a request to the students who answered it.
- New tables: locations, profile_contacts, notifications and allowed_email_domains.
- profiles: added the usual place and the link to the login account.
- New functions and triggers: create a profile for every new account, create and accept requests, find requests, create notifications, and check the e-mail domain at sign-up.
- Deleting a login account now also deletes its profile (foreign key with cascade), so the same e-mail can be used again.
- Indexes added for the filters. Demo data: 120 fake students and 90 demo requests.

### Security

- Before, anyone with the public key could read the data. Now only logged-in students can, and row rules decide which rows each student sees or changes.
- Registration is limited to allowed e-mail domains and needs e-mail confirmation.
- E-mail addresses are not readable through the API after the lock-down.
- Telegram usernames are visible only to the owner and to a matched partner.
- A request is always posted as the logged-in student, and accepting is checked by a database function.
- Text from the database is added to the pages as plain text only.

### Media and accessibility

- Three WebP illustrations in two sizes each, chosen by screen width, with width and height set.
- SVG logo and SVG icon set.
- A short swipe animation (4.8 seconds, stops by itself, off when reduced motion is set) and a notification sound.
- Descriptive alternative text for meaningful images, and empty alternative text for decorative ones.
- Sound is off by default, every sound has a visual equivalent, and nothing plays automatically.
- Text over the hero image has a dark overlay, with a contrast of about 12.9 to 1 in the worst case.
- Arrow keys and buttons work as an alternative to swiping, and focus is always visible.

### Design decisions

- receiver_id was removed from study_requests because of the instructor's feedback.
- Contact goes through Telegram, so no private messages are stored.
- There are no ratings, because the team decided they are out of scope.
- Time and place belong to the request, because they change from session to session.
- The first student to accept gets the session, and skipping is private.

### Known limitations

- The fake demo students have no login, so they cannot accept requests.
- Notifications work while the site is open. Real push messages are not included.
- The free Supabase plan pauses a project after a week without activity.
- Only one person can accept a request, so groups are not supported.
