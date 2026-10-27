window.__ModuleLoader__.load({ id: "dsh-skill-list", factory: (require) => {

	var module = { exports: {} };
	var exports = module.exports;
	Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
	const react = require("react");
	const h = react.createElement;
	const { useState, useEffect, useCallback } = react;

	const name = "dsh-skill-list";
	const inject = ["slots", "sessions", "remote", "remote.skills"];

	/** Captured in apply(): the plugin context whose services the panel reads lazily. */
	let pluginHost = undefined;

	/** Composer face of the visible conversation: filled by the input slot bridge. */
	let inputBridge = { sessionId: undefined, actions: undefined };

	const CSS = `
.dshs-chip{display:inline-flex;align-items:flex-end;flex:0 0 auto}
.dshs-tab-btn{appearance:none;position:relative;border:none;background:transparent;cursor:pointer;padding:0 0 9px var(--dshs-pad,0px);font:500 13px/16px inherit;color:var(--dsw-alias-label-tertiary,currentColor);white-space:nowrap}
.dshs-tab-btn:hover{color:var(--dsw-alias-label-primary,currentColor)}
.dshs-tab-btn.on{color:var(--dsw-alias-brand-primary,#6dbf8c)}
.dshs-tab-btn.on:after{content:"";position:absolute;left:var(--dshs-pad,0px);right:0;bottom:-1px;height:2px;border-radius:2px;background:var(--dsw-alias-brand-primary,#6dbf8c)}
.dshs-backdrop{position:fixed;inset:0;z-index:10050;background:color-mix(in srgb,#000 46%,transparent);display:flex;align-items:center;justify-content:center;padding:24px}
.dshs-panel{width:min(560px,100%);max-height:min(72vh,640px);display:flex;flex-direction:column;gap:10px;padding:16px 18px;border:1px solid var(--dsw-alias-border-l1,color-mix(in srgb,#888 30%,transparent));border-radius:14px;background:var(--dsw-alias-bg-layer-1,#1c1c1c);color:var(--dsw-alias-label-primary,#f2f2f2);box-shadow:0 24px 60px color-mix(in srgb,#000 46%,transparent)}
.dshs-head{display:flex;align-items:center;gap:10px}
.dshs-title{font:600 14px/1.2 inherit;white-space:nowrap}
.dshs-search{flex:1 1 auto;min-width:0;height:30px;padding:0 10px;border:1px solid var(--dsw-alias-border-l1,color-mix(in srgb,#888 30%,transparent));border-radius:8px;background:var(--dsw-alias-bg-layer-2,#262626);color:inherit;font:13px/1 inherit}
.dshs-search:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#6dbf8c);outline-offset:1px}
.dshs-icon{appearance:none;height:28px;min-width:28px;padding:0 8px;border:1px solid var(--dsw-alias-border-l1,color-mix(in srgb,#888 30%,transparent));border-radius:8px;background:transparent;color:inherit;cursor:pointer;font:13px/1 inherit}
.dshs-icon:hover{border-color:var(--dsw-alias-brand-primary,#6dbf8c)}
.dshs-list{flex:1 1 auto;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:2px;padding-right:2px}
.dshs-group{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
.dshs-item{padding:0;border-radius:8px}
.dshs-row{display:block;width:100%;padding:7px 8px;border:none;border-radius:8px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.dshs-row:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#6dbf8c) 12%,transparent)}
.dshs-row:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#6dbf8c);outline-offset:-2px}
.dshs-name{font:600 12.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}
.dshs-tag{margin-left:6px;font:400 11px/1 inherit;opacity:.66}
.dshs-desc{font:12.5px/1.45 inherit;opacity:.78;margin-top:2px}
.dshs-cats{display:flex;flex-wrap:wrap;gap:6px}
.dshs-cat{appearance:none;height:24px;padding:0 10px;border:1px solid var(--dsw-alias-border-l1,color-mix(in srgb,#888 30%,transparent));border-radius:999px;background:transparent;color:inherit;cursor:pointer;font:12px/1 inherit;opacity:.8}
.dshs-cat:hover{opacity:1;border-color:var(--dsw-alias-brand-primary,#6dbf8c)}
.dshs-cat.on{border-color:var(--dsw-alias-brand-primary,#6dbf8c);color:var(--dsw-alias-brand-primary,#6dbf8c);background:color-mix(in srgb,var(--dsw-alias-brand-primary,#6dbf8c) 14%,transparent);opacity:1}
.dshs-cat:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#6dbf8c);outline-offset:1px}
.dshs-group-head{position:sticky;top:0;padding:6px 8px 4px;font:600 11.5px/1.3 inherit;letter-spacing:.02em;opacity:.7;background:var(--dsw-alias-bg-layer-1,#1c1c1c)}
.dshs-note{padding:10px 2px;font:12.5px/1.5 inherit;opacity:.78}
.dshs-note.err{color:#e07a7a;opacity:1}
`;

	function ensureCss() {
		if (typeof document === "undefined" || document.getElementById("dshs-css")) return;
		const style = document.createElement("style");
		style.id = "dshs-css";
		style.textContent = CSS;
		(document.head || document.documentElement).appendChild(style);
	}

	/* ---------- data path (exported for the check) ---------- */

	/** Newest main-view session, else the newest session of any kind. */
	function pickSessionId(byId) {
		const rows = Object.values(byId || {}).filter((row) => row && row.origin !== "subagent");
		if (rows.length === 0) return undefined;
		const main = rows.filter((row) => ((row.retainedBy && row.retainedBy.mainView) || 0) > 0);
		const pool = main.length > 0 ? main : rows;
		const newest = pool.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
		return newest && newest.id;
	}

	/** Ask the host for the session's skill catalog; returns sorted rows. */
	async function listSkills(remote, sessionId) {
		const result = await remote.skills.list({ sessionId });
		if (!result || result.ok !== true) {
			const detail = result && result.error ? result.error.code + ": " + result.error.message : "skills/list failed";
			throw new Error(detail);
		}
		const rows = (result.value && result.value.skills) || [];
		return rows.filter(Boolean).slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));
	}

	/**
	 * Left inset that makes our chip's distance from its neighbour equal the row's
	 * own tab-to-tab gap. The flex gap already supplies part of it; only the
	 * difference becomes padding, and a negative result clamps to zero.
	 */
	function alignPadding(pad, distance, tabGap) {
		if (!Number.isFinite(distance) || !Number.isFinite(tabGap) || tabGap <= 0) return pad;
		return Math.max(0, Math.round(pad + (tabGap - distance)));
	}

	/** Write `/name ` into the current composer at the caret; false when no composer is mounted. */
	function insertSkillReference(skillName, face) {
		face = face || inputBridge.actions;
		if (!face || typeof face.insertText !== "function" || typeof face.captureInsertion !== "function") return false;
		const text = "/" + skillName + " ";
		try {
			if (face.insertText(text, face.captureInsertion())) return true;
			// A stale draft revision fails the first attempt; capture the current span and retry once.
			return face.insertText(text, face.captureInsertion()) === true;
		} catch (e) {
			try { console.warn("[dsh-skill-list] insert into composer failed:", e); } catch { /* ignore */ }
			return false;
		}
	}

	/** Pick the session to read the catalog for, then fetch it. */
	async function loadSkillRows(host) {
		const sessions = host.sessions;
		const snapshot = sessions && sessions.list && sessions.list.getSnapshot ? sessions.list.getSnapshot() : undefined;
		const sessionId = pickSessionId(snapshot && snapshot.byId);
		if (sessionId === undefined) throw new Error("还没有会话：先新建或打开一个会话，再列 skills。");
		const cwd = snapshot && snapshot.byId && snapshot.byId[sessionId] ? snapshot.byId[sessionId].cwd : undefined;
		return { rows: await listSkills(host.remote, sessionId), cwd };
	}

	/** Skill home, derived from the catalog path: bundled package, user dir, or this project. */
	const CATEGORY_ORDER = ["builtin", "user", "project"];
	const CATEGORY_LABEL = { builtin: "内置", user: "用户", project: "项目" };

	function categoryOf(skill, cwd) {
		const path = String((skill && skill.path) || "");
		if (path === "") return "user";
		const base = String(cwd || "").replace(/\/+$/, "");
		if (base !== "" && (path.indexOf(base + "/.dsh/skills/") === 0 || path.indexOf(base + "/.agents/skills/") === 0)) return "project";
		if (path.indexOf("/node_modules/") !== -1) return "builtin";
		return "user";
	}

	/** Non-empty category buckets, in a stable order, each keeping the input order. */
	function groupSkills(skills, cwd) {
		const buckets = { builtin: [], user: [], project: [] };
		for (const skill of skills) buckets[categoryOf(skill, cwd)].push(skill);
		return CATEGORY_ORDER.filter((key) => buckets[key].length > 0)
			.map((key) => ({ key, label: CATEGORY_LABEL[key], items: buckets[key] }));
	}

	function filterSkills(skills, query) {
		const q = String(query || "").trim().toLowerCase();
		if (q === "") return skills;
		return skills.filter((skill) => (String(skill.name) + " " + String(skill.description || "")).toLowerCase().indexOf(q) !== -1);
	}

	/* ---------- components ---------- */

	function SkillPanel(props) {
		const [data, setData] = useState(null); // { rows, cwd }
		const [error, setError] = useState("");
		const [query, setQuery] = useState("");
		const [category, setCategory] = useState("all");
		const load = useCallback(() => {
			setError("");
			setData(null);
			try {
				loadSkillRows(pluginHost).then(
					(snapshot) => setData(snapshot),
					(e) => setError(String((e && e.message) || e)),
				);
			} catch (e) {
				setError(String((e && e.message) || e));
			}
		}, []);
		useEffect(() => { load(); }, [load]);
		useEffect(() => {
			const onKey = (event) => { if (event.key === "Escape") props.onClose(); };
			window.addEventListener("keydown", onKey);
			return () => window.removeEventListener("keydown", onKey);
		}, [props.onClose]);
		const rows = data === null ? null : data.rows;
		const cwd = data === null ? undefined : data.cwd;
		const visible = rows === null ? [] : filterSkills(rows, query);
		const groups = rows === null ? [] : groupSkills(visible, cwd);
		// A category that vanished (e.g. after a reload) falls back to "all" instead of an empty list.
		const active = category === "all" || groups.some((group) => group.key === category) ? category : "all";
		const activeGroups = active === "all" ? groups : groups.filter((group) => group.key === active);
		const chooseCategory = (key) => (event) => { event.preventDefault(); event.stopPropagation(); setCategory(key); };
		const categoryChip = (key, label, count) => h("button", {
			key,
			type: "button",
			className: "dshs-cat" + (active === key ? " on" : ""),
			"aria-pressed": active === key ? "true" : "false",
			onClick: chooseCategory(key),
		}, label + " " + count);
		const title = rows === null
			? "skills"
			: "skills · " + visible.length + (visible.length === rows.length ? "" : " / " + rows.length);
		return h("div", { className: "dshs-backdrop", onClick: props.onClose },
			h("div", {
				className: "dshs-panel",
				role: "dialog",
				"aria-modal": "true",
				"aria-label": "skills",
				onClick: (event) => event.stopPropagation(),
			},
				h("div", { className: "dshs-head" },
					h("span", { className: "dshs-title" }, title),
					h("input", {
						className: "dshs-search",
						type: "search",
						placeholder: "筛选 name / 描述",
						value: query,
						autoFocus: true,
						onChange: (event) => setQuery(event.target.value),
					}),
					h("button", { type: "button", className: "dshs-icon", title: "重新读取", onClick: load }, "↻"),
					h("button", { type: "button", className: "dshs-icon", title: "关闭", onClick: props.onClose }, "✕"),
				),
				rows !== null && groups.length > 1 ? h("div", { className: "dshs-cats" },
					categoryChip("all", "全部", visible.length),
					groups.map((group) => categoryChip(group.key, group.label, group.items.length)),
				) : null,
				error !== "" ? h("div", { className: "dshs-note err" }, error) : null,
				rows === null && error === "" ? h("div", { className: "dshs-note" }, "读取中…") : null,
				rows !== null && visible.length === 0 ? h("div", { className: "dshs-note" }, "没有匹配的 skill") : null,
				rows !== null && visible.length > 0 && activeGroups.length === 0
					? h("div", { className: "dshs-note" }, "这个分类下没有匹配的 skill")
					: null,
				h("div", { className: "dshs-list" },
					activeGroups.map((group) => h(react.Fragment, { key: group.key },
						active === "all" ? h("div", { className: "dshs-group-head" }, group.label + " · " + group.items.length) : null,
						h("ul", { className: "dshs-group" },
							group.items.map((skill) => h("li", { key: skill.name, className: "dshs-item" },
								h("button", {
									type: "button",
									className: "dshs-row",
									title: "写入输入框：/" + skill.name,
									onClick: () => {
										if (insertSkillReference(skill.name)) props.onClose();
										else setError("输入框还没就绪：先点一下聊天输入框，再选一次。");
									},
								},
									h("div", { className: "dshs-name" }, "/" + skill.name,
										skill.modelInvocable === false ? h("span", { className: "dshs-tag" }, "仅用户可调") : null),
									h("div", { className: "dshs-desc" }, skill.description || ""),
								),
							)),
						),
					)),
				),
			),
		);
	}

	/** Keep our chip's spacing identical to the row's own 对话↔轨迹 gap. */
	function alignToTabGap(row, chip) {
		const previous = chip.previousElementSibling;
		const tabs = row.querySelectorAll(":scope > [role='tab']");
		if (!previous || tabs.length < 2) return;
		const first = tabs[0].getBoundingClientRect();
		const second = tabs[1].getBoundingClientRect();
		const tabGap = second.left - first.right;
		const distance = chip.getBoundingClientRect().left - previous.getBoundingClientRect().right;
		const current = parseFloat(chip.style.getPropertyValue("--dshs-pad")) || 0;
		const next = alignPadding(current, distance, tabGap);
		if (Math.abs(next - current) >= 0.5) chip.style.setProperty("--dshs-pad", next + "px");
	}

	/** Invisible slot occupant that hands the panel the visible composer's actions face. */
	function InputBridge(props) {
		useEffect(() => {
			if (!props.inputActions) return undefined;
			inputBridge = { sessionId: props.sessionId, actions: props.inputActions };
			return () => {
				if (inputBridge.sessionId === props.sessionId) inputBridge = { sessionId: undefined, actions: undefined };
			};
		}, [props.sessionId, props.inputActions]);
		return null;
	}

	/** Chip in the conversation tab row, immediately right of the dsh-purge chip. */
	function SkillListMount() {
		const [host, setHost] = useState(null);
		const [open, setOpen] = useState(false);
		useEffect(() => {
			let dead = false;
			const ensure = () => {
				if (dead || typeof document === "undefined") return;
				ensureCss();
				const row = document.querySelector("[data-conversation-tabs]")
					|| document.querySelector("[data-conversation-tabrow]")
					|| document.querySelector("[role='tablist'][aria-label*='对话'], [role='tablist'][aria-label*='Conversation' i]")
					|| document.querySelector("[class*='conversation' i][class*='tab' i][class*='row' i]");
				if (!row) { setHost((prev) => (prev ? null : prev)); return; }
				let el = row.querySelector(":scope > .dshs-chip");
				if (!el) {
					el = document.createElement("div");
					el.className = "dshs-chip";
					el.setAttribute("data-testid", "dsh-skill-list-chip");
					row.appendChild(el);
				}
				const neighbour = row.querySelector(":scope > .dshp-tab-chip, :scope > .dshp-hero-chip");
				if (neighbour && neighbour.nextSibling !== el) row.insertBefore(el, neighbour.nextSibling);
				alignToTabGap(row, el);
				setHost((prev) => (prev === el ? prev : el));
			};
			ensure();
			const observer = typeof MutationObserver !== "undefined" ? new MutationObserver(ensure) : null;
			if (observer) observer.observe(document.body, { childList: true, subtree: true });
			const timer = setInterval(ensure, 1000);
			return () => { dead = true; if (observer) observer.disconnect(); clearInterval(timer); };
		}, []);
		if (!host) return null;
		let portal;
		try {
			const reactDom = require("react-dom");
			portal = reactDom && typeof reactDom.createPortal === "function" ? reactDom.createPortal.bind(reactDom) : null;
		} catch { portal = null; }
		if (portal === null) return null;
		const chip = h("button", {
			type: "button",
			className: "dshs-tab-btn" + (open ? " on" : ""),
			title: "列出当前会话可用的 skills",
			"data-testid": "dsh-skill-list-button",
			onClick: () => setOpen((value) => !value),
		}, "skills");
		return h(react.Fragment, null,
			portal(chip, host),
			open && document.body ? portal(h(SkillPanel, { onClose: () => setOpen(false) }), document.body) : null,
		);
	}

	function apply(ctx) {
		pluginHost = ctx;
		try {
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "dsh-skill-list",
				order: 51,
			}, SkillListMount));
			// Invisible: only captures the composer's insertText face for the panel.
			ctx.slots.inject("conversation.input.right", () => ctx.slots.register({
				name: "conversation.input.right",
				id: "dsh-skill-list-input",
				order: 90,
				inject: (sessionId) => ({ sessionId }),
			}, InputBridge));
		} catch (e) {
			// A failed overlay must never fail the whole client boot.
			try { console.warn("[dsh-skill-list] overlay registration skipped:", e); } catch { /* ignore */ }
		}
	}

	exports.name = name;
	exports.inject = inject;
	exports.apply = apply;
	// Pure pieces, exported for the offline check.
	exports.pickSessionId = pickSessionId;
	exports.listSkills = listSkills;
	exports.loadSkillRows = loadSkillRows;
	exports.insertSkillReference = insertSkillReference;
	exports.alignPadding = alignPadding;
	exports.categoryOf = categoryOf;
	exports.groupSkills = groupSkills;
	exports.InputBridge = InputBridge;
	exports.filterSkills = filterSkills;
	exports.SkillPanel = SkillPanel;
	return module.exports;
	}
});
