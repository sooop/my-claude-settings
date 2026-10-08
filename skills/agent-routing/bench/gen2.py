import os, json, random, shutil, subprocess
random.seed(8802)
ROOT = os.path.dirname(os.path.abspath(__file__))
T2 = os.path.join(ROOT, "templates2")
shutil.rmtree(T2, ignore_errors=True)
truth2 = {}
PJ = '{"type":"module"}'

def w(rel, s):
    p = os.path.join(T2, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "w", encoding="utf-8", newline="\n").write(s)

# ---------- H1: subtle review (10 files, 5 bugs / 5 decoys)
H1 = {
 "s01": (True, "regex /g flag + test() keeps lastIndex", """const RE = /ab+c/g;
export function containsAbc(s) {
  return RE.test(s);
}
"""),
 "s02": (True, "var closure captured in loop", """export function makeCounters(n) {
  const fns = [];
  for (var i = 0; i < n; i++) {
    fns.push(() => i);
  }
  return fns;
}
"""),
 "s03": (True, "sort by ISO string subtraction -> NaN", """export function sortByDate(events) {
  return [...events].sort((a, b) => a.date - b.date);
}
"""),
 "s04": (True, "float equality", """export function isBalanced(items) {
  const sum = items.reduce((s, x) => s + x, 0);
  return sum === 0.3 * items.length / 3 * 3 / items.length * items.length;
}
"""),
 "s05": (True, "binary search infinite loop", """export function lowerBound(a, x) {
  let lo = 0, hi = a.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (a[mid] < x) lo = mid;
    else hi = mid;
  }
  return lo;
}
"""),
 "s06": (False, "numeric comparator is correct", """export function ascending(nums) {
  return [...nums].sort((a, b) => a - b);
}
"""),
 "s07": (False, "match() with /g resets lastIndex, fine", """const RE = /\\d+/g;
export function allNumbers(s) {
  return s.match(RE) ?? [];
}
"""),
 "s08": (False, "let in loop creates per-iteration binding", """export function makeCounters(n) {
  const fns = [];
  for (let i = 0; i < n; i++) {
    fns.push(() => i);
  }
  return fns;
}
"""),
 "s09": (False, "epsilon compare is intentional", """export function nearlyEqual(a, b) {
  return Math.abs(a - b) < Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b)) * 4;
}
"""),
 "s10": (False, "correct lower bound", """export function lowerBound(a, x) {
  let lo = 0, hi = a.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (a[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
"""),
}
for k, (_, _, code) in H1.items():
    w(f"h1/{k}.js", code)
order = list(H1); random.shuffle(order)
bug = [k for k in order if H1[k][0]]; ok = [k for k in order if not H1[k][0]]
batches = [[bug[0], bug[1], bug[2], ok[0], ok[1]], [bug[3], bug[4], ok[2], ok[3], ok[4]]]
for b in batches: random.shuffle(b)
truth2["H1"] = {"batches": batches, "bug": {k: v[0] for k, v in H1.items()}}

# ---------- H2: multi-cause debug
w("h2/package.json", PJ)
w("h2/src/config.js", """const DEFAULTS = {
  currency: 'KRW',
  freeOver: 50000,
  rates: {
    domestic: { base: 3000, perKg: 500 },
    intl: { base: 12000, perKg: 2500 },
  },
};

export function makeConfig(overrides = {}) {
  return { ...overrides, ...DEFAULTS };
}
""")
w("h2/src/address.js", """export function normalizeAddress(addr) {
  return {
    ...addr,
    country: String(addr.country).trim().toLowerCase(),
    zip: String(addr.zip ?? '').replace(/\\D/g, ''),
  };
}
""")
w("h2/src/zones.js", """export function zoneOf(country) {
  return country === 'KR' ? 'domestic' : 'intl';
}
""")
w("h2/src/calc.js", """import { normalizeAddress } from './address.js';
import { zoneOf } from './zones.js';

export function shippingFee(cfg, addr, weightKg, orderTotal) {
  const a = normalizeAddress(addr);
  const zone = zoneOf(a.country);
  if (zone === 'domestic' && orderTotal >= cfg.freeOver) return 0;
  const r = cfg.rates[zone];
  const billable = Math.ceil(weightKg * 2) / 2;
  return r.base + r.perKg * billable;
}
""")
w("h2/test/calc.test.js", """import test from 'node:test';
import assert from 'node:assert/strict';
import { makeConfig } from '../src/config.js';
import { shippingFee } from '../src/calc.js';

const cfg = makeConfig();
test('domestic 1kg', () => assert.equal(shippingFee(cfg, { country: 'KR' }, 1, 1000), 3500));
test('domestic 1.2kg rounds up to 1.5', () => assert.equal(shippingFee(cfg, { country: 'KR' }, 1.2, 1000), 3750));
test('intl 2kg', () => assert.equal(shippingFee(cfg, { country: 'US' }, 2, 1000), 17000));
test('intl 0.5kg', () => assert.equal(shippingFee(cfg, { country: 'US' }, 0.5, 1000), 13250));
test('lowercase kr is domestic', () => assert.equal(shippingFee(cfg, { country: ' kr ' }, 1, 1000), 3500));
test('free shipping threshold override', () => assert.equal(shippingFee(makeConfig({ freeOver: 100000 }), { country: 'KR' }, 1, 60000), 3500));
test('free shipping at threshold', () => assert.equal(shippingFee(cfg, { country: 'KR' }, 1, 50000), 0));
test('currency override', () => assert.equal(makeConfig({ currency: 'USD' }).currency, 'USD'));
""")

