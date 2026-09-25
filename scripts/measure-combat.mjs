import { chromium, webkit, devices } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
// Start Vite on 5174 first. These are browser emulations on the host, not physical phone results.
const results=[];
for (const [name,engine,options] of [
  ['desktop-chromium',chromium,{viewport:{width:1280,height:720}}],
  ['mobile-webkit',webkit,devices['iPhone 13 landscape']],
]) {
  const browser=await engine.launch({headless:true});
  try {
    const page=await browser.newPage(options);
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route(url=>url.pathname==='/src/main.ts',async route=>{
      const response=await route.fetch();
      await route.fulfill({response,body:(await response.text()).replace('new Phaser.Game(gameConfig);','window.benchmarkGame = new Phaser.Game(gameConfig);')});
    });
    await page.goto('http://127.0.0.1:5174');
    await page.waitForFunction(()=>window.benchmarkGame?.scene.isActive('Menu'));
    const b=await page.locator('canvas').boundingBox();
    await page.mouse.click(b.x+b.width*245/1280,b.y+b.height*425/720);
    await page.waitForFunction(()=>window.benchmarkGame.scene.isActive('Game'));
    await page.evaluate(()=>{
      const s=window.benchmarkGame.scene.getScene('Game');
      s.spawn.update=()=>{};s.loot.spawnChest=()=>{};
      s.player.activateShield(999999);s.player.stats.attackDamage=0;
      s.player.stats.attackCooldown=90;s.player.stats.projectileCount=3;
      s.mobileInput.active=true;s.mobileInput.autoFire=true;
    });
    for (const count of [24,32,64]) {
      await page.evaluate(async count=>{
        const s=window.benchmarkGame.scene.getScene('Game');
        const {Enemy}=await import('/src/game/entities/enemies/Enemy.ts');
        s.enemies.clear(true,true);
        for(let i=0;i<count;i++) {
          const angle=i/count*Math.PI*2;
          s.enemies.add(new Enemy(s,s.player.x+Math.cos(angle)*300,s.player.y+Math.sin(angle)*240,['GRUNT','RUNNER','SHOOTER','TANK'][i%4]));
        }
      },count);
      await page.waitForTimeout(1500);
      const sample=await page.evaluate(()=>new Promise(resolve=>{
        const frames=[];const updates=[];let start=0,last=0;
        const s=window.benchmarkGame.scene.getScene('Game');
        let updateAt=0;
        const pre=()=>{updateAt=performance.now();};
        const post=()=>updates.push(performance.now()-updateAt);
        s.events.on('preupdate',pre);s.events.on('postupdate',post);
        function frame(now){
          if(!start){start=now;last=now;}else {frames.push(now-last);last=now;}
          if(now-start<10000){requestAnimationFrame(frame);return;}
          s.events.off('preupdate',pre);s.events.off('postupdate',post);
          frames.sort((a,b)=>a-b);updates.sort((a,b)=>a-b);
          resolve({frames:frames.length, fps:1000/(frames.reduce((a,b)=>a+b,0)/frames.length),p95FrameMs:frames[Math.floor(frames.length*.95)],p95UpdateMs:updates[Math.floor(updates.length*.95)],over33ms:frames.filter(n=>n>33.4).length,
            enemies:s.enemies.countActive(true),enemyShots:s.enemyProjectiles.group.countActive(true),transients:s.effects.transient.size,renderer: (()=>{const gl=window.benchmarkGame.renderer.gl;const ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable';})()});
        }requestAnimationFrame(frame);
      }));
      results.push({profile:name,requestedEnemies:count,...sample,errors:[...errors]});
      console.log(JSON.stringify(results.at(-1)));
      if(count===32) await page.screenshot({path:`test-results/performance-${name}.png`});
    }
  } finally {await browser.close();}
}
mkdirSync('docs',{recursive:true});
writeFileSync('docs/combat-performance.json',JSON.stringify({measuredAt:new Date().toISOString(),method:'10s per load, 1.5s warmup; headless browsers on same Windows host; mobile emulated, no CPU throttling; live movement, attacks, 3 player shots/90ms, invulnerable player; Vite development build',results},null,2));
