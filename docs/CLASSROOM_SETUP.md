# Classroom account setup

The site is connected to **Earth Science Labs**, a Supabase Free-plan project in the approved organization. The classroom migration is applied and the approved teacher email is registered privately. **Google provider configuration and the first real-account sign-in are still pending.** Teacher registration is not the same as creating an authenticated user.

The Supabase dashboard owner's email may differ from the teacher's sign-in email. The verified app email must match the private teacher roster.

The root page opens the practice lab for guests. Signed-in students open their own classroom notebook; teachers open their dashboard. No practice answers are uploaded automatically.

**Budget: $0.** Keep this project on Supabase Free and the existing GitHub Pages site. Do not enable paid upgrades, custom domains, compute upgrades, or other add-ons. Free projects may pause after inactivity; restore the project from Supabase when needed. See current [Supabase pricing](https://supabase.com/pricing).

## Finish this project's Google connection

The database, private teacher registration, and public site connection below are already complete for this deployment. Do not rerun the teacher registration or recreate the project. Complete section 3A using these exact public settings:

| Setting | Value |
| --- | --- |
| Supabase project | `uiadruwqzrcrwndvbrlk` |
| Google authorized JavaScript origin | `https://jplutajr.github.io` |
| Google authorized redirect URI | `https://uiadruwqzrcrwndvbrlk.supabase.co/auth/v1/callback` |
| Supabase Auth Site URL | `https://jplutajr.github.io/earth-science-labs/` |
| Supabase Auth allowed redirect URL | `https://jplutajr.github.io/earth-science-labs/classroom.html` |

Open the [Google Auth Platform](https://console.cloud.google.com/auth/overview) to create the Web application OAuth client. Enter its client ID and client secret directly into the Google provider settings in the [Supabase project dashboard](https://supabase.com/dashboard/project/uiadruwqzrcrwndvbrlk), under Authentication. Configure URL settings as shown above. The connector used to prepare this release cannot create Google OAuth credentials or edit provider settings.

Once saved, reload [Classroom sign in](https://jplutajr.github.io/earth-science-labs/classroom.html). The page detects the enabled Google provider automatically; no new code deployment is needed. Provider availability alone does not verify the client credentials, callback URLs, school policy, or a successful sign-in. Complete the real-account checks below.

## What it does

- An approved teacher account opens `teacher.html`: student progress, responses, a teaching guide, answer key, roster registration, and step controls.
- An approved student account opens the lab with saved work and the teacher's current step.
- Students can revisit earlier work. Moving to calculations with missing measurements shows a prerequisite message rather than inventing measurements.
- The teacher explicitly chooses **Send student to Step …**. Simply reading another section of the guide does not move the student.
- Open student pages check the class step about every five seconds. A student who is typing gets a button to join the new step; the app waits until typing stops before changing the view.
- Work saves after a brief pause. Concurrent changes on another device cause a visible conflict and require an explicit reopen; they do not silently overwrite newer work.

## 1. Connect the backend

Use a dedicated Supabase project owned by the teacher or school. Apply `backend/001_classroom.sql` through its SQL editor or an authorized Supabase connection.

The migration creates only the lab's named tables, schema, and functions. All classroom tables have row-level security enabled and no direct anonymous or authenticated table grants. The exposed RPC functions independently check the signed-in user and classroom ownership for every read and write. Client-side page routing is not the security boundary.

Before adding student records, use the hosting and account arrangements accepted by your school. Do not upload an IEP, full educational record, or unnecessary student identifiers.

## 2. Approve the teacher account

The account owner supplies the exact school email privately. Run this parameterized example in the SQL editor with that email substituted there; do not commit the actual account roster to GitHub.

```sql
insert into lab_private.invites(email, role, display_name)
values (lower('YOUR_TEACHER_EMAIL'), 'teacher', 'Teacher');
```

The first verified sign-in matching that email creates the teacher profile and classroom. No one receives teacher privileges because of a browser setting, an email domain, or editable user metadata.

## 3A. Google sign-in (preferred for an existing school Google account)

Follow the current [Supabase Google setup guide](https://supabase.com/docs/guides/auth/social-login/auth-google).

1. Create or use the school's Google Cloud project and configure the OAuth consent screen/audience. Use **Internal** only if all intended users belong to that Workspace organization and the option is available. For an External app in Testing, add the exact teacher and student Google accounts as test users before sign-in. Use only the basic identity scopes listed below.
2. Create an OAuth client of type **Web application**.
3. Add the authorized JavaScript origin: `https://jplutajr.github.io`.
4. Add the exact Supabase callback shown in the project's Google provider settings, typically `https://PROJECT_REF.supabase.co/auth/v1/callback`.
5. Place the Google client ID and client secret in **Supabase's Google provider settings**. Keep the secret out of this repository, browser config, GitHub issues, and chat.
6. Add `https://jplutajr.github.io/earth-science-labs/classroom.html` to Supabase Auth's allowed redirect URLs. Set the site's URL to the Earth Science Labs site.
7. Use only Google identity scopes (openid, email, profile). The lab does not request Gmail or Drive access.
8. If the school's Workspace settings restrict third-party apps or student access, the administrator must allow this OAuth application.

The app uses a PKCE redirect flow with a one-use verifier, performs the code exchange through Supabase Auth, and clears the returned code from the address bar. Supabase handles the Google authentication exchange. No Google password is entered into the lab.

Google may create an authentication identity for a new visitor, but **an unlisted identity has no classroom role or records access**. Keep application access limited to the roster; configure the provider audience for the intended school users. The app has no public email/password sign-up form.

## 3B. Separate lab-password login

For a fallback, an authentication administrator creates an email/password account in **Supabase → Authentication → Users** and assigns an initial password privately. Use a unique lab password, never a person's Google password. Make the email verified through the appropriate administrator workflow.

The approved teacher email must match the roster entry from step 2. Student email accounts must match the entries registered by the teacher. Password recovery and changes are handled by the account administrator in this release.

There is no hardcoded password, shared teacher PIN, or client-side teacher allowlist.

## 4. Set the public connection configuration

Edit `assets/classroom-config.js`:

```js
window.CLASSROOM_CONFIG = Object.freeze({
  enabled: true,
  googleEnabled: "auto", // checks the public Auth settings before showing Google
  supabaseUrl: "https://YOUR_PROJECT_REF.supabase.co",
  publishableKey: "sb_publishable_YOUR_PUBLIC_KEY"
});
```

A legacy Supabase anon key is also supported. **Never use a service-role or secret key.** The application requires the database authorization rules; a public key does not grant classroom access by itself.

For a new deployment, push the config change and wait for Pages. This project's public config is already connected. Sign in at `classroom.html` using the approved teacher account. Use **Add a student account** to register the exact student email and a classroom display code.

## 5. Check the real accounts

1. Teacher: verify the dashboard and assigned class open.
2. Student in a separate browser: sign in and record one measurement.
3. Teacher: check that the measurement appears and send a new step.
4. Student: confirm that the new step opens without losing the earlier answer.
5. Sign out and back in: confirm the work reopens.
6. Try the teacher URL using the student account: it should return to the student lab.
7. Check Google sign-in on the actual school Chromebook or browser.

Automated checks use synthetic identities and a PostgreSQL test database. They verify role restrictions and the app's behavior; they do not substitute for activating the real Google provider or checking the school's login policy.

## Privacy and storage behavior

Classroom work is stored in the connected Supabase database and is visible only through authorized classroom RPCs. The teacher can see enrolled students' work. Students can read and update only their own notebook. Anonymous and unlisted accounts cannot view records. A teacher cannot move a student from another teacher's roster.

Sessions and any unsent draft are kept in the current tab's session storage. Student drafts are keyed by the authenticated user ID; they are cleared on sign-out. Sign-out tries to finish saving and warns when work is unsaved. A downloaded work file remains wherever the user saved it and must be handled as classroom work.

Practice mode uses the original device-local notebook. It never automatically imports practice work into a signed-in account. To transfer it, the student deliberately opens a downloaded work file.

The teacher dashboard's key is separated from the normal student interface. This is an open-source simulation: formulas and the older teacher guide are publicly available in the repository. Login protects student records; it does not make the model's numerical answers secret.

For deletion, the administrator can remove an authentication user or the associated classroom data; foreign-key cascades remove dependent lab records. Account and classroom deletion should be planned before execution.

## Database advisor review

This schema deliberately denies all direct table access and exposes a small set of checked RPC functions. Supabase's security advisor reports two categories that require understanding this design:

- [RLS enabled without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy): intentional deny-all behavior on the five classroom/roster tables. Do not add broad policies to silence the notice.
- [Authenticated SECURITY DEFINER function access](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable): intentional for the six application RPCs. Each function validates the current user, role, and classroom; all use an empty search path and grant no anonymous execution.

The live database was checked for enabled RLS and no direct anonymous/authenticated table privileges. CI verifies role isolation, stale-write protection, and cross-class denials against disposable PostgreSQL data. A separate read-only production probe checks that public Auth settings are reachable and anonymous requests for classroom context or progress are denied. These checks do not authenticate as a real teacher or student.

## Sources

- [Supabase: Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase: password authentication](https://supabase.com/docs/guides/auth/passwords)
- [Supabase: PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [Supabase: database authorization](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Auth OpenAPI](https://github.com/supabase/auth/blob/master/openapi.yaml)
