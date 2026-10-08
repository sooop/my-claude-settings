import os, json, random, shutil, textwrap
random.seed(5501)
ROOT = os.path.dirname(os.path.abspath(__file__))
C = os.path.join(ROOT, "corpus")
T = os.path.join(ROOT, "templates")
for d in (C, T):
    shutil.rmtree(d, ignore_errors=True)
truth = {}

def w(base, rel, s):
    p = os.path.join(base, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "w", encoding="utf-8", newline="\n").write(s)

WORDS = ["order","parcel","route","tariff","invoice","pickup","manifest","carrier","zone","label",
         "ledger","refund","stock","batch","dock","scan","fleet","depot","claim","quote"]
OWNERS = ["kim","lee","park","choi","jung"]
N = 100

def filler(i, k=3):
    out = []
    for j in range(k):
        a, b = random.sample(WORDS, 2)
        out.append(f"""function {a}{b.title()}{i}_{j}(items, opts = {{}}) {{
  const limit = opts.limit ?? {random.randint(10, 90)};
  let total = 0;
  for (const it of items) {{
    if (it.{b} > {random.randint(1, 9)}) total += it.{a} * {random.randint(2, 7)};
    else total -= {random.randint(0, 3)};
  }}
  return Math.min(total, limit);
}}
""")
    return "\n".join(out)

# ---- lib
w(C, "src/lib/legacy.js", "export function legacyFetch(url, init) {\n  return fetch(url, init);\n}\n")
w(C, "src/lib/config.js", "export const TAX_RATE = 1.0725;\nexport const PAGE_SIZE = 20;\n")
w(C, "src/lib/surcharge.js", """// surcharge helpers
export function computeSurchargeRate(zone) { return zone === 'island' ? 0.12 : 0.04; }
export function computeSurcharges(list) { return list.map((x) => x * 0.04); }
export function computeSurcharge(weightKg, zone, { express = false } = {}) {
  const base = weightKg * computeSurchargeRate(zone);
  return express ? base * 1.5 : base;
}
""")
w(C, "src/internal/secret.js", "export const SECRET = 'x';\n")

# pick sets
idx = list(range(N))
legacy_callers = sorted(random.sample(idx, 27))
legacy_comment = random.sample([i for i in idx if i not in legacy_callers], 5)
legacy_string = random.sample([i for i in idx if i not in legacy_callers and i not in legacy_comment], 2)
surch_users = sorted(random.sample(idx, 4))
todo_files = {}
for i in random.sample(idx, 40):
    todo_files[i] = random.choice(OWNERS)
tax_users = sorted(random.sample(idx, 6))
tax_shadow = tax_users[3]
secret_dyn = random.choice([i for i in idx if i not in tax_users])
blimit = random.sample(idx, 2)
alimit_in_chain = True

handlers = {}
for i in idx:
    a, b = random.sample(WORDS, 2)
    name = f"{a}{b.title()}{i:03d}Handler"
    handlers[f"src/modules/m{i:03d}.js"] = name
    head, body = [], []
    if i in legacy_callers or i in legacy_comment or i in legacy_string:
        head.append("import { legacyFetch } from '../lib/legacy.js';" if i in legacy_callers else "")
    if i in surch_users:
        head.append("import { computeSurcharge } from '../lib/surcharge.js';")
    if i in tax_users:
        head.append("import { TAX_RATE } from '../lib/config.js';")
    if i in blimit:
        pass
    body.append(filler(i))
    if i in legacy_callers:
        body.append(f"async function load{i}() {{\n  return await legacyFetch('/api/{i}');\n}}\n")
    if i in legacy_comment:
        body.append("// TODO migrate: legacyFetch(url) is deprecated, remove when v3 lands\n")
    if i in legacy_string:
        body.append(f"const NOTE{i} = 'call legacyFetch(url) was removed';\n")
    if i in surch_users:
        body.append(f"const s{i} = computeSurcharge({random.randint(1,30)}, 'mainland');\n")
    if i in tax_users:
        if i == tax_shadow:
            body.append(f"function withTax{i}(x) {{\n  const TAX_RATE = 1.0275;\n  return x * TAX_RATE;\n}}\n")
        else:
            body.append(f"function withTax{i}(x) {{\n  return x * TAX_RATE;\n}}\n")
    if i in blimit:
        body.append(f"export const lim{i} = Number(process.env.B_LIMIT ?? 10);\n")
    if i == secret_dyn:
        body.append("export async function loadSecret() {\n  const m = await import('../internal/' + 'secret.js');\n  return m.SECRET;\n}\n")
    if i in todo_files:
        body.append(f"// TODO({todo_files[i]}): revisit {random.choice(WORDS)} logic before release\n")
    body.append(f"export const {name} = (ctx) => ({{ ok: true, id: {i}, ctx }});\n")
    w(C, f"src/modules/m{i:03d}.js", "\n".join(h for h in head if h) + "\n\n" + "\n".join(body))

