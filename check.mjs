/**
 * Offline check for the dsh-skill-list client bundle:
 *   node check.mjs
 * Verifies the module contract, slot registration, session picking, the
 * skills/list data path, filtering, and server-rendered panel markup.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import assert from "node:assert/strict";

const APP = "/Applications/DSH Desktop.app/Contents/Resources/app/node_modules";
const requireApp = createRequire(APP + "/");
const react = requireApp("react");
const server = requireApp("react-dom/server");

const CLIENT = process.argv[2] || (process.env.DSH_PROFILE_DIR || "") + "/node_modules/dsh-skill-list/client.js";
const source = readFileSync(CLIENT, "utf8");

let captured;
const sandbox = {
	window: { __ModuleLoader__: { load: (mod) => { captured = mod; } } },
	require: (id) => {
		if (id === "react") return react;
		if (id === "react-dom") return { createPortal: () => null };
		throw new Error("unexpected require: " + id);
	},
	console,
	setInterval, clearInterval, setTimeout, clearTimeout, Symbol, Object, String, Math,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: "client.js" });

assert.ok(captured, "module did not register with __ModuleLoader__");
assert.equal(captured.id, "dsh-skill-list");
const bundle = captured.factory(sandbox.require);

// 1. module contract
assert.equal(bundle.name, "dsh-skill-list");
assert.ok(bundle.inject.includes("remote.skills"), "must inject the skills remote namespace");
assert.ok(bundle.inject.includes("remote"), "must inject the remote service itself: reading ctx.remote without it throws");
assert.equal(typeof bundle.apply, "function");

// Emulate cordis: touching a service property that `inject` does not declare
// throws. This is the exact failure that crashed the client plugin in the app.
function strictContext(services, declared) {
	return new Proxy(services, {
		get(target, property) {
			if (typeof property === "string" && !declared.includes(property)) {
				throw new Error(`cannot get property "${property}" without inject`);
			}
			return target[property];
		},
	});
}

// 2. slot registration (through the strict context)
const registrations = [];
const ctxServices = {
	sessions: { list: { getSnapshot: () => ({ byId: {} }) } },
	remote: { skills: { list: async () => ({ ok: true, value: { skills: [] } }) } },
	slots: {
		inject: (slotName, fn) => {
			assert.ok(["shell.overlay", "conversation.input.right"].includes(slotName), "unexpected slot: " + slotName);
			fn();
		},
		register: (def) => registrations.push(def),
	},
};
const strict = strictContext(ctxServices, bundle.inject);
bundle.apply(strict);
assert.deepEqual(registrations.map((r) => [r.name, r.id]), [
	["shell.overlay", "dsh-skill-list"],
	["conversation.input.right", "dsh-skill-list-input"],
]);

// 7. the lazy read path the panel uses at click time, under the same strictness
const lazyById = { live: { id: "live", updatedAt: 5, retainedBy: { mainView: 1 } } };
const lazyRemote = { skills: { list: async () => ({ ok: true, value: { skills: [
	{ name: "hallmark", description: "design" },
	{ name: "cad", description: "models" },
] } }) } };
const loaded = await bundle.loadSkillRows(strictContext({
	sessions: { list: { getSnapshot: () => ({ byId: { live: { id: "live", updatedAt: 5, retainedBy: { mainView: 1 }, cwd: "/work/proj" } } }) } },
	remote: lazyRemote,
}, bundle.inject));
assert.deepEqual(loaded.rows.map((s) => s.name), ["cad", "hallmark"]);
assert.equal(loaded.cwd, "/work/proj", "the session cwd is the category input");
await assert.rejects(
	() => bundle.loadSkillRows(strictContext({ sessions: { list: { getSnapshot: () => ({ byId: {} }) } }, remote: lazyRemote }, bundle.inject)),
	/还没有会话/,
);
// 3. session picking: main-view row wins, newest updatedAt breaks ties
assert.equal(bundle.pickSessionId(undefined), undefined);
assert.equal(bundle.pickSessionId({}), undefined);
const byId = {
	subagent: { id: "subagent", origin: "subagent", updatedAt: 900, retainedBy: {} },
	oldMain: { id: "oldMain", updatedAt: 100, retainedBy: { mainView: 1 } },
	newMain: { id: "newMain", updatedAt: 500, retainedBy: { mainView: 2 } },
	idle: { id: "idle", updatedAt: 800, retainedBy: {} },
};
assert.equal(bundle.pickSessionId(byId), "newMain");
assert.equal(bundle.pickSessionId({ a: { id: "a", updatedAt: 3 }, b: { id: "b", updatedAt: 9 } }), "b");

// 4. data path: ok result sorted by name, error result surfaced
const calls = [];
const remoteOk = { skills: { list: async (req) => { calls.push(req); return { ok: true, value: { skills: [
	{ name: "zeta", description: "z" },
	{ name: "alpha", description: "a" },
] } }; } } };
const sorted = await bundle.listSkills(remoteOk, "sid-1");
assert.deepEqual(sorted.map((s) => s.name), ["alpha", "zeta"]);
assert.equal(JSON.stringify(calls), JSON.stringify([{ sessionId: "sid-1" }]));

const remoteFail = { skills: { list: async () => ({ ok: false, error: { code: "session/not-found", message: "gone" } }) } };
await assert.rejects(() => bundle.listSkills(remoteFail, "sid-2"), /session\/not-found: gone/);

// 5. filtering
const rows = [{ name: "cad", description: "参数化建模" }, { name: "office-xlsx", description: "Workbooks" }];
assert.equal(bundle.filterSkills(rows, "").length, 2);
assert.deepEqual(bundle.filterSkills(rows, "CAD").map((s) => s.name), ["cad"]);
assert.deepEqual(bundle.filterSkills(rows, "workbook").map((s) => s.name), ["office-xlsx"]);
assert.equal(bundle.filterSkills(rows, "nope").length, 0);

// 6. panel markup (first paint: loading state inside the dialog)
const Panel = bundle.SkillPanel;
const html = server.renderToStaticMarkup(react.createElement(Panel, { onClose: () => {} }));
assert.match(html, /class="dshs-backdrop"/);
assert.match(html, /role="dialog"/);
assert.match(html, /dshs-search/);
assert.match(html, /读取中/);

// 8. composer insertion: "/name " at the caret, one retry on a stale revision
function fakeComposer(results) {
	const calls = { capture: 0, insert: [] };
	return {
		calls,
		face: {
			captureInsertion: () => { calls.capture += 1; return { start: 3, end: 3, draftRev: calls.capture }; },
			insertText: (text, span) => { calls.insert.push([text, span]); return results[calls.insert.length - 1] === true; },
		},
	};
}
const happy = fakeComposer([true]);
assert.equal(bundle.insertSkillReference("hallmark", happy.face), true);
assert.equal(JSON.stringify(happy.calls.insert[0][0]), JSON.stringify("/hallmark "));
assert.equal(happy.calls.capture, 1);

const stale = fakeComposer([false, true]);
assert.equal(bundle.insertSkillReference("cad", stale.face), true);
assert.equal(stale.calls.capture, 2, "stale revision must re-capture and retry once");

const dead = fakeComposer([false]);
assert.equal(bundle.insertSkillReference("cad", dead.face), false);
assert.equal(bundle.insertSkillReference("cad", undefined), false, "no mounted composer answers false");

// 9. spacing: our left inset makes the neighbour distance equal the row's tab gap
assert.equal(bundle.alignPadding(0, 36, 36), 0, "already the tab gap: no inset");
assert.equal(bundle.alignPadding(0, 20, 36), 16, "too close: move right by the shortfall");
assert.equal(bundle.alignPadding(10, 30, 36), 16, "existing inset counts toward the target");
assert.equal(bundle.alignPadding(20, 60, 36), 0, "too far: clamp, never a negative inset");
assert.equal(bundle.alignPadding(4, Number.NaN, 36), 4, "unmeasurable layout leaves the inset alone");
assert.equal(bundle.alignPadding(4, 20, 0), 4, "no measurable tab gap leaves the inset alone");

// 10. categories: skill home derived from the catalog path, empty buckets dropped
const cwd = "/work/proj";
const sample = [
	{ name: "office-xlsx", path: "/Applications/DSH Desktop.app/Contents/Resources/app/node_modules/@deepseek-ai/dsh-skill-office/SKILL.md" },
	{ name: "cad", path: "/Users/a27/Library/Application Support/dsh-desktop/harness/skills/cad/SKILL.md" },
	{ name: "mine", path: "/work/proj/.dsh/skills/mine/SKILL.md" },
	{ name: "agents", path: "/work/proj/.agents/skills/agents/SKILL.md" },
	{ name: "nopath" },
];
assert.equal(bundle.categoryOf(sample[0], cwd), "builtin");
assert.equal(bundle.categoryOf(sample[1], cwd), "user");
assert.equal(bundle.categoryOf(sample[2], cwd), "project");
assert.equal(bundle.categoryOf(sample[3], cwd), "project");
assert.equal(bundle.categoryOf(sample[4], cwd), "user", "no path falls back to the user bucket");
assert.equal(bundle.categoryOf(sample[1], undefined), "user");
const groups = bundle.groupSkills(sample, cwd);
assert.equal(JSON.stringify(groups.map((g) => [g.key, g.label, g.items.length])),
	JSON.stringify([["builtin", "内置", 1], ["user", "用户", 2], ["project", "项目", 2]]));
assert.equal(JSON.stringify(bundle.groupSkills([sample[1]], cwd).map((g) => g.key)), JSON.stringify(["user"]),
	"empty categories are not rendered");

console.log("ok — 10 groups pass: contract, strict slot registration, session pick, data path, filter, panel markup, lazy load under strict inject, composer insertion, tab-gap spacing, categories");
