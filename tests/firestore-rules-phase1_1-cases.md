# Firestore Rules Phase 1.1 Emulator Cases

These are the runnable cases to execute with Firebase Emulator before a controlled pilot.

Prerequisite:

```bash
npm install --save-dev firebase-tools @firebase/rules-unit-testing
npx firebase emulators:start --only firestore,storage
```

Use `@firebase/rules-unit-testing` with `firestore.rules` and assert these cases:

## User Profile Creation

- PASS: signed-in user `uid=user1` creates `users/user1` with:
  - `uid: "user1"`
  - `role: "annotator"`
  - `status: "pending"`
  - `annotator_code: ""`
  - `training_completed: false`
  - `confidentiality_agreement: false`
  - `email_verified` equal to `request.auth.token.email_verified`
- FAIL: unauthenticated user creates any `users/{uid}`.
- FAIL: `user1` creates `users/user2`.
- FAIL: `user1` creates self profile with `role: "admin"`.
- FAIL: `user1` creates self profile with `role: "supervisor"`.
- FAIL: `user1` creates self profile with `role: "reviewer"`.
- FAIL: `user1` creates self profile with `status: "active"`.
- FAIL: `user1` creates self profile with `annotator_code: "ANN001"`.
- FAIL: `user1` creates self profile with `training_completed: true`.
- FAIL: `user1` creates self profile with `confidentiality_agreement: true`.

## User Profile Read/Update

- PASS: signed-in `user1` reads `users/user1` while pending.
- FAIL: signed-in `user1` reads `users/user2`.
- PASS: `user1` updates only `last_login`, `updated_at`, `email`, or `email_verified`.
- FAIL: `user1` updates own `role`.
- FAIL: `user1` updates own `status`.
- FAIL: `user1` updates own `annotator_code`.
- FAIL: `user1` updates own `training_completed`.
- FAIL: `user1` updates own `confidentiality_agreement`.

## Protected Annotation Data

- FAIL: pending user reads/writes `video_registry`.
- FAIL: suspended user reads/writes `video_registry`.
- FAIL: active but unverified user reads/writes `video_registry`.
- FAIL: active but `training_completed: false` user reads/writes `video_registry`.
- FAIL: active but `confidentiality_agreement: false` user reads/writes `video_registry`.
- PASS: active approved user creates own draft `annotation_sessions/{sessionId}` with `annotator_uid == auth.uid`.
- FAIL: active approved user creates a session for another `annotator_uid`.
- FAIL: active approved user edits a submitted/reviewed/locked session as annotator.
- PASS: active approved annotator writes segments only when parent session is `draft`.

## Supervisor/Admin

- PASS: auth token with `supervisor: true` reads pending users.
- PASS: auth token with `supervisor: true` updates user approval fields.
- PASS: auth token with `admin: true` deletes users.
- FAIL: Firestore profile field `role: "admin"` without matching custom claim performs supervisor/admin-only writes.

## Storage

- FAIL: any user reads any Storage path.
- FAIL: any user writes any Storage path.
