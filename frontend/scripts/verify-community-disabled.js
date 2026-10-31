const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const flag = read('src/communityFeature.ts');
assert.match(flag, /export const COMMUNITY_ENABLED = false;/);

const routes = [
  ['app/(tabs)/feed.tsx', 'Feed', 'FeedContent'],
  ['app/new-post.tsx', 'NewPost', 'NewPostContent'],
  ['app/post/[id].tsx', 'PostDetail', 'PostDetailContent'],
  ['app/community-guidelines.tsx', 'CommunityGuidelines', 'CommunityGuidelinesContent'],
];

for (const [file, routeComponent, contentComponent] of routes) {
  const source = read(file);
  const routeGate = new RegExp(
    `export default function ${routeComponent}\\(\\) \\{\\s*if \\(!COMMUNITY_ENABLED\\) return <Redirect href="\\/\\(tabs\\)" \\/>;\\s*return <${contentComponent} \\/>;\\s*\\}`,
  );
  assert.match(source, routeGate, `${file} must redirect before mounting its preserved screen`);
}

assert.match(read('app/(tabs)/_layout.tsx'), /href: COMMUNITY_ENABLED \? undefined : null/);
assert.match(read('app/(tabs)/index.tsx'), /\{COMMUNITY_ENABLED \? \([\s\S]*?testID="share-community"/);
assert.match(read('app/(tabs)/profile.tsx'), /\{COMMUNITY_ENABLED \? \([\s\S]*?router\.push\('\/community-guidelines'\)/);
assert.match(read('app/(tabs)/feed.tsx'), /api\('\/api\/posts'\)/);
assert.match(read('app/new-post.tsx'), /fetch\(`\$\{BACKEND\}\/api\/upload`/);
assert.match(read('app/post/[id].tsx'), /api\(`\/api\/posts\/\$\{id\}\/comments`\)/);

console.log('Community disabled: navigation, direct routes, and screens that issue Community API requests are gated.');
