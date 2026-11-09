-- Let each participant remove completed job history from their own view while
-- retaining the shared completion and review records.
CREATE TABLE user_hidden_job_history (
  user_id TEXT NOT NULL REFERENCES users(id),
  job_id TEXT NOT NULL REFERENCES jobs(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, job_id)
);

CREATE TABLE user_hidden_interaction_history (
  user_id TEXT NOT NULL REFERENCES users(id),
  interaction_id TEXT NOT NULL REFERENCES interactions(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, interaction_id)
);
