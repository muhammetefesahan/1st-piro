import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// rules.js ve maps.js tarayıcı betiği olarak yazıldı; burada ayrı bir bağlamda çalıştırılır.
function load() {
  const ctx = {};
  vm.createContext(ctx);
  for (const f of ["js/rules.js", "js/maps.js"]) {
    vm.runInContext(readFileSync(new URL(f, import.meta.url), "utf8"), ctx);
  }
  return ctx.G;
}
const G = load();
const WALK = new Set([".", ",", "d"]);

test("silah verileri eksiksiz ve tutarlı", () => {
  for (const [id, w] of Object.entries(G.WEAPONS)) {
    assert.ok(w.name, id + " adı yok");
    assert.ok(w.mag > 0 && w.reserve >= w.mag, id + " cephane");
    assert.ok(w.rpm > 0, id + " atış hızı");
    for (let i = 1; i < w.dmg.length; i++) {
      assert.ok(w.dmg[i][0] > w.dmg[i - 1][0], id + " menzil basamakları artmalı");
      assert.ok(w.dmg[i][1] <= w.dmg[i - 1][1], id + " hasar mesafeyle düşmeli");
    }
  }
});

test("hasar mesafeye göre basamaklanır", () => {
  const s = G.computeStats("simsek", {});
  assert.equal(G.damageAt(s, 5), 31);
  assert.equal(G.damageAt(s, 35), 26);
  assert.equal(G.damageAt(s, 80), 22);
  // 150 sağlık: yakın mesafede 5 vuruşta öldürür
  assert.equal(Math.ceil(150 / G.damageAt(s, 5)), 5);
});

test("eklentiler değerleri değiştirir", () => {
  const base = G.computeStats("simsek", {});
  const geniş = G.computeStats("simsek", { mag: "genis" });
  assert.equal(geniş.mag, 45);
  assert.ok(geniş.reload > base.reload);
  const sus = G.computeStats("simsek", { muzzle: "susturucu" });
  assert.equal(sus.suppressed, true);
  assert.ok(sus.dmg[1][0] < base.dmg[1][0]);
  const komp = G.computeStats("simsek", { muzzle: "kompansator", under: "dikey" });
  assert.ok(komp.recV < base.recV * 0.7);
  // izin verilmeyen eklenti yok sayılır (keskin nişancıya nişangah takılmaz)
  const sn = G.computeStats("dogan", { optic: "kirmizi" });
  assert.equal(sn.att.optic, undefined);
  assert.equal(sn.scope, true);
});

test("dönüştürülmüş silah çok daha güçlü", () => {
  const n = G.computeStats("yaban", {});
  const u = G.computeStats("yaban", {}, { upgraded: true });
  assert.equal(u.name, "Vahşi Sürü");
  assert.ok(G.damageAt(u, 5) >= G.damageAt(n, 5) * 2.4);
  assert.ok(u.mag > n.mag);
});

test("zombi raunt formülleri", () => {
  assert.equal(G.zombieHealth(1), 150);
  assert.equal(G.zombieHealth(9), 950);
  assert.ok(G.zombieHealth(15) > G.zombieHealth(10));
  assert.equal([1, 2, 3, 4, 5].map(G.zombieCount).join(","), "6,8,13,18,24");
  assert.ok(G.zombieCount(10) > 24);
  assert.equal(G.zombieSpeedTier(1, 0.5), 0);
  assert.equal(G.zombieSpeedTier(20, 0.01), 2);
  assert.equal(G.isDogRound(6), true);
  assert.equal(G.isDogRound(7), false);
  assert.equal(G.isDogRound(11), true);
});

test("rütbe ve seviye hesabı", () => {
  const first = G.levelFromXp(0);
  assert.equal(first.level, 1);
  assert.equal(first.cur, 0);
  assert.equal(first.need, G.xpToNext(1));
  const two = G.levelFromXp(G.xpToNext(1));
  assert.equal(two.level, 2);
  assert.equal(G.rankName(1), "Er");
  assert.equal(G.rankName(6), "Çavuş");
  assert.equal(G.levelFromXp(1e9).level, G.MAX_LEVEL);
});

test("yol bulma köşe kesmez", () => {
  // 3x3, ortada duvar: çapraz geçiş yasak
  const walk = new Uint8Array([1, 1, 1, 1, 0, 1, 1, 1, 1]);
  const p = G.findPath(walk, 3, 3, 0, 0, 2, 2);
  assert.ok(p);
  for (let i = 1; i < p.length; i++) {
    const [ax, az] = p[i - 1], [bx, bz] = p[i];
    assert.ok(walk[bx + bz * 3], "duvara girmemeli");
    if (ax !== bx && az !== bz) {
      assert.ok(walk[bx + az * 3] && walk[ax + bz * 3], "köşe kesilmemeli");
    }
  }
  assert.equal(G.findPath(walk, 3, 3, 0, 0, 1, 1), null);
});