# ---- giant file (needle)
parts = []
needle_fn = None
for j in range(150):
    a, b = random.sample(WORDS, 2)
    name = f"calc{a.title()}{b.title()}{j:03d}"
    k = random.choice(["a", "b", "c"])
    if j == 97:
        needle_fn = name
        parts.append(f"""export function {name}(x) {{
  // gross price including tax
  if (x < 0) return 0;
  return Math.round(x * 1.0725 * 100) / 100;
}}
""")
    elif j in (31, 120):
        const = "1.0275" if j == 31 else "1.725"
        parts.append(f"""export function {name}(x) {{
  if (x < 0) return -1;
  return Math.round(x * {const} * 100) / 100;
}}
""")
    else:
        parts.append(f"""export function {name}(x) {{
  let acc = 0;
  for (let i = 0; i < {random.randint(3, 12)}; i++) {{
    acc += x * {random.randint(2, 9)} - i;
    if (acc > {random.randint(100, 900)}) acc -= {random.randint(1, 20)};
  }}
  return acc;
}}
""")
w(C, "src/big/giant.js", "\n".join(parts))
truth["needle"] = {"fn": needle_fn, "negative_returns": 0}

# ---- chains
def chain(prefix, depth, env, default, term, dispatch=False, barrel=False):
    names = [f"{prefix}{k}" for k in range(1, depth + 1)]
    for k in range(depth):
        f = f"src/chains/{prefix}_{k+1}.js"
        nxt = names[k + 1] if k + 1 < depth else None
        if nxt is None:
            w(C, f, f"export function {names[k]}(v) {{\n  return {term}(v);\n}}\n\nexport function {term}(v) {{\n  const lim = Number(process.env.{env} ?? {default});\n  return Math.min(v, lim);\n}}\n")
        else:
            src = f"./{prefix}_{k+2}.js"
            if barrel and k == depth // 2:
                src = f"./{prefix}_barrel.js"
            imp = f"import {{ {nxt} as next_ }} from '{src}';\n"
            if dispatch and k == depth // 3:
                imp = f"import {{ {nxt} }} from '{src}';\nimport {{ ROUTE_KEY }} from './{prefix}_keys.js';\nconst TABLE = {{ [ROUTE_KEY]: {nxt}, other: (v) => v }};\nconst next_ = (v) => TABLE[ROUTE_KEY](v);\n"
            w(C, f, imp + f"\nexport function {names[k]}(v) {{\n  return next_(v + {k});\n}}\n")
    if dispatch:
        w(C, f"src/chains/{prefix}_keys.js", "export const ROUTE_KEY = 'primary';\n")
    if barrel:
        tgt = depth // 2 + 1
        w(C, f"src/chains/{prefix}_barrel.js", f"export {{ {names[depth//2+1]} }} from './{prefix}_{tgt+1}.js';\n")
    # decoy sibling
    w(C, f"src/chains/{prefix}_decoy.js", f"export function {prefix}Decoy(v) {{\n  return {term}Old(v);\n}}\nfunction {term}Old(v) {{ return v; }}\n")
    return {"entry": names[0], "terminal": term, "env": env, "default": default, "depth": depth}