# ---------- H3: parseDuration / formatDuration
w("h3/package.json", PJ)
w("h3/SPEC.md", """# duration.js — implement `parseDuration` and `formatDuration` (named exports, ESM)

## parseDuration(str) -> integer milliseconds
- Units: `d`=86400000, `h`=3600000, `m`=60000, `s`=1000, `ms`=1.
- A duration is one or more `<number><unit>` components. `<number>` is a non-negative decimal (`1`, `1.5`, `.5`, `0.25`); no sign, no exponent.
- Components must appear in strictly descending unit order (d > h > m > s > ms), each unit at most once. `1h30m` ok; `30m1h` and `1h1h` throw RangeError.
- Optional whitespace is allowed between components (`1h 30m`) and around the whole string; whitespace between a number and its unit is NOT allowed (`1 h` throws SyntaxError).
- `ms` must not be confused with `m` followed by `s`: `100ms` is 100; `1m100ms` is 60100.
- Result is the sum rounded to the nearest integer, ties rounded up (`0.0005s` = 0.5ms -> 1).
- Empty / whitespace-only string -> throws TypeError. Non-string input -> throws TypeError. A bare number (`"90"`) or unknown unit or any other malformed text -> throws SyntaxError.
- If the result exceeds Number.MAX_SAFE_INTEGER -> throws RangeError.

## formatDuration(ms) -> string
- Non-integer or non-number input -> throws TypeError. Negative -> throws RangeError.
- 0 -> `"0ms"`.
- Otherwise largest-first components d, h, m, s, ms, omitting zero components, no separators: 5400000 -> `"1h30m"`, 86400001 -> `"1d1ms"`.
- `formatDuration(parseDuration(s))` is canonical form of `s`.
""")
w("h3/test/duration.visible.test.js", """import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDuration, formatDuration } from '../src/duration.js';
test('basic', () => assert.equal(parseDuration('1h30m'), 5400000));
test('format basic', () => assert.equal(formatDuration(5400000), '1h30m'));
""")
os.makedirs(os.path.join(T2, "h3", "src"), exist_ok=True)
hid = os.path.join(ROOT, "hidden2"); shutil.rmtree(hid, ignore_errors=True)
os.makedirs(hid)
open(os.path.join(hid, "duration.hidden.test.js"), "w", encoding="utf-8", newline="\n").write("""import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDuration as p, formatDuration as f } from '../src/duration.js';
test('ms vs m', () => { assert.equal(p('100ms'), 100); assert.equal(p('1m100ms'), 60100); });
test('decimals', () => { assert.equal(p('1.5h'), 5400000); assert.equal(p('.5s'), 500); assert.equal(p('0.25m'), 15000); });
test('rounding ties up', () => { assert.equal(p('0.0005s'), 1); assert.equal(p('0.0004s'), 0); });
test('whitespace between comps', () => { assert.equal(p('  1h 30m  '), 5400000); });
test('space before unit', () => assert.throws(() => p('1 h'), SyntaxError));
test('order', () => { assert.throws(() => p('30m1h'), RangeError); assert.throws(() => p('1h1h'), RangeError); });
test('empty', () => { assert.throws(() => p(''), TypeError); assert.throws(() => p('   '), TypeError); });
test('non-string', () => { assert.throws(() => p(90), TypeError); assert.throws(() => p(null), TypeError); });
test('bare number / unit / junk', () => { assert.throws(() => p('90'), SyntaxError); assert.throws(() => p('5x'), SyntaxError); assert.throws(() => p('1h-2m'), SyntaxError); assert.throws(() => p('+1h'), SyntaxError); assert.throws(() => p('1e3s'), SyntaxError); });
test('unsafe', () => assert.throws(() => p('99999999999999999d'), RangeError));
test('d', () => assert.equal(p('2d4h'), 2 * 86400000 + 4 * 3600000));
test('zero', () => { assert.equal(p('0s'), 0); assert.equal(f(0), '0ms'); });
test('format', () => { assert.equal(f(86400001), '1d1ms'); assert.equal(f(61000), '1m1s'); assert.equal(f(999), '999ms'); assert.equal(f(90061001), '1d1h1m1s1ms'); });
test('format errors', () => { assert.throws(() => f(-1), RangeError); assert.throws(() => f(1.5), TypeError); assert.throws(() => f('5'), TypeError); assert.throws(() => f(NaN), TypeError); });
test('canonical', () => assert.equal(f(p('90m')), '1h30m'));
test('dot only', () => assert.throws(() => p('.s'), SyntaxError));
test('1.s?', () => assert.equal(p('1.s'), 1000));
""")
# reference solution (validation only; not exposed)
ref = r"""
const U = { d: 86400000, h: 3600000, m: 60000, s: 1000, ms: 1 };
const ORDER = ['d','h','m','s','ms'];
export function parseDuration(str) {
  if (typeof str !== 'string') throw new TypeError('string');
  const s = str.trim();
  if (!s) throw new TypeError('empty');
  const re = /(\d+\.?\d*|\.\d+)(ms|d|h|m|s)\s*/y;
  let pos = 0, total = 0, last = -1;
  while (pos < s.length) {
    re.lastIndex = pos;
    const m = re.exec(s);
    if (!m) throw new SyntaxError('bad');
    const idx = ORDER.indexOf(m[2]);
    if (idx <= last) throw new RangeError('order');
    last = idx;
    total += parseFloat(m[1]) * U[m[2]];
    pos = re.lastIndex;
  }
  const r = Math.floor(total + 0.5 + 1e-9);
  if (r > Number.MAX_SAFE_INTEGER) throw new RangeError('big');
  return r;
}
export function formatDuration(ms) {
  if (typeof ms !== 'number' || !Number.isInteger(ms)) throw new TypeError('int');
  if (ms < 0) throw new RangeError('neg');
  if (ms === 0) return '0ms';
  let out = '';
  for (const u of ORDER) { const n = Math.floor(ms / U[u]); ms -= n * U[u]; if (n) out += n + u; }
  return out;
}
"""
rc = os.path.join(ROOT, "refcheck2"); shutil.rmtree(rc, ignore_errors=True)
os.makedirs(os.path.join(rc, "src")); os.makedirs(os.path.join(rc, "test"))
open(os.path.join(rc, "package.json"), "w").write(PJ)
open(os.path.join(rc, "src", "duration.js"), "w").write(ref)
shutil.copy(os.path.join(hid, "duration.hidden.test.js"), os.path.join(rc, "test"))
r = subprocess.run("node --test test/duration.hidden.test.js", cwd=rc, shell=True, capture_output=True, text=True, encoding="utf-8")
print("H3 ref:", [l for l in r.stdout.splitlines() if l.startswith(("ℹ pass", "ℹ fail", "✖"))])
shutil.rmtree(rc)

