const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { JSDOM } = require('jsdom');
const html = readFileSync('index.html', 'utf8');

function app(saved = {}) {
  const dom = new JSDOM(html, { url: 'http://localhost', runScripts: 'dangerously', beforeParse(w) {
    for (const [key, value] of Object.entries(saved)) w.localStorage.setItem(key, value);
    w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (_, name) => name === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {} });
    w.confirm = () => true;
    w.HTMLDialogElement.prototype.close = function() { this.removeAttribute('open'); };
    w.HTMLDialogElement.prototype.showModal = function() { this.setAttribute('open', ''); };
  } });
  return dom;
}

test('legacy measurements survive profile creation, switching, edits and reload', () => {
  const dom = app({ randy_body_tracker_v1: '[{"date":"2026-10-01","weight":72}]' });
  const w = dom.window;
  const d = w.document;
  assert.ok(d.querySelector('#profile-list button'), 'profile buttons are available');
  d.querySelector('#profile-name').value = 'Alex';
  w.createProfile();
  assert.match(d.querySelector('#summary-grid').textContent, /No measurements yet/);
  d.querySelector('#f-date').value = '2026-10-01';
  d.querySelector('#f-weight').value = '85';
  w.saveEntry();
  w.switchProfile('randy');
  assert.match(d.querySelector('#summary-grid').textContent, /72/);
  const alex = d.querySelector('[aria-label="Switch to Alex"]').dataset.profileId;
  w.switchProfile(alex);
  w.openEditModal('2026-10-01');
  d.querySelector('#e-weight').value = '84';
  w.saveEditModal();
  const saved = Object.fromEntries(Object.keys(w.localStorage).map(k => [k, w.localStorage.getItem(k)]));
  const reloaded = app(saved);
  assert.match(reloaded.window.document.querySelector('#profile-context').textContent, /Alex/);
  assert.match(reloaded.window.document.querySelector('#summary-grid').textContent, /84/);
  reloaded.window.deleteEntry('2026-10-01');
  assert.match(reloaded.window.document.querySelector('#history-tbody').textContent, /No entries/);
  reloaded.window.switchProfile('randy');
  assert.match(reloaded.window.document.querySelector('#summary-grid').textContent, /72/);
  dom.window.close();
  reloaded.window.close();
});

test('an empty legacy tracker stays empty and invalid names do not create profiles', () => {
  const dom = app({ randy_body_tracker_v1: '[]' });
  const w = dom.window;
  assert.ok(w.document.querySelector('#profile-list button'), 'profile buttons are available');
  assert.match(w.document.querySelector('#summary-grid').textContent, /No measurements yet/);
  for (const name of [' ', ' rAnDy ']) {
    w.document.querySelector('#profile-name').value = name;
    w.createProfile();
    assert.equal(w.document.querySelectorAll('#profile-list button').length, 1);
  }
  dom.window.close();
});

test('a pending CSV import stays with its original profile after switching', () => {
  const dom = app();
  const w = dom.window;
  w.document.querySelector('#profile-name').value = 'Alex';
  w.createProfile();
  let reader;
  w.FileReader = class { constructor() { reader = this; } readAsText() {} };
  w.importCSV({ target: { files: [{}], value: 'measurements.csv' } });
  w.switchProfile('randy');
  reader.onload({ target: { result: 'date,weight\n2026-10-02,90' } });
  assert.match(w.document.querySelector('#summary-grid').textContent, /67.1/);
  assert.doesNotMatch(w.document.querySelector('#summary-grid').textContent, /90/);
  const alex = w.document.querySelector('[aria-label="Switch to Alex"]').dataset.profileId;
  w.switchProfile(alex);
  assert.match(w.document.querySelector('#summary-grid').textContent, /90/);
  let csv;
  w.Blob = class { constructor(parts) { csv = parts.join(''); } };
  w.URL.createObjectURL = () => 'blob:test';
  w.URL.revokeObjectURL = () => {};
  let filename;
  w.HTMLAnchorElement.prototype.click = function() { filename = this.download; };
  w.exportCSV();
  assert.equal(filename, 'alex_body_tracker.csv');
  assert.match(csv, /2026-10-02,90/);
  assert.doesNotMatch(csv, /67.1/);
  dom.window.close();
});