truth["chain3"] = chain("ca", 3, "A_LIMIT", 50, "clampTotal")
truth["chain6"] = chain("cb", 6, "B_CAP", 75, "capWeight", barrel=True)
truth["chain10"] = chain("cc", 10, "C_MAX", 120, "boundVolume", dispatch=True)

# ---- review files
REV = {}
def rv(n, bug, code, line_hint=None):
    REV[n] = {"bug": bug, "code": code}
rv("r01", True, """export function pageOf(items, page, size) {
  const start = page * size;
  return items.slice(start, start + size + 1);
}
""")
rv("r02", True, """export async function notifyAll(users, send) {
  const sent = [];
  users.forEach(async (u) => {
    await send(u);
    sent.push(u.id);
  });
  return sent;
}
""")
rv("r03", True, """export function sumTotals(orders) {
  return orders.map((o) => o.total).reduce((a, b) => a + b);
}
""")
rv("r04", True, """const DEFAULT_TAGS = [];
export function addTag(tag, list = DEFAULT_TAGS) {
  list.push(tag);
  return list;
}
""")
rv("r05", True, """export function dayOfMonth(isoDate) {
  const d = new Date(isoDate);
  return d.getDate();
}
""")
rv("r06", True, """export function topWeights(weights) {
  return [...weights].sort().slice(0, 3);
}
""")
rv("r07", False, """export function normalize(v) {
  if (v == null) return '';
  return String(v).trim();
}
""")
rv("r08", False, """export function sumTotals(orders) {
  return orders.map((o) => o.total).reduce((a, b) => a + b, 0);
}
""")
rv("r09", False, """export function log(items, sink) {
  items.forEach((it) => {
    sink.push(JSON.stringify(it));
  });
  return sink.length;
}
""")
rv("r10", False, """export function pageOf(items, page, size) {
  return items.slice(page * size, (page + 1) * size);
}
""")
rv("r11", False, """export function ranked(weights) {
  return [...weights].sort((a, b) => b - a).slice(0, 3);
}
""")
rv("r12", False, """export function parseQty(s) {
  const n = parseInt(s, 10);
  if (Number.isNaN(n)) {
    // intentionally swallow: callers treat 0 as "missing"
    return 0;
  }
  return n;
}
""")
order = list(REV)
random.shuffle(order)
batches = [order[0:4], order[4:8], order[8:12]]
# ensure 2 buggy each
b = [k for k in order if REV[k]["bug"]]; c = [k for k in order if not REV[k]["bug"]]
batches = [[b[0], b[1], c[0], c[1]], [b[2], b[3], c[2], c[3]], [b[4], b[5], c[4], c[5]]]
for bt in batches:
    random.shuffle(bt)
for n, r in REV.items():
    w(C, f"src/review/{n}.js", r["code"])
truth["review"] = {"batches": batches, "bug": {n: r["bug"] for n, r in REV.items()}}

# ---- tests dir (some file imports legacyFetch & secret)
w(C, "test/legacy.test.js", "import { legacyFetch } from '../src/lib/legacy.js';\nexport const t = legacyFetch;\n")

# ---- truth: extraction
truth["E1"] = {"file": "src/lib/surcharge.js", "line": 4, "params": ["weightKg", "zone", "{ express = false } = {}"]}
truth["E2"] = {"files": [f"src/modules/m{i:03d}.js" for i in legacy_callers]}
truth["E3"] = {"handlers": handlers}
truth["E5"] = {"todo_kim": sorted(f"src/modules/m{i:03d}.js" for i, o in todo_files.items() if o == "kim"),
               "all": {f"src/modules/m{i:03d}.js": o for i, o in todo_files.items()}}

