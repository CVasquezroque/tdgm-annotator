# Firestore Rules Phase 2 Cases

Run these with Firebase Emulator before a broader pilot. They complement `tests/firestore-rules-phase1_1-cases.md`.

## Sessions

- PASS: active approved annotator creates `annotation_sessions/{sessionId}` where `annotator_uid == auth.uid` and `status == "draft"`.
- FAIL: annotator creates a session for another `annotator_uid`.
- PASS: session owner updates a `draft` session metadata and submits it with `status == "submitted"`.
- PASS: session owner updates a `returned` session.
- FAIL: session owner updates a `submitted`, `reviewed`, or `locked` session.
- FAIL: session owner changes `video_code`, `annotator_uid`, or `annotator_code`.
- PASS: reviewer/supervisor/admin reads submitted/reviewed/returned/locked sessions.
- PASS: reviewer sets status to `reviewed`, `returned`, or `locked`.
- FAIL: reviewer changes `video_code`, `annotator_uid`, or `annotator_code`.

## Segments

- PASS: owner creates/updates/deletes segment under own `draft` session.
- PASS: owner creates/updates/deletes segment under own `returned` session.
- FAIL: owner writes segment under `submitted`, `reviewed`, or `locked` session.
- FAIL: another annotator writes segment under someone else's session.
- PASS: reviewer updates action, times, repetition, or notes of an existing segment under a `submitted` session.
- PASS: reviewer updates only notes of an existing segment from `Ver`, regardless of session status.
- FAIL: reviewer changes action, times, or repetition outside a `submitted` session.
- FAIL: reviewer creates or deletes a segment or changes segment identity.
- PASS: admin deletes nested segments and flat `annotation_segments` while deleting a complete annotation session.
- PASS: admin deletes a complete annotation session in `draft`, `submitted`, `reviewed`, `returned`, or `locked`.
- FAIL: reviewer or supervisor deletes segments from another annotator's session.
- FAIL: segment payload contains extra keys such as `file_path`, `fileName`, `local_path`, `sizeBytes`, or `lastModified`.

## Review Events

- PASS: reviewer/supervisor/admin creates review event for `reviewed`, `returned`, `locked`, or `unlocked`.
- FAIL: annotator creates review event.
- FAIL: review event actor UID differs from `request.auth.uid`.
- FAIL: review event contains extra keys.
- PASS: admin deletes review events as part of deleting a complete annotation session.
- FAIL: reviewer or supervisor deletes review events.

## Video Registry

- PASS: active approved user creates minimal `video_registry/{video_code}` with only safe metadata.
- FAIL: payload includes raw filename/path/size/lastModified.
- PASS: another active approved user reads existing video registry metadata.
- FAIL: non-supervisor updates video registry metadata.

## Users

- PASS: supervisor/admin profile role can approve/suspend users.
- PASS: admin deletes another user's Firestore profile.
- FAIL: supervisor deletes a user profile.
- FAIL: annotator changes own role/status/annotator_code/training/confidentiality.