# ---------- H4: runtime-claim verification
w("h4/package.json", PJ)
w("h4/src/util.js", """export function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
export function chunk(a, n) {
  const out = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out;
}
export function median(a) {
  const s = [...a].sort();
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
export function dedupe(a, { ci = false } = {}) {
  const seen = new Set();
  return a.filter((x) => {
    const k = ci ? String(x).toLowerCase() : x;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
export function addMonths(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}
export function parseQuery(q) {
  const out = {};
  for (const part of q.split('&')) {
    const [k, v = ''] = part.split('=');
    if (k in out) out[k] = [].concat(out[k], v);
    else out[k] = v;
  }
  return out;
}
export function clamp(x, lo, hi) {
  return Math.min(Math.max(x, lo), hi);
}
export function formatMoney(n) {
  const sign = n < 0 ? '-' : '';
  const [i, f] = Math.abs(n).toFixed(2).split('.');
  return sign + i.replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',') + '.' + f;
}
""")
exprs = [
 ("slugify('  Hello,  World! ')", "'hello-world'", "'hello--world'"),
 ("chunk([1,2,3,4,5,6,7], 3)", "[[1,2,3],[4,5,6],[7]]", "[[1,2,3],[4,5,6,7]]"),
 ("median([5, 3, 10, 1])", "4", "4"),  # actual computed below
 ("dedupe(['a','A','b','B'], { ci: true })", "['a','b']", "['a','A','b','B']"),
 ("addMonths('2026-01-31', 1)", "'2026-02-28'", "'2026-02-28'"),
 ("parseQuery('a=1&a=2&b')", "{ a: ['1','2'], b: '' }", "{ a: '2', b: '' }"),
 ("clamp(5, 10, 0)", "0", "5"),
 ("formatMoney(-1234.5)", "'-1,234.50'", "'-1234.50'"),
]
js = "import * as u from './h4/src/util.js';\nconst { slugify, chunk, median, dedupe, addMonths, parseQuery, clamp, formatMoney } = u;\nconst o = [" + ",".join(f"JSON.stringify({e})" for e, _, _ in exprs) + "];\nconsole.log(JSON.stringify(o));\n"
open(os.path.join(T2, "evalh4.mjs"), "w").write(js)
out = subprocess.run("node evalh4.mjs", cwd=T2, shell=True, capture_output=True, text=True, encoding="utf-8").stdout
actual = json.loads(out.strip())
os.remove(os.path.join(T2, "evalh4.mjs"))
claims = []
def j(v):
    return json.dumps(json.loads(v.replace("'", '"')) if False else v)