# ---- verification claims (4 true / 4 false)
lc = len(legacy_callers)
nm = f"src/modules/m{surch_users[0]:03d}.js"
hf = sorted(handlers)[40]
claims = [
    (f"Exactly {lc} files under src/modules actually call legacyFetch( (comments and string literals do not count).", True),
    (f"The handler `{handlers[hf]}` is exported from {hf}.", True),
    ("B_LIMIT env var is read in exactly one place under src/.", False),
    ("A_LIMIT env var is read in exactly one place under src/.", True),
    ("Every module under src/modules that uses TAX_RATE uses the value defined in src/lib/config.js.", False),
    ("No file under src/ imports src/internal/secret.js (statically or dynamically).", False),
    (f"computeSurcharge is used (imported) by exactly 5 modules under src/modules.", False),
    (f"The handler `{handlers[sorted(handlers)[7]]}` is exported from {sorted(handlers)[8]}.", False),
]
truth["V"] = [{"claim": c, "answer": a} for c, a in claims]

# ---- impl templates
w(T, "pricing/src/pricing.js", """export function tierDiscount(qty) {
  if (qty > 100) return 0.2;
  if (qty > 50) return 0.1;
  if (qty > 10) return 0.05;
  return 0;
}

export function lineTotal(unitPrice, qty) {
  const gross = unitPrice * qty;
  const total = gross * (1 - tierDiscount(qty));
  return Math.round(total * 100) / 100;
}

export function orderTotal(lines) {
  return Math.round(lines.reduce((s, l) => s + lineTotal(l.unitPrice, l.qty), 0) * 100) / 100;
}
""")
w(T, "pricing/test/pricing.test.js", """import test from 'node:test';
import assert from 'node:assert/strict';
import { tierDiscount, lineTotal, orderTotal } from '../src/pricing.js';

// Spec: qty 10 -> 0%, 11..50 -> 5%... see README. Tiers are INCLUSIVE at the lower bound: qty>=11 gets 5%, qty>=51 gets 10%, qty>=101 gets 20%.
test('no discount at 10', () => assert.equal(tierDiscount(10), 0));
test('5% at 11', () => assert.equal(tierDiscount(11), 0.05));
test('10% at 51', () => assert.equal(tierDiscount(51), 0.1));
test('20% at 101', () => assert.equal(tierDiscount(101), 0.2));
test('lineTotal rounds half up to cents', () => assert.equal(lineTotal(3.33, 20), 63.27));
test('orderTotal sums lines', () => assert.equal(orderTotal([{ unitPrice: 2, qty: 11 }, { unitPrice: 1, qty: 1 }]), 22.0));
""")
# Note: tierDiscount(11) with ">10" => 0.05 passes already; adjust: the real bug is tier boundary at 50/100 (qty 50 => should be 0.05, qty 51 => 0.1 with >50 passes). Make bug real:
w(T, "pricing/src/pricing.js", """export function tierDiscount(qty) {
  if (qty >= 100) return 0.2;
  if (qty >= 50) return 0.1;
  if (qty > 10) return 0.05;
  return 0;
}

export function lineTotal(unitPrice, qty) {
  const gross = unitPrice * qty;
  const total = gross * (1 - tierDiscount(qty));
  return Math.floor(total * 100) / 100;
}

export function orderTotal(lines) {
  return Math.round(lines.reduce((s, l) => s + lineTotal(l.unitPrice, l.qty), 0) * 100) / 100;
}
""")
w(T, "pricing/test/pricing.test.js", """import test from 'node:test';
import assert from 'node:assert/strict';
import { tierDiscount, lineTotal, orderTotal } from '../src/pricing.js';

// Spec: tiers start strictly ABOVE the boundary: qty>10 -> 5%, qty>50 -> 10%, qty>100 -> 20%.
test('no discount at 10', () => assert.equal(tierDiscount(10), 0));
test('5% at 11', () => assert.equal(tierDiscount(11), 0.05));
test('5% at 50', () => assert.equal(tierDiscount(50), 0.05));
test('10% at 51', () => assert.equal(tierDiscount(51), 0.1));
test('10% at 100', () => assert.equal(tierDiscount(100), 0.1));
test('20% at 101', () => assert.equal(tierDiscount(101), 0.2));
test('lineTotal rounds to nearest cent', () => assert.equal(lineTotal(3.33, 20), 63.27));
test('orderTotal sums lines', () => assert.equal(orderTotal([{ unitPrice: 2, qty: 11 }, { unitPrice: 1, qty: 1 }]), 21.9));
""")
# order project
w(T, "orders/src/coupons.js", """export const COUPONS = {
  SAVE10: { type: 'percent', value: 10 },
};
""")
w(T, "orders/src/order.js", """import { COUPONS } from './coupons.js';

export function subtotal(order) {
  return order.lines.reduce((s, l) => s + l.price * l.qty, 0);
}

export function total(order) {
  return subtotal(order);
}
""")
w(T, "orders/SPEC.md", """# applyCoupon(order, code, now) -> order total after coupon

Add `applyCoupon` to `src/order.js` (export it) and extend `src/coupons.js` as needed.

Coupon table (put in COUPONS):
- SAVE10: 10% off subtotal
- FLAT5: 5 off subtotal (fixed amount)
- BIG20: 20% off, only if subtotal >= 100
- SUMMER: 15% off, valid only until `expires` = 2026-08-31T23:59:59Z (inclusive); `now` is a Date passed by caller

Rules:
1. Returns the new total, rounded to 2 decimals (round half up on cents). Never below 0.
2. Unknown code -> throws Error('unknown coupon').
3. Condition not met (BIG20 below 100, SUMMER expired) -> throws Error('coupon not applicable').
4. If `order.coupon` is already set, throws Error('coupon already applied'). On success the function must NOT mutate `order`.
5. Percent coupons apply to the subtotal; fixed amount applies to the subtotal; shipping (`order.shipping`, default 0) is added AFTER the discount and is never discounted.
""")
w(T, "orders/test/order.visible.test.js", """import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCoupon } from '../src/order.js';
const o = (p) => ({ lines: [{ price: p, qty: 1 }] });
const now = new Date('2026-06-01T00:00:00Z');
test('percent', () => assert.equal(applyCoupon(o(50), 'SAVE10', now), 45));
test('unknown', () => assert.throws(() => applyCoupon(o(50), 'NOPE', now), /unknown coupon/));
""")
shutil.copytree(os.path.join(T, "pricing"), os.path.join(T, "pricing_ro"))
# hidden tests (kept outside templates)
HID = os.path.join(ROOT, "hidden")
shutil.rmtree(HID, ignore_errors=True)
w(HID, "order.hidden.test.js", """import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCoupon } from '../src/order.js';
const o = (p, extra = {}) => ({ lines: [{ price: p, qty: 1 }], ...extra });
const jun = new Date('2026-06-01T00:00:00Z');
test('flat', () => assert.equal(applyCoupon(o(50), 'FLAT5', jun), 45));
test('never below zero', () => assert.equal(applyCoupon(o(3), 'FLAT5', jun), 0));
test('big20 ok', () => assert.equal(applyCoupon(o(100), 'BIG20', jun), 80));
test('big20 below', () => assert.throws(() => applyCoupon(o(99.99), 'BIG20', jun), /not applicable/));
test('summer ok', () => assert.equal(applyCoupon(o(200), 'SUMMER', jun), 170));
test('summer last second', () => assert.equal(applyCoupon(o(200), 'SUMMER', new Date('2026-08-31T23:59:59Z')), 170));
test('summer expired', () => assert.throws(() => applyCoupon(o(200), 'SUMMER', new Date('2026-09-01T00:00:00Z')), /not applicable/));
test('already applied', () => assert.throws(() => applyCoupon(o(50, { coupon: 'SAVE10' }), 'FLAT5', jun), /already applied/));
test('no mutation', () => { const x = o(50); applyCoupon(x, 'SAVE10', jun); assert.equal(x.coupon, undefined); });
test('shipping added after', () => assert.equal(applyCoupon(o(100, { shipping: 10 }), 'SAVE10', jun), 100));
test('rounding half up', () => assert.equal(applyCoupon(o(10.05), 'SAVE10', jun), 9.05));
""")
json.dump(truth, open(os.path.join(ROOT, "truth.json"), "w"), ensure_ascii=False, indent=1)
print("files:", sum(len(f) for _, _, f in os.walk(C)), "giant lines:", len(open(os.path.join(C, "src/big/giant.js")).read().splitlines()))
