# Earth Science Labs

A guided virtual balloon lab for a student working independently or with an adult.

**[Open the simulator](https://jplutajr.github.io/earth-science-labs/)**

## What students do

1. Mark ten galaxies and make a prediction.
2. Measure A → B–J along the balloon surface at a 20 cm diameter.
3. Repeat at a 30 cm diameter.
4. Calculate distance changes, model rates, and constant-rate projections.
5. Use a table and graph to explain the pattern and a limit of the model.

The lab uses model centimeters and an assumed 8-year interval. It does not measure actual cosmic distances or the age of the universe.

Directions are divided into short steps. Students get a readable tape, rounding hints, a calculator, sentence starters, and editable responses. Incorrect measurements receive hints. The app does not fill the data table automatically.

## Teacher and student accounts

[Classroom sign in](https://jplutajr.github.io/earth-science-labs/classroom.html) supports Google sign-in and separate lab-password accounts after backend setup. The teacher dashboard contains progress, responses, the guide, and a control to send students to a selected step. Red review flags identify incorrect numeric drafts and selected possible misconceptions in written answers, with expected values and help prompts. Flags update with saved work and appear only on the teacher side. They do not change answers, grades, or completed progress. Written checks are suggestions for teacher review, not automatic grading. Students reopen their own saved work.

**Connection status:** the site is connected to a Supabase Free-plan project, the classroom database is installed, and the approved teacher email is registered privately. The sign-in page checks provider availability and displays the Google button when enabled. See [classroom setup](docs/CLASSROOM_SETUP.md). Guests can continue using the practice lab.

**Budget: $0.** Keep GitHub Pages and Supabase on their free plans. No paid upgrades, custom domains, or add-ons are needed for this implementation. Free-plan limits and inactivity pauses still apply; see [Supabase pricing](https://supabase.com/pricing).

## Save student work

In practice mode, work saves in the current browser when local storage is available. In classroom mode, work saves to the authenticated account and is shared with its assigned teacher. **Save work file** downloads a JSON backup; **Open work file** restores it. Reports download as HTML, data as CSV, and the browser print dialog can save a PDF. On shared devices, save a backup and use **Start over**.

The practice lab needs no account and sends no student responses to a server. Configured classroom accounts use Supabase Auth and database storage; only assigned classroom users can access the records. There are no analytics or external frontend scripts. GitHub Pages hosts the site; normal hosting requests remain subject to GitHub's privacy practices. The student code is optional. No private educational records or licensed curriculum files are included in this repository.

## For adults and contributors

- [Classroom setup and Google sign-in](docs/CLASSROOM_SETUP.md)
- [Teacher guide and answer key](docs/TEACHER_GUIDE.md)
- [Deployment and development](docs/DEPLOYMENT.md)
- [Plan for future labs](docs/FUTURE_LABS.md)
- [Automated checks](https://github.com/jplutajr/earth-science-labs/actions)

Open `index.html` in a current browser to run locally, or serve this folder with `python3 -m http.server 4173`. The student app needs no build step or package installation.

This is an independent balloon-model adaptation informed by the requested Hallock-style activity and public NASA guidance. It is not an official Hallock product or a NYSED-approved investigation. The teacher and school determine acceptable laboratory use. See the teacher guide for partial NYSSLS / NGSS alignment and model limitations.