test('avatar buttons use initials and switch the selected profile', () => {
  const dom = app();
  const w = dom.window;
  w.document.querySelector('#profile-name').value = 'Alex Morgan';
  w.createProfile();
  const alex = w.document.querySelector('[aria-label="Switch to Alex Morgan"]');
  assert.ok(alex, 'named avatar button exists');
  assert.equal(alex.querySelector('.profile-avatar').textContent, 'AM');
  assert.equal(alex.getAttribute('aria-pressed'), 'true');
  w.document.querySelector('[aria-label="Switch to Randy"]').click();
  assert.match(w.document.querySelector('#profile-context').textContent, /Randy/);
  assert.equal(w.document.querySelector('[aria-label="Switch to Randy"]').getAttribute('aria-pressed'), 'true');
  dom.window.close();
});

test('profile removal can be cancelled, persists, and protects the last profile', () => {
  const dom = app();
  const w = dom.window;
  w.document.querySelector('#profile-name').value = 'Alex';
  w.createProfile();
  w.confirm = () => false;
  assert.equal(typeof w.removeProfile, 'function', 'profile removal is available');
  w.removeProfile();
  assert.match(w.document.querySelector('#profile-context').textContent, /Alex/);
  w.confirm = () => true;
  w.removeProfile();
  assert.match(w.document.querySelector('#profile-context').textContent, /Randy/);
  assert.equal(w.document.querySelectorAll('#profile-list button').length, 1);
  assert.equal(w.document.querySelector('#remove-profile').disabled, true);
  w.removeProfile();
  const saved = JSON.parse(w.localStorage.getItem('body_tracker_profiles_v1'));
  assert.equal(saved.profiles.length, 1);
  assert.equal(saved.profiles[0].name, 'Randy');
  assert.equal(saved.profiles[0].entries[0].weight, 67.1);
  dom.window.close();
});

test('failed removal retains the profile and a pending import cannot recreate a deleted profile', () => {
  const dom = app();
  const w = dom.window;
  w.document.querySelector('#profile-name').value = 'Alex';
  w.createProfile();
  assert.equal(typeof w.removeProfile, 'function', 'profile removal is available');
  const setItem = w.Storage.prototype.setItem;
  w.Storage.prototype.setItem = () => { throw new Error('Storage full'); };
  w.removeProfile();
  assert.match(w.document.querySelector('#profile-context').textContent, /Alex/);
  w.Storage.prototype.setItem = setItem;
  let reader;
  w.FileReader = class { constructor() { reader = this; } readAsText() {} };
  w.importCSV({ target: { files: [{}], value: 'measurements.csv' } });
  w.removeProfile();
  reader.onload({ target: { result: 'date,weight\n2026-10-02,90' } });
  assert.equal(w.document.querySelectorAll('#profile-list button').length, 1);
  assert.match(w.document.querySelector('#toast').textContent, /removed/);
  assert.doesNotMatch(w.document.querySelector('#summary-grid').textContent, /90/);
  dom.window.close();
});

test('failed storage writes preserve saved measurements and show an error', () => {
  const dom = app({ randy_body_tracker_v1: '[{"date":"2026-10-01","weight":72}]' });
  const w = dom.window;
  w.Storage.prototype.setItem = () => { throw new Error('Storage full'); };
  w.document.querySelector('#f-date').value = '2026-10-01';
  w.document.querySelector('#f-weight').value = '99';
  w.saveEntry();
  w.renderDashboard();
  assert.match(w.document.querySelector('#summary-grid').textContent, /72/);
  assert.equal(w.document.querySelector('#storage-error').hidden, false);
  assert.equal(w.localStorage.getItem('randy_body_tracker_v1'), '[{"date":"2026-10-01","weight":72}]');
  dom.window.close();
});
