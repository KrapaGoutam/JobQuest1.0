import { openDatabase, migrate } from "./db.js";
import { hashPassword } from "./security.js";

const username = process.env.MANAGER_USERNAME;
const pin = process.env.MANAGER_PIN;
const fullName = process.env.MANAGER_FULL_NAME || "JobQuest Manager";
if (!username || !/^\d{4}$/.test(pin || "")) {
  console.error("Set MANAGER_USERNAME and MANAGER_PIN (exactly four digits).");
  process.exit(1);
}
const db = openDatabase();
migrate(db);
const hash = hashPassword(pin);
db.prepare("INSERT INTO users(username,full_name,password_hash,pin_hash,auth_method,role) VALUES (?,?,?,?, 'pin','MANAGER') ON CONFLICT(username) DO UPDATE SET full_name=excluded.full_name,pin_hash=excluded.pin_hash,auth_method='pin',role='MANAGER',is_active=1").run(username, fullName, hash, hash);
console.log(`Manager ${username} is ready.`);
db.close();
