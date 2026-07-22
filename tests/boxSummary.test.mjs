import test from 'node:test'; import assert from 'node:assert/strict';
import { toBoxSummary } from '../utils/boxSummary.js';
test('box summaries never include prize arrays or admin metadata', () => {
 const summary = toBoxSummary('a', { name:'A', price:10, items:[{secret:1}], prizes:[{secret:2}], marketValueAudit:{x:1}, internalNote:'no' });
 assert.deepEqual(Object.keys(summary).sort(), ['accentColor','currencyType','id','image','isDaily','isPullPassBox','name','price'].sort());
 assert.equal('items' in summary, false); assert.equal('prizes' in summary, false); assert.equal('marketValueAudit' in summary, false);
});
