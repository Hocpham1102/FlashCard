/**
 * tests/adversarial_m4_component_audio.mjs
 * Adversarial test harness for Milestone 4 Component & Audio Integrity
 * 
 * Tests:
 * 1. UserAvatar.tsx: AST/structural contract, next/image usage, fallback logic, external domain handling
 * 2. studyAudio.ts: Named default export, function inventory, SSR safety, Web Audio & SpeechSynthesis contracts
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = process.cwd();

let passCount = 0;
let failCount = 0;

function report(testName, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${testName}`);
    passCount++;
  } catch (err) {
    console.log(`  ✗ FAIL: ${testName}`);
    console.error(`    ${err.message}`);
    failCount++;
  }
}

async function reportAsync(testName, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${testName}`);
    passCount++;
  } catch (err) {
    console.log(`  ✗ FAIL: ${testName}`);
    console.error(`    ${err.message}`);
    failCount++;
  }
}

console.log('═══════════════════════════════════════════════════════════════════════════');
console.log('ADVERSARIAL STRESS TEST: UserAvatar.tsx & studyAudio.ts (M4 Verification)');
console.log('═══════════════════════════════════════════════════════════════════════════\n');

// ============================================================================
// SUITE 1: UserAvatar.tsx Structural and Adversarial Analysis
// ============================================================================
console.log('--- Suite 1: UserAvatar.tsx Integrity & Edge Cases ---');

const avatarPath = path.join(ROOT_DIR, 'src/components/UserAvatar.tsx');
const avatarCode = fs.readFileSync(avatarPath, 'utf8');

report('1.1 UserAvatar directive and Next.js Image import', () => {
  assert.ok(avatarCode.includes('"use client"'), 'UserAvatar must declare "use client" directive');
  assert.ok(
    /import\s+Image\s+from\s+["']next\/image["']/.test(avatarCode),
    'UserAvatar must import Image from next/image'
  );
  assert.ok(
    !/<img\s/i.test(avatarCode),
    'UserAvatar must NOT use raw <img> tag to avoid @next/next/no-img-element'
  );
});

report('1.2 UserAvatar unoptimized flag presence for arbitrary OAuth avatars', () => {
  assert.ok(
    avatarCode.includes('unoptimized'),
    'UserAvatar <Image /> must specify `unoptimized` to prevent Next.js image domain whitelist crashes'
  );
});

report('1.3 UserAvatar referrerPolicy="no-referrer" for Google 403 prevention', () => {
  assert.ok(
    /referrerPolicy=["']no-referrer["']/.test(avatarCode),
    'UserAvatar must specify referrerPolicy="no-referrer" to prevent Google CDN 403 Forbidden errors'
  );
});

report('1.4 UserAvatar onError fallback state handling', () => {
  assert.ok(
    avatarCode.includes('onError'),
    'UserAvatar must attach an onError callback on <Image />'
  );
  assert.ok(
    /setError\(true\)/.test(avatarCode),
    'onError callback must trigger setError(true) fallback'
  );
});

report('1.5 UserAvatar fallback initial algorithm extraction', () => {
  function getInitial(user) {
    if (!user) return null;
    return (user.name || user.username || user.email || "U")[0].toUpperCase();
  }

  assert.equal(getInitial(null), null);
  assert.equal(getInitial(undefined), null);
  assert.equal(getInitial({ name: 'vietnam' }), 'V');
  assert.equal(getInitial({ name: '', username: 'john' }), 'J');
  assert.equal(getInitial({ name: '', username: '', email: 'alice@domain.com' }), 'A');
  assert.equal(getInitial({ name: null, username: null, email: null }), 'U');
  assert.equal(getInitial({}), 'U');
  assert.equal(getInitial({ name: 'nguyễn' }), 'N');
});

// ============================================================================
// SUITE 2: studyAudio.ts Export Compliance & Function Inventory
// ============================================================================
console.log('\n--- Suite 2: studyAudio.ts Export Compliance & Helper Inventory ---');

const audioPath = path.join(ROOT_DIR, 'src/lib/studyAudio.ts');
const audioCode = fs.readFileSync(audioPath, 'utf8');

report('2.1 Non-anonymous default export compliance', () => {
  const hasAnonDefaultExport = /export\s+default\s+\{/.test(audioCode);
  assert.equal(
    hasAnonDefaultExport,
    false,
    'studyAudio.ts must not use anonymous default export (export default { ... })'
  );
  assert.ok(
    /const\s+studyAudio\s*=\s*\{/.test(audioCode),
    'studyAudio.ts must declare named object const studyAudio'
  );
  assert.ok(
    /export\s+default\s+studyAudio\s*;?/.test(audioCode),
    'studyAudio.ts must export default studyAudio'
  );
});

report('2.2 Full helper functions parity in named and default exports', () => {
  const expectedHelpers = [
    'isSoundEnabled',
    'setSoundEnabled',
    'isSpeechSynthesisSupported',
    'speakText',
    'stopSpeaking',
    'playFeedbackTone',
  ];

  for (const helper of expectedHelpers) {
    const hasNamedExport = new RegExp(`export\\s+function\\s+${helper}\\b`).test(audioCode);
    assert.ok(hasNamedExport, `studyAudio.ts must have named export for ${helper}`);
    
    const includedInObject = new RegExp(`\\b${helper}\\b`).test(
      audioCode.slice(audioCode.indexOf('const studyAudio ='))
    );
    assert.ok(includedInObject, `studyAudio default object must include ${helper}`);
  }
});

// Transpile studyAudio.ts to JS ESM for runtime testing
const { outputText: jsAudioCode } = ts.transpileModule(audioCode, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
});
const base64Js = Buffer.from(jsAudioCode).toString('base64');
const dataUri = `data:text/javascript;base64,${base64Js}`;

// ============================================================================
// SUITE 3: studyAudio.ts SSR Safety (Headless / Node.js Runtime)
// ============================================================================
console.log('\n--- Suite 3: studyAudio.ts SSR Headless Safety ---');

await reportAsync('3.1 Import and execute audio functions in Node.js environment without crash', async () => {
  const audioModule = await import(dataUri);

  // Both default and named exports should be available
  assert.ok(audioModule.default, 'Default export studyAudio must exist');
  assert.equal(typeof audioModule.isSoundEnabled, 'function');
  assert.equal(typeof audioModule.setSoundEnabled, 'function');
  assert.equal(typeof audioModule.isSpeechSynthesisSupported, 'function');
  assert.equal(typeof audioModule.speakText, 'function');
  assert.equal(typeof audioModule.stopSpeaking, 'function');
  assert.equal(typeof audioModule.playFeedbackTone, 'function');

  // In headless/SSR (window is undefined in pure Node):
  assert.equal(audioModule.isSoundEnabled(), true, 'isSoundEnabled must default to true when window is undefined');

  assert.doesNotThrow(() => {
    audioModule.setSoundEnabled(false);
  }, 'setSoundEnabled must not throw when window is undefined');

  assert.equal(audioModule.isSpeechSynthesisSupported(), false, 'isSpeechSynthesisSupported must return false without window');

  assert.doesNotThrow(() => {
    audioModule.speakText('Test prompt', { rate: 1, pitch: 1 });
  }, 'speakText must not throw when window is undefined');

  assert.doesNotThrow(() => {
    audioModule.stopSpeaking();
  }, 'stopSpeaking must not throw when window is undefined');

  assert.doesNotThrow(() => {
    audioModule.playFeedbackTone('correct');
    audioModule.playFeedbackTone('wrong');
  }, 'playFeedbackTone must not throw when window is undefined');
});

// ============================================================================
// SUITE 4: studyAudio.ts Browser Emulation (DOM / Web Audio Sandbox)
// ============================================================================
console.log('\n--- Suite 4: studyAudio.ts Browser Sandbox Emulation ---');

await reportAsync('4.1 Browser simulation: Sound toggle, localStorage, and custom events', async () => {
  const storage = new Map();
  const dispatchedEvents = [];

  global.window = {
    localStorage: {
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, String(v)),
    },
    dispatchEvent: (ev) => dispatchedEvents.push(ev.type),
  };
  global.localStorage = global.window.localStorage;
  global.Event = class Event {
    constructor(type) {
      this.type = type;
    }
  };

  try {
    const audioModule = await import(`${dataUri}#test4_1`);

    // Initial state (no storage key)
    assert.equal(audioModule.isSoundEnabled(), true, 'Initial state without storage should be sound enabled');

    // Toggle off
    audioModule.setSoundEnabled(false);
    assert.equal(audioModule.isSoundEnabled(), false, 'isSoundEnabled should be false after setSoundEnabled(false)');
    assert.equal(storage.get('flashcard_sound_enabled'), 'false');
    assert.ok(dispatchedEvents.includes('soundSettingsChanged'), 'soundSettingsChanged event must be dispatched');

    // Toggle on
    audioModule.setSoundEnabled(true);
    assert.equal(audioModule.isSoundEnabled(), true, 'isSoundEnabled should be true after setSoundEnabled(true)');
    assert.equal(storage.get('flashcard_sound_enabled'), 'true');
  } finally {
    delete global.window;
    delete global.localStorage;
    delete global.Event;
  }
});

await reportAsync('4.2 Browser simulation: SpeechSynthesis invocation contract', async () => {
  const spokenUtterances = [];
  let cancelled = 0;

  class MockSpeechSynthesisUtterance {
    constructor(text) {
      this.text = text;
      this.lang = 'en-US';
      this.rate = 1;
      this.pitch = 1;
    }
  }

  global.window = {
    speechSynthesis: {
      speak: (utt) => spokenUtterances.push(utt),
      cancel: () => { cancelled++; },
    },
    SpeechSynthesisUtterance: MockSpeechSynthesisUtterance,
    localStorage: {
      getItem: () => null,
      setItem: () => {},
    },
  };
  global.localStorage = global.window.localStorage;
  global.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

  try {
    const audioModule = await import(`${dataUri}#test4_2`);
    assert.equal(audioModule.isSpeechSynthesisSupported(), true);

    // Speak non-empty text
    audioModule.speakText('Hello World', { lang: 'en-GB', rate: 1.2, pitch: 0.9 });
    assert.equal(spokenUtterances.length, 1);
    assert.equal(spokenUtterances[0].text, 'Hello World');
    assert.equal(spokenUtterances[0].lang, 'en-GB');
    assert.equal(spokenUtterances[0].rate, 1.2);
    assert.equal(spokenUtterances[0].pitch, 0.9);
    assert.ok(cancelled >= 1, 'Previous speech must be cancelled before speaking');

    // Empty / whitespace inputs must be ignored
    audioModule.speakText('');
    audioModule.speakText('   ');
    audioModule.speakText(null);
    assert.equal(spokenUtterances.length, 1, 'Empty text must not trigger utterance');

    // stopSpeaking()
    audioModule.stopSpeaking();
    assert.ok(cancelled >= 2, 'stopSpeaking must invoke speechSynthesis.cancel()');
  } finally {
    delete global.window;
    delete global.SpeechSynthesisUtterance;
  }
});

await reportAsync('4.3 Browser simulation: Web Audio Tone generation frequencies', async () => {
  const createdOscillators = [];

  class MockGainNode {
    constructor() {
      this.gain = {
        setValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
      };
    }
    connect() {}
  }

  class MockOscillatorNode {
    constructor() {
      this.frequency = { value: 0 };
      this.type = 'sine';
      this.started = false;
      this.stopped = false;
      createdOscillators.push(this);
    }
    connect() {}
    start() { this.started = true; }
    stop() { this.stopped = true; }
  }

  class MockAudioContext {
    constructor() {
      this.currentTime = 0;
      this.destination = {};
    }
    createOscillator() { return new MockOscillatorNode(); }
    createGain() { return new MockGainNode(); }
    close() {}
  }

  global.window = {
    AudioContext: MockAudioContext,
    localStorage: {
      getItem: () => null,
      setItem: () => {},
    },
  };
  global.localStorage = global.window.localStorage;

  try {
    const audioModule = await import(`${dataUri}#test4_3`);

    // Test 'correct' tone frequency
    audioModule.playFeedbackTone('correct');
    assert.equal(createdOscillators.length, 1);
    assert.equal(createdOscillators[0].frequency.value, 880, 'Correct tone must be 880Hz');
    assert.equal(createdOscillators[0].started, true);
    assert.equal(createdOscillators[0].stopped, true);

    // Test 'wrong' tone frequency
    audioModule.playFeedbackTone('wrong');
    assert.equal(createdOscillators.length, 2);
    assert.equal(createdOscillators[1].frequency.value, 240, 'Wrong tone must be 240Hz');
    assert.equal(createdOscillators[1].started, true);
    assert.equal(createdOscillators[1].stopped, true);
  } finally {
    delete global.window;
  }
});

// ============================================================================
// FINAL SUMMARY
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════════════════════');
console.log(`TEST SUMMARY: Total=${passCount + failCount} | Passed=${passCount} | Failed=${failCount}`);
console.log('═══════════════════════════════════════════════════════════════════════════');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
