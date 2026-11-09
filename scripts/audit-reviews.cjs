const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const dbPath = path.resolve('backend/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/f5e02529f21b19fba143658ea5e633f183c3c0ac4411630dd48bc4be67345401.sqlite');
if (!fs.existsSync(dbPath)) {
  console.log('Database file does not exist at:', dbPath);
  process.exit(0);
}

const db = new DatabaseSync(dbPath);

console.log('Auditing reviews in local database...');

// 1. Participant mismatch
const participantMismatch = db.prepare(`
  SELECT r.id, r.interaction_id, r.author_id, r.target_id, i.owner_id, i.worker_id, 'participant_mismatch' AS issue
  FROM reviews r
  JOIN interactions i ON i.id = r.interaction_id
  WHERE i.kind = 'job' AND NOT (
    (r.author_id = i.owner_id AND r.target_id = i.worker_id) OR
    (r.author_id = i.worker_id AND r.target_id = i.owner_id)
  )
`).all();
console.log('Participant mismatch count:', participantMismatch.length);
if (participantMismatch.length) console.log(participantMismatch);

// 2. Wrong work type
const wrongWorkType = db.prepare(`
  SELECT r.id, r.interaction_id, i.kind, 'wrong_work_type' AS issue
  FROM reviews r
  JOIN interactions i ON i.id = r.interaction_id
  WHERE i.kind != 'job'
`).all();
console.log('Wrong work type count:', wrongWorkType.length);
if (wrongWorkType.length) console.log(wrongWorkType);

// 3. Duplicate reviews for same interaction and author
const duplicateReviews = db.prepare(`
  SELECT interaction_id, author_id, COUNT(*) AS count
  FROM reviews
  GROUP BY interaction_id, author_id
  HAVING COUNT(*) > 1
`).all();
console.log('Duplicate reviews count:', duplicateReviews.length);
if (duplicateReviews.length) console.log(duplicateReviews);

// 4. Non-completed interaction or missing confirmations
const incompleteInteraction = db.prepare(`
  SELECT r.id, r.interaction_id, i.status, i.owner_confirmed_at, i.worker_confirmed_at, 'incomplete_interaction' AS issue
  FROM reviews r
  JOIN interactions i ON i.id = r.interaction_id
  WHERE i.kind = 'job' AND (i.status != 'COMPLETED' OR i.owner_confirmed_at IS NULL OR i.worker_confirmed_at IS NULL)
`).all();
console.log('Incomplete interactions with reviews count:', incompleteInteraction.length);
if (incompleteInteraction.length) console.log(incompleteInteraction);

// 5. Self review
const selfReviews = db.prepare(`
  SELECT r.id, r.interaction_id, r.author_id, r.target_id, 'self_review' AS issue
  FROM reviews r
  WHERE r.author_id = r.target_id
`).all();
console.log('Self reviews count:', selfReviews.length);
if (selfReviews.length) console.log(selfReviews);

// 6. Total reviews summary
const totalReviews = db.prepare(`SELECT COUNT(*) as total FROM reviews`).get();
console.log('Total reviews in local DB:', totalReviews);
