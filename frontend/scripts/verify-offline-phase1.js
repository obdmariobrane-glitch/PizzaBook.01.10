const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
assert.match(read('src/offlineMode.ts'), /export const OFFLINE_ONLY_MODE = true;/);

const auth = read('src/auth.tsx');
assert.match(auth, /if \(OFFLINE_ONLY_MODE\) \{\s*setLoading\(false\);\s*return;\s*\}\s*\(async \(\) => \{\s*const stored = await storage\.get\('session_token'\)/);
assert.match(auth, /const u = await api\('\/api\/me'\)/);

const layout = read('app/_layout.tsx');
assert.match(layout, /if \(OFFLINE_ONLY_MODE \|\| Platform\.OS === 'web'\) return;[\s\S]{0,500}api\('\/api\/app-update'\)/);
assert.match(layout, /\/\/ Handle deep links w\/ session_id\s*useEffect\(\(\) => \{\s*if \(OFFLINE_ONLY_MODE\) return;/);
assert.match(layout, /if \(OFFLINE_ONLY_MODE \|\| Platform\.OS === 'web' \|\| !isPushSupported\(\) \|\| !startupPermissionSettled\) return;[\s\S]{0,500}api\('\/api\/register-push'/);

const calculator = read('app/(tabs)/index.tsx');
const planner = read('app/(tabs)/planner.tsx');
const notifications = read('src/notifications.ts');
assert.match(calculator, /scheduleLocal\(NOTIF\.title/);
assert.match(calculator, /scheduleLocalAt\(copy\.title/);
assert.match(planner, /scheduleLocal\(`🍕 \$\{s\.title\}`/);
assert.match(notifications, /export async function scheduleLocal\(/);
assert.match(notifications, /export async function scheduleLocalAt\(/);

console.log('Offline phase 1 static checks passed: startup backend/auth gates are enabled and local notification scheduling remains wired.');
