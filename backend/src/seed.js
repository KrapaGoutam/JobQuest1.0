import { openDatabase, migrate } from "./db.js";
import { hashPassword } from "./security.js";

const username = process.env.MANAGER_USERNAME;
const password = process.env.MANAGER_PASSWORD;
const fullName = process.env.MANAGER_FULL_NAME || "JobQuest Manager";
if (!username || !password || password.length < 10) {
  console.error("Set MANAGER_USERNAME and MANAGER_PASSWORD (at least 10 characters).");
  process.exit(1);
}
const db = openDatabase();
migrate(db);
db.prepare("INSERT INTO users(username,full_name,password_hash,role) VALUES (?,?,?,'MANAGER') ON CONFLICT(username) DO UPDATE SET full_name=excluded.full_name,password_hash=excluded.password_hash,role='MANAGER',is_active=1").run(username, fullName, hashPassword(password));
console.log(`Manager ${username} is ready.`);
db.close();
