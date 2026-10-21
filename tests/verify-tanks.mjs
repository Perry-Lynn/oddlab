import assert from 'node:assert/strict';
import { TANK_MAPS, SIZE, TILE, WAVES, createTankGame, startTankGame, pauseTankGame, nextTankLevel, stepTankGame, canTankOccupy, fireTank } from '../src/tanks-logic.mjs';
import { tankCopy, tankMetadata } from '../src/tanks-copy.mjs';
import { tankArcadeCard } from '../src/tanks-ui.mjs';
import worker from '../worker/index.js';
const play = () => {
  const state = createTankGame({seed:123});
  state.grid = Array.from({length:13},()=>Array(13).fill('.'));
  state.spawned=state.total; // Test isolated combat without new spawns.
  state.enemies=[enemy(400,16)];
  startTankGame(state);return state;
};
function enemy(x,y,type='scout') {
  return {id:20,team:'enemy',type,x,y,dir:'down',hp:type==='armor'?2:1,speed:0,cooldown:999,shield:0,turnTimer:999,tread:0};
}
function shot(state,{x,y,dx=0,dy=1,team='enemy',owner=99}) {
  state.bullets.push({id:state.nextId++,owner,team,x,y,dx,dy,speed:team==='player'?330:190,alive:true});
}
function ticks(state,n,input={}) {for(let i=0;i<n;i++)stepTankGame(state,input);return state;}
for(let level=0;level<3;level++){
  assert.equal(TANK_MAPS[level].length,13);
  assert.ok(TANK_MAPS[level].every(row=>row.length===13&&/^[.#S~]+$/.test(row)));
  const state=createTankGame({level});
  assert.equal(state.total,WAVES[level]);
  assert.equal(state.lives,3);
  assert.ok(canTankOccupy(state,state.player,state.player.x,state.player.y));
  for(const col of [0,6,12])assert.equal(state.grid[0][col],'.','enemy spawn has open ground');
}
assert.equal(new Set(TANK_MAPS.map(map=>map.join(''))).size,3,'three genuinely different maps');
const ready=createTankGame();ticks(ready,90,{dir:'up',fire:true});assert.equal(ready.time,0);assert.equal(ready.bullets.length,0);
{
  const state=play();state.grid[10][4]='#';
  ticks(state,90,{dir:'up'});
  assert.ok(state.player.y>=11*TILE+10.5,'movement cannot pass through a brick');
  assert.equal(canTankOccupy(state,state.player,-1,50),false);
  assert.equal(canTankOccupy(state,state.player,SIZE+1,50),false);
  assert.equal(canTankOccupy(state,state.player,state.base.x,state.base.y),false);
  const old={x:state.player.x,y:state.player.y,time:state.time};
  pauseTankGame(state);ticks(state,120,{dir:'right',fire:true});
  assert.deepEqual({x:state.player.x,y:state.player.y,time:state.time},old,'pause freezes simulation and input');
}
{
  const state=play();state.player.y=283;
  state.grid[9][5]='#';
  stepTankGame(state,{dir:'right'});
  assert.equal(state.player.y,272,'turning gently aligns to a lane instead of requiring pixel-perfect timing');
  assert.ok(state.player.x>144);
  assert.equal(fireTank(state,state.player),true);
  assert.equal(fireTank(state,state.player),false,'fire cooldown cannot be bypassed by repeated presses');
  state.player.cooldown=0;fireTank(state,state.player);
  state.player.cooldown=0;assert.equal(fireTank(state,state.player),false,'only two player shells can be active');
}
for(const tile of ['#','S','~']){
  const state=play();state.player.x=144;state.player.y=140;state.player.dir='up';state.grid[2][4]=tile;
  assert.equal(canTankOccupy(state,state.player,144,80),false,'all terrain types block tanks');
  fireTank(state,state.player);ticks(state,20);
  assert.equal(state.grid[2][4],tile==='#'?'.':tile);
  assert.equal(state.bullets.some(b=>b.team==='player'),tile==='~','water passes shots, brick/steel stop them');
}
{
  const state=play();state.player.x=144;state.player.y=80;state.player.dir='up';state.grid[1][4]='#';
  fireTank(state,state.player);ticks(state,4);
  assert.equal(state.grid[1][4],'.','an adjacent wall cannot be skipped by a muzzle spawn');
}
{
  const state=play();const tank=enemy(144,48,'armor');state.enemies=[tank];state.player.y=120;state.player.dir='up';
  fireTank(state,state.player);ticks(state,18);
  assert.equal(tank.hp,1);assert.equal(state.score,0,'armor needs two hits');
  state.player.cooldown=0;fireTank(state,state.player);ticks(state,18);
  assert.equal(state.kills,1);assert.equal(state.score,300);assert.equal(state.status,'clear');
  const score=state.score;ticks(state,100,{fire:true});assert.equal(state.score,score,'terminal combat is frozen');
}
{
  const state=play();state.player.shield=0;
  shot(state,{x:state.player.x,y:state.player.y-8});ticks(state,2);
  assert.equal(state.lives,2);assert.ok(state.player.shield>0);
  shot(state,{x:state.player.x,y:state.player.y-8});ticks(state,2);
  assert.equal(state.lives,2,'respawn shield prevents immediate repeated damage');
  for(let i=0;i<2;i++){state.player.shield=0;shot(state,{x:state.player.x,y:state.player.y-8});ticks(state,2);}
  assert.equal(state.status,'lost');assert.equal(state.reason,'lives');assert.equal(state.lives,0);
}
{
  const state=play();
  shot(state,{x:state.base.x,y:state.base.y-10,team:'player'});ticks(state,2);assert.equal(state.base.alive,true,'own shots never destroy the base');
  shot(state,{x:state.base.x,y:state.base.y-10});ticks(state,2);
  assert.equal(state.base.alive,false);assert.equal(state.status,'lost');assert.equal(state.reason,'base');
  assert.equal(nextTankLevel(state),null,'a loss cannot advance');
}
{
  const state=play();state.bullets=[];
  shot(state,{x:80,y:80,dx:1,dy:0,team:'player'});
  shot(state,{x:90,y:80,dx:-1,dy:0});
  ticks(state,2);assert.equal(state.bullets.length,0,'opposing shells cancel each other');
}
{
  const state=createTankGame({score:1200,lives:1});state.status='clear';
  const next=nextTankLevel(state);assert.equal(next.level,1);assert.equal(next.score,1200);assert.equal(next.lives,1);assert.equal(next.status,'ready');
  state.level=2;assert.equal(nextTankLevel(state),null,'the third map is the final stage');
}
{
  const first=startTankGame(createTankGame({seed:12345}));
  const second=startTankGame(createTankGame({seed:12345}));
  for(let i=0;i<1800;i++){
    const input={dir:['up','right','down','left'][Math.floor(i/100)%4],fire:true};
    stepTankGame(first,input);stepTankGame(second,input);
    assert.ok(first.enemies.length<=4);
    assert.ok(first.bullets.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.y)));
  }
  assert.deepEqual(first,second,'identical seed and inputs give identical combat');
}
for(const lang of ['zh','en','ja','es']){
  const c=tankCopy(lang);assert.equal(c.maps.length,3);assert.equal(c.rules.length,3);
  assert.ok(tankMetadata(lang).title);assert.ok(tankArcadeCard(lang,'/tanks/?lang='+lang).includes('/tanks/?lang='+lang));
  if(lang==='en'||lang==='es')assert.ok(!/[\u4e00-\u9fff]/.test(JSON.stringify(c)));
  const response=await worker.fetch(new Request('https://oddlab.example/tanks?lang='+lang));
  assert.equal(response.status,200);assert.ok((await response.text()).includes(c.title));
}
for(const file of ['tanks-logic.mjs','tanks-copy.mjs','tanks-ui.mjs']){
  const response=await worker.fetch(new Request('https://oddlab.example/'+file));
  assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/javascript/);
}
console.log('PASS: three tank maps, terrain/edge collision, swept shots, armor, scoring, shields, lives/base failure, pause, level carry, deterministic bounded waves, four-language copy and Worker routes.');