# build claims: true/false alternate, using actual JSON outputs
fake = {2: "4.5", 4: '"2026-02-28"', 0: '"hello-world"'}
plan = [True, True, False, False, False, True, False, True]
for i, (e, _, f) in enumerate(exprs):
    if plan[i]:
        val = actual[i]
    else:
        val = {2: "4", 4: '"2026-02-28"', 3: '["a","A","b","B"]', 6: "5"}.get(i, None)
        assert val is not None and val != actual[i], (i, val, actual[i])
    claims.append({"claim": f"In src/util.js, `{e}` evaluates to (JSON) {val}.", "answer": plan[i], "actual": actual[i]})
truth2["H4"] = claims
print("H4 actual:", actual)

# ---------- H5: large-scope refactor
w("h5/package.json", PJ)
w("h5/src/pricing.js", """// price(base, qty = 1) -> number
export function price(base, qty = 1) {
  return Math.round(base * qty * 100) / 100;
}
export function bulkPrice(base, qty) {
  return price(base, qty) * 0.9;
}
""")
w("h5/src/index.js", "export { price, bulkPrice } from './pricing.js';\n")
N5 = 36
kinds = ["direct", "alias", "ns", "barrel", "callback", "spread", "default", "multiline", "apply", "chain"]
exp = {}
for i in range(N5):
    k = kinds[i % len(kinds)]
    a, b = random.randint(2, 40) + 0.5, random.randint(1, 9)
    hdr, body = "", ""
    if k == "direct":
        hdr = "import { price } from './pricing.js';"; body = f"export const f{i} = () => price({a}, {b});"
    elif k == "alias":
        hdr = "import { price as p } from './pricing.js';"; body = f"export const f{i} = () => p({a}, {b}) + p({b}, 2);"
    elif k == "ns":
        hdr = "import * as pr from './pricing.js';"; body = f"export const f{i} = () => pr.price({a}, {b}) + pr.bulkPrice({a}, {b});"
    elif k == "barrel":
        hdr = "import { price } from './index.js';"; body = f"export const f{i} = () => [1, 2, 3].map((q) => price({a}, q)).reduce((s, x) => s + x, 0);"
    elif k == "callback":
        hdr = "import { price } from './pricing.js';"; body = f"const rows = [[{a}, 2], [{b}, 3]];\nexport const f{i} = () => rows.map(([x, y]) => price(x, y));"
    elif k == "spread":
        hdr = "import { price } from './pricing.js';"; body = f"const args = [{a}, {b}];\nexport const f{i} = () => price(...args);"
    elif k == "default":
        hdr = "import { price } from './pricing.js';"; body = f"export const f{i} = () => price({a});"
    elif k == "multiline":
        hdr = "import { price } from './pricing.js';"; body = f"export const f{i} = () =>\n  price(\n    {a},\n    {b} + 1,\n  );"
    elif k == "apply":
        hdr = "import { price } from './pricing.js';"; body = f"export const f{i} = () => price.apply(null, [{a}, {b}]);"
    elif k == "chain":
        hdr = "import { price, bulkPrice } from './pricing.js';"; body = f"// price(base, qty) is also called in the docs: price(1, 1)\nexport const f{i} = () => bulkPrice({a}, {b}) + price({b}, {b});"
    w(f"h5/src/m{i:02d}.js", hdr + "\n\n" + body + "\n")
w("h5/check.js", "const out = {};\n" + "\n".join(f"out.f{i} = (await import('./src/m{i:02d}.js')).f{i}();" for i in range(N5)) + "\nconsole.log(JSON.stringify(out));\n")
exp_out = subprocess.run("node check.js", cwd=os.path.join(T2, "h5"), shell=True, capture_output=True, text=True, encoding="utf-8").stdout.strip()
truth2["H5"] = {"expected": json.loads(exp_out), "n": N5}
json.dump(truth2, open(os.path.join(ROOT, "truth2.json"), "w"), ensure_ascii=False, indent=1)
print("H5 ok", len(truth2["H5"]["expected"]))
