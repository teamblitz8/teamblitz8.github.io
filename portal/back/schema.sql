DROP TABLE IF EXISTS cars;
DROP TABLE IF EXISTS sessiontokens;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS ipbans;

CREATE TABLE IF NOT EXISTS users (
    userid TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    profile_file_path TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    last_login TEXT,
    active INTEGER NOT NULL,
    iterations INTEGER
);
CREATE TABLE IF NOT EXISTS cars (
    creatorid TEXT,
    scrutineerid TEXT,
    carid TEXT PRIMARY KEY,
    iteration INTEGER,
    date_created TEXT NOT NULL,
    frontal_area REAL NOT NULL,
    drag_coefficient REAL NOT NULL,
    drag_force REAL NOT NULL,
    car_model_file_path TEXT NOT NULL,
    iso_surfaces_file_path TEXT NOT NULL,
    planes_file_path TEXT NOT NULL,
    changelog TEXT NOT NULL,
    additional_notes TEXT,
    FOREIGN KEY(creatorid) REFERENCES users(userid),
    FOREIGN KEY(scrutineerid) REFERENCES users(userid)
);
CREATE TABLE IF NOT EXISTS ipbans (
    ip TEXT PRIMARY KEY,
    date_banned TEXT
);
CREATE TABLE IF NOT EXISTS sessiontokens (
    session_token_hash TEXT PRIMARY KEY,
    session_token_salt TEXT,
    userid TEXT NOT NULL,
    expiration_date TEXT NOT NULL,
    FOREIGN KEY(userid) REFERENCES users(userid) ON DELETE CASCADE
);