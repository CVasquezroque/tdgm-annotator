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

const exportsSource = read('src/services/exports.ts')
assert(exportsSource.includes('buildSessionExport'), 'exports.ts should expose JSON payload builder')
assert(exportsSource.includes('buildAnnotationsCsv'), 'exports.ts should expose CSV builder')
assertNotIncludes(exportsSource, ['file_path', 'filePath', 'fileName', 'displayName', 'lastModified', 'sizeBytes'], 'exports.ts')

const sensitiveFilename = 'Juan Perez Colegio San Marcos correr.mp4'
const exportFixture = {
  schema_version: '1.0',
  project: 'DIANA',
  video: {
    video_code: 'DIANA-VID-001',
    duration_sec: 32.4,
    source: 'local',
  },
  annotation_session: {
    session_id: 'session_test',
    annotator_uid: 'uid_test',
    annotator_code: 'ANN001',
    created_at: '2026-05-25T00:00:00.000Z',
    updated_at: '2026-05-25T00:05:00.000Z',
    app_version: '0.0.0',
  },
  segments: [
    {
      id: 'seg001',
      action: 'run',
      start_sec: 3.25,
      end_sec: 6.8,
      repetition_id: '1',
      notes: '',
    },
  ],
}

const jsonExport = JSON.stringify(exportFixture)
const csvExport = [
  'project,schema_version,session_id,video_code,action,start_sec,end_sec,repetition_id,annotator_code,notes,app_version',
  'DIANA,1.0,session_test,DIANA-VID-001,run,3.25,6.8,1,ANN001,,0.0.0',
].join('\n')

for (const output of [jsonExport, csvExport]) {
  assertNotIncludes(
    output,
    ['Juan', 'Perez', 'Colegio', 'San Marcos', sensitiveFilename, '.mp4', 'file_path', 'C:\\', '/Users/'],
    'export output',
  )
}

const driveHook = read('src/hooks/useGoogleDrivePicker.ts')
assert(driveHook.includes('deshabilitada'), 'Drive hook should be explicitly disabled')
assertNotIncludes(driveHook, ['fetch(', 'alt=media', 'response.blob', 'requestAccessToken', 'PickerBuilder'], 'Drive hook')

const firebaseSource = read('src/firebase.ts')
assertNotIncludes(firebaseSource, ['getStorage', 'firebase/storage', 'uploadBytes'], 'firebase.ts')

const storageRules = read('storage.rules')
assert(storageRules.includes('allow read, write: if false'), 'storage.rules must deny all reads/writes')

const firestoreRules = read('firestore.rules')
const requiredRuleSnippets = [
  'request.auth.uid == uid',
  'request.resource.data.role == "annotator"',
  'request.resource.data.status == "pending"',
  'request.resource.data.annotator_code == ""',
  'request.resource.data.training_completed == false',
  'request.resource.data.confidentiality_agreement == false',
  'request.resource.data.email_verified == request.auth.token.email_verified',
  '"full_name", "institution", "last_login", "updated_at"',
]

for (const snippet of requiredRuleSnippets) {
  assert(firestoreRules.includes(snippet), `firestore.rules missing hardening snippet: ${snippet}`)
}

if (failures.length > 0) {
  console.error('Phase 1.1 validation failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Phase 1.1 validation passed.')
