const test=require('node:test'),assert=require('node:assert/strict');
const {canUnlock,prune,cyclic}=require('../skills/graph.js');
const graph={nodes:[{id:'a'},{id:'b'},{id:'c',requirement_mode:'all'},{id:'d',requirement_mode:'any'}],edges:[{from:'a',to:'c'},{from:'b',to:'c'},{from:'a',to:'d'},{from:'b',to:'d'}]};
test('all prerequisites and alternative paths',()=>{assert.equal(canUnlock(graph,'a',new Set()),true);assert.equal(canUnlock(graph,'c',new Set(['a'])),false);assert.equal(canUnlock(graph,'c',new Set(['a','b'])),true);assert.equal(canUnlock(graph,'d',new Set(['b'])),true);});
test('removal prunes dependents while retaining alternate routes',()=>{assert.deepEqual([...prune(graph,new Set(['b','c','d','missing']))],['b','d']);assert.deepEqual([...prune(graph,new Set(['c','d']))],[]);});
test('cycles rejected while independent branches remain valid',()=>{assert.equal(cyclic(graph,'c','a'),true);assert.equal(cyclic(graph,'c','d'),false);});
