# Changelog

All changes since Assignment 3 (version 1.0), which had three files: app.js, index.html and style.css.

## Version 2.0 (Assignment 4), 2026-10-25

### Files from Assignment 3

- index.html: was the whole application. Now it only redirects to swipe.html. The old version is in assignment3-prototype.
- app.js: replaced by nine scripts in the js folder.
- style.css: moved to css/style.css and rewritten (light and dark colours, bottom tab bar, swipe card, dialogs, notification message, animation, visible focus, large touch targets).
- README.md: rewritten to explain how to build the whole project.
- policies.sql: replaced by login-based rules in database/03_migration.sql and 05_lockdown.sql.

### New files

- Pages: login.html, profile.html, create.html, swipe.html, browse.html, matches.html, and swipe-before.html (used only for the image test).
- Scripts: supabase-client.js, auth.js, requests-common.js, and one script for each page.
- Media: logo.svg, icons.svg, icons-preview.html, three illustrations in two sizes each (WebP), notify.mp3, and the Python scripts that make them.
- Database: 01_schema.sql to 05_lockdown.sql, erd.dbml, and a history folder with the steps taken along the way.
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
- There is no password reset yet.
