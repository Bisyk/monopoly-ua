import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  BOT_PERSONAS,
  generateBotUsername,
  getBotAvatarUrl,
  getBotPersonaByUsername,
} from "~/shared/constants/botNames";

const PUBLIC_DIR = path.resolve(process.cwd(), "public");

test("BOT_PERSONAS defines 6 distinct oligarch personas with unique names, colors, and existing avatar assets", () => {
  assert.equal(BOT_PERSONAS.length, 6);

  const ids = new Set();
  const names = new Set();
  const colors = new Set();
  const avatarUrls = new Set();

  for (const persona of BOT_PERSONAS) {
    assert.ok(persona.id.length > 0);
    assert.ok(persona.username.length > 0);
    assert.ok(persona.title.length > 0);
    assert.match(persona.bgColor, /^#[0-9A-Fa-f]{6}$/);
    assert.match(persona.avatarUrl, /^\/assets\/avatars\/[a-z0-9-]+\.jpg$/);

    ids.add(persona.id);
    names.add(persona.username.toLowerCase());
    colors.add(persona.bgColor.toUpperCase());
    avatarUrls.add(persona.avatarUrl);

    const diskPath = path.join(PUBLIC_DIR, persona.avatarUrl);
    assert.ok(
      fs.existsSync(diskPath),
      `Expected avatar file to exist on disk: ${diskPath}`
    );
    const stat = fs.statSync(diskPath);
    assert.ok(stat.size > 1000, `Expected non-empty avatar file: ${diskPath}`);
  }

  assert.equal(ids.size, 6);
  assert.equal(names.size, 6);
  assert.equal(colors.size, 6);
  assert.equal(avatarUrls.size, 6);
});

test("generateBotUsername draws all 6 personas uniquely before falling back to Tycoon-Bot-N", () => {
  const assigned = [];
  for (let i = 0; i < 6; i += 1) {
    const next = generateBotUsername(assigned);
    assert.ok(!assigned.includes(next), `Duplicate bot name generated: ${next}`);
    assert.ok(
      getBotPersonaByUsername(next),
      `Expected generated name "${next}" to match a persona`
    );
    assigned.push(next);
  }

  assert.equal(new Set(assigned).size, 6);

  const fallback1 = generateBotUsername(assigned);
  assert.equal(fallback1, "Tycoon-Bot-1");
  const fallback2 = generateBotUsername([...assigned, fallback1]);
  assert.equal(fallback2, "Tycoon-Bot-2");
});

test("getBotPersonaByUsername and getBotAvatarUrl resolve case-insensitively and ignore unknown users", () => {
  const sample = BOT_PERSONAS[0];
  const found = getBotPersonaByUsername(`  ${sample.username.toUpperCase()}  `);
  assert.deepEqual(found, sample);
  assert.equal(getBotAvatarUrl(sample.username.toLowerCase()), sample.avatarUrl);

  assert.equal(getBotPersonaByUsername("HumanPlayer42"), null);
  assert.equal(getBotAvatarUrl("HumanPlayer42"), null);
  assert.equal(getBotAvatarUrl(null), null);
  assert.equal(getBotAvatarUrl(undefined), null);
});