test("tüm haritalarda her önemli nokta ulaşılabilir", () => {
  for (const [id, m] of Object.entries(G.MAPS)) {
    const grid = G.parseGrid(m.rows);
    const walk = new Uint8Array(grid.w * grid.h);
    for (let z = 0; z < grid.h; z++)
      for (let x = 0; x < grid.w; x++) {
        const ch = m.rows[z][x];
        walk[x + z * grid.w] = WALK.has(ch) || "1234".includes(ch) ? 1 : 0;
      }
    const pts = Object.values(m.points).flat();
    assert.ok(pts.length > 0, id + " noktası yok");
    const field = G.distanceField(walk, grid.w, grid.h, pts[0].x, pts[0].z);
    for (const [type, list] of Object.entries(m.points)) {
      for (const p of list) {
        assert.ok(walk[p.x + p.z * grid.w], `${id}: ${type} (${p.x},${p.z}) katı hücrede`);
        assert.ok(Number.isFinite(field[p.x + p.z * grid.w]), `${id}: ${type} (${p.x},${p.z}) ulaşılamaz`);
      }
    }
    if (m.kind === "mp") {
      assert.ok((m.points.A || []).length >= 4 && (m.points.B || []).length >= 4, id + " doğma noktaları");
      assert.equal((m.points.flag || []).length, 3, id + " bayraklar");
    }
  }
});

test("zombi haritasında kapılar bölgeleri birbirine bağlar", () => {
  const m = G.MAPS.tesis;
  const grid = G.parseGrid(m.rows);
  const walk = new Uint8Array(grid.w * grid.h);
  for (let z = 0; z < grid.h; z++)
    for (let x = 0; x < grid.w; x++) walk[x + z * grid.w] = WALK.has(m.rows[z][x]) ? 1 : 0;
  const st = m.points.start[0];
  const closed = G.distanceField(walk, grid.w, grid.h, st.x, st.z);
  const box = m.points.box[0];
  assert.equal(Number.isFinite(closed[box.x + box.z * grid.w]), false, "kapılar kapalıyken avlu kapalı olmalı");
  for (const id of Object.keys(m.doors)) assert.ok(m.rows.some((r) => r.includes(id)), "kapı " + id + " haritada");
});

test("günlük görevler güne göre sabit ve tekrarsız", () => {
  const a = G.dailyChallenges("2026-10-06");
  const b = G.dailyChallenges("2026-10-06");
  assert.equal(a.length, 3);
  assert.deepEqual(a.map((c) => c.id), b.map((c) => c.id));
  assert.equal(new Set(a.map((c) => c.id)).size, 3);
  const other = G.dailyChallenges("2026-10-07").map((c) => c.id).join();
  assert.ok(typeof other === "string");
});

test("kamuflaj kilitleri ve silah seviyesi", () => {
  assert.ok(G.camoUnlocked("yok", 0));
  assert.ok(!G.camoUnlocked("altin", 119));
  assert.ok(G.camoUnlocked("altin", 120));
  for (let i = 1; i < G.CAMOS.length; i++) assert.ok(G.CAMOS[i].need > G.CAMOS[i - 1].need, "kamuflaj eşikleri artmalı");
  let last = 0;
  for (const xp of [0, 250, 1000, 5000, 50000, 1e7]) {
    const l = G.weaponLevel(xp);
    assert.ok(l.level >= last && l.level <= 30);
    last = l.level;
  }
  assert.equal(G.weaponLevel(0).level, 1);
  assert.equal(G.weaponLevel(1e7).need, 0);
});

test("rütbe listesi sıralı ve operatör kilitleri ulaşılabilir", () => {
  for (let i = 1; i < G.RANKS.length; i++) assert.ok(G.RANKS[i][0] > G.RANKS[i - 1][0]);
  assert.equal(G.RANKS[G.RANKS.length - 1][0], G.MAX_LEVEL);
  for (const [id, o] of Object.entries(G.OPERATORS)) assert.ok(o.unlock >= 1 && o.unlock <= G.MAX_LEVEL, id);
  for (const [id, m] of Object.entries(G.MELEE)) assert.ok(m.unlock >= 1 && m.unlock <= G.MAX_LEVEL, id);
  assert.ok(Object.values(G.OPERATORS).some((o) => o.unlock === 1), "başlangıçta en az bir operatör açık olmalı");
});
