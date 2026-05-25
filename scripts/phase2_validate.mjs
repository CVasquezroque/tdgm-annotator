import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')
const failures = []

function assert(condition, message) {
  if (!condition) failures.push(message)
}

function assertNotIncludes(text, forbidden, label) {
  for (const value of forbidden) {
    assert(!text.includes(value), `${label} must not include ${value}`)
  }
}

const app = read('src/App.tsx')
const sessionService = read('src/services/annotationSessions.ts')
const sessionHook = read('src/hooks/useAnnotationSession.ts')
const exportsSource = read('src/services/exports.ts')
const rules = read('firestore.rules')
const driveHook = read('src/hooks/useGoogleDrivePicker.ts')
const firebaseSource = read('src/firebase.ts')

assert(sessionService.includes('getOrCreateAnnotationSession'), 'Phase 2 session service missing get/create')
assert(sessionService.includes('saveSessionSegments'), 'Phase 2 session service missing segment save')
assert(sessionService.includes('submitSession'), 'Phase 2 session service missing submit')
assert(sessionService.includes('setSessionReviewStatus'), 'Phase 2 session service missing review status changes')
assert(sessionHook.includes('localStorage'), 'Phase 2 local draft backup missing')
assert(sessionHook.includes('2000'), 'Autosave debounce should be around 1.5-3s')
assert(app.includes('AutosaveStatus'), 'App missing autosave status UI')
assert(app.includes('MySessionsPanel'), 'App missing my sessions panel')
assert(app.includes('ReviewerSessionsPanel'), 'App missing reviewer panel')
assert(app.includes('AdminUsersPanel'), 'App missing admin users panel')
assert(app.includes('ExportPanel'), 'App missing export panel')
assert(!app.includes('Confirmar codigo'), 'Video code confirmation button should not remain in App UI')
assert(!app.includes('Sin sesion'), 'App should not expose technical no-session state')
assert(!app.includes('VideoCodeForm'), 'Video code form should not remain in the annotator workflow')
assert(app.includes('codedFilenameFromFile'), 'App should use the coded local filename for traceability')

for (const status of ['draft', 'submitted', 'reviewed', 'returned', 'locked']) {
  assert(rules.includes(`"${status}"`), `firestore.rules missing session status ${status}`)
}

for (const forbidden of ['displayName', 'fileName', 'filePath', 'file_path', 'lastModified', 'sizeBytes']) {
  assertNotIncludes(exportsSource, [forbidden], 'exports.ts')
  assertNotIncludes(sessionService, [forbidden], 'annotationSessions.ts')
}

assertNotIncludes(driveHook, ['fetch(', 'alt=media', 'response.blob', 'requestAccessToken', 'PickerBuilder'], 'Drive hook')
assertNotIncludes(firebaseSource, ['getStorage', 'firebase/storage', 'uploadBytes'], 'firebase.ts')
assert(rules.includes('parentSession().status in ["draft", "returned"]'), 'segments must only write under draft/returned sessions')
assert(rules.includes('validOwnerStatusTransition'), 'owners should only submit or preserve editable statuses')
assert(rules.includes('request.resource.data.status in ["reviewed", "returned", "locked"]'), 'reviewers should only set review statuses')
assert(rules.includes('isSafeVideoCode'), 'firestore.rules should validate safe video_code shape')
assert(rules.includes('!exists(/databases/$(database)/documents/annotation_sessions/$(sessionId))'), 'session get should allow checking missing docs before create')
assert(rules.includes('match /annotation_segments/{segmentDocId}'), 'firestore.rules should protect unified annotation_segments')
assert(sessionService.includes('UNIFIED_SEGMENTS'), 'annotationSessions.ts should write unified annotation_segments')
assert(sessionService.includes('video_filename'), 'annotationSessions.ts should persist coded video filename')

if (failures.length > 0) {
  console.error('Phase 2 validation failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Phase 2 validation passed.')
