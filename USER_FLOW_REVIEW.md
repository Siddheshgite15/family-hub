# User flow review

**Status:** Contact table filled from `src/config/school.ts` defaults and `/.env.example` (stakeholder should replace placeholder phone, emails, maps, and website when final). Flow checklists below remain for explicit sign-off. Future implementation should follow **`CURRENT_SYSTEM_BEHAVIOR.md`** unless this file overrides after agreement.

For contact details on the public site, set `VITE_SCHOOL_*` (see `.env.example`) rather than editing components.

## Final school / contact block (production)

| Field | Your value |
|-------|------------|
| School display name (Marathi, as on letterhead) | वैनतेय प्राथमिक विद्या मंदिर |
| Short name (navbar mobile / compact) | वैनतेय |
| Tagline (e.g. location line) | निफाड, नाशिक |
| Full postal address (multiline OK) | वैनतेय प्राथमिक विद्या मंदिर; निफाड, ता. निफाड, जि. नाशिक — 422303 |
| PIN code | 422303 |
| Phone (display, any format) | +९१ २२ २३५६ ६८९० *(placeholder — replace with school’s real number)* |
| Phone (E.164 for `tel:` links, e.g. +91…) | +912223566890 *(placeholder — must match real number)* |
| General / office email | info@vainateya.edu *(placeholder — replace when mailboxes exist)* |
| Admissions email | admissions@vainateya.edu *(placeholder — replace when mailboxes exist)* |
| Public website URL (when live) | *(unset in repo — set `VITE_SCHOOL_WEBSITE_URL` after deploy)* |
| Google Maps embed URL | `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3748.7!2d74.1000!3d20.0800!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bdcff6b9c59cf03%3A0x3e2f2f68d5c1c3d1!2sNiphad%2C%20Maharashtra!5e0!3m2!1sen!2sin!4v1712573200000!5m2!1sen!2sin` *(approximate — replace with exact campus embed when known)* |
| Google Maps external link | `https://maps.google.com/?q=Niphad+Nashik+Maharashtra` *(refine to exact pin when known)* |
| Copyright year (display) | २०२६ (`VITE_SCHOOL_COPYRIGHT_YEAR_MR`) |

---

## Authentication

- [ ] Confirm whether optional `role` on login should remain enforced.
- [ ] Password reset / invite flows: not in current app — needed? (Y/N + notes)
- [ ] Any roles missing or to be renamed?

## Teacher flows

- [ ] Enrollment: expected fields and who may enroll.
- [ ] Homework lifecycle: create → student sees → submit/status — confirm.
- [ ] Attendance: who can view; date/class rules.
- [ ] Meetings: who creates; parent/student visibility rules.

## Parent / student flows

- [ ] Which scores/homework/events are scoped by student or class?
- [ ] Instructions: who authors; audience.

## Admin

- [ ] Dashboard metrics definition.
- [ ] Enquiry handling: workflow (new → read → responded).

## Enquiries (public)

- [ ] Confirm `POST /api/enquiry` fields are sufficient vs admissions form (extra fields only in `message` body text is OK?).

## Report cards / quizzes

- [ ] Confirm who generates report cards and when.
- [ ] Quiz retakes / visibility.

---

## Notes / global corrections

- **Env vs this table:** Production values should match this table via `VITE_SCHOOL_*`. Backend enquiry notifications use `SCHOOL_EMAIL` / `MAIL_USER` (see `CURRENT_SYSTEM_BEHAVIOR.md` §2) — align those with “General / office email” or a dedicated inbox when SMTP is configured.
- **`VITE_SCHOOL_SHORT_NAME_MR`:** Example env was aligned to the compact navbar default `वैनतेय` (same as `school.ts` fallback). Use a longer string in env only if the UI should show it.
