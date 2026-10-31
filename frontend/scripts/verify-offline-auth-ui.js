const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
assert.match(read('src/offlineMode.ts'), /export const OFFLINE_ONLY_MODE = true;/);

const profile = read('app/(tabs)/profile.tsx');
assert.match(profile, /if \(OFFLINE_ONLY_MODE \|\| !user\) \{/);
assert.match(profile, /\{!OFFLINE_ONLY_MODE \? \([\s\S]*?testID="edit-profile"/);
assert.match(profile, /\{!OFFLINE_ONLY_MODE \? \([\s\S]*?testID="logout-btn"/);
assert.match(profile, /\{!OFFLINE_ONLY_MODE \? \([\s\S]*?testID="delete-account-btn"/);
assert.doesNotMatch(profile, /testID="profile-login-btn"/);
assert.match(profile, /router\.push\('\/privacy'\)/);
assert.match(profile, /router\.push\('\/terms'\)/);
assert.match(profile, /LANGS\.map/);

const login = read('app/login.tsx');
assert.match(login, /if \(!OFFLINE_ONLY_MODE\) WebBrowser\.maybeCompleteAuthSession\(\);/);
assert.match(login, /export default function Login\(\) \{\s*if \(OFFLINE_ONLY_MODE\) return <Redirect href="\/\(tabs\)" \/>;\s*return <LoginContent \/>;\s*\}/);
assert.match(login, /const onLogin = async \(\) => \{\s*if \(OFFLINE_ONLY_MODE\) return;/);
assert.match(login, /https:\/\/auth\.emergentagent\.com/);

const accountDeletion = read('app/account-deletion.tsx');
assert.match(accountDeletion, /export default function AccountDeletion\(\) \{\s*if \(OFFLINE_ONLY_MODE\) return <Redirect href="\/\(tabs\)" \/>;\s*return <AccountDeletionContent \/>;\s*\}/);
assert.match(accountDeletion, /await deleteAccount\(\)/);

const auth = read('src/auth.tsx');
assert.match(auth, /signInWithSessionId/);
assert.match(auth, /deleteAccount/);

console.log('Offline auth UI checks passed: account actions are hidden and direct login/account-deletion routes redirect; Auth code is preserved.');
