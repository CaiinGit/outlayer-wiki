const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {readCatalog, escapeHTML} = require('../catalog.js');
const source = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/codex.json'), 'utf8'));
const clone = () => structuredClone(source);
test('campaign progress, images and accent-insensitive index', () => {
  const entries = readCatalog(source);
  assert.equal(entries.length, 7);
  assert.deepEqual(entries.filter(e=>e.status==='known').map(e=>e.title), ['Le Noyau']);
  for (const entry of entries) if(entry.image) assert.ok(fs.existsSync(path.join(__dirname, '..', entry.image)));
  assert.match(entries[0].searchText, /geographie/);
});
test('rejects identities, descriptions, tags and images in unknown records', () => {
  for (const patch of [{name:'Secret'}, {description:'Secret'}, {details:['Secret']}, {tags:['Secret']}, {image:'assets/private.png'}]) {
    const data = clone(); Object.assign(data.entries[1], patch);
    assert.throws(()=>readCatalog(data), /anonyme/);
  }
});
test('unique IDs, supported categories and explicit boolean states', () => {
  for (const patch of [{id:'noyau'}, {type:'bad'}, {known:'false'}, {visible:'false'}, {id:'<x>'}]) {
    const data = clone(); Object.assign(data.entries[1], patch); assert.throws(()=>readCatalog(data));
  }
});
test('rejects remote, executable and traversal image paths', () => {
  for (const image of ['javascript:alert(1)', 'https://host/image.png', 'assets/../private.png', 'assets/x.svg" onload="alert(1)']) {
    const data = clone(); data.entries[0].image = image; assert.throws(()=>readCatalog(data), /Image/);
  }
});
test('hidden entries leave search and progress; missing images are allowed', () => {
  const data = clone(); data.entries[0].visible = false;
  assert.ok(!readCatalog(data).some(e=>e.id==='noyau'));
  data.entries[0].visible = true; data.entries[0].image = null;
  assert.equal(readCatalog(data)[0].image, null);
});
test('escapes HTML delimiters in editable text', () => {
  assert.equal(escapeHTML('<img src="x" onerror=\'x\'>&'), '&lt;img src=&quot;x&quot; onerror=&#39;x&#39;&gt;&amp;');
});
test('sealed cards accept only derived teaser URLs, never the private original', () => {
  const data=clone(); data.entries[1].image='/api/teasers/'+'a'.repeat(32);
  assert.equal(readCatalog(data)[1].image,data.entries[1].image);
  data.entries[1].image='/api/images/'+'a'.repeat(32);
  assert.throws(()=>readCatalog(data), /anonyme/);
});
