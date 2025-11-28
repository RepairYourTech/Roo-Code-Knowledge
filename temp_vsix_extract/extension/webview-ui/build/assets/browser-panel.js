import {
	c as q,
	r as o,
	u as de,
	a as Ce,
	j as s,
	d as Pe,
	G as ne,
	P as Me,
	S as R,
	B as Le,
	O as ie,
	v as L,
	A as ze,
	C as We,
	b as Te,
	e as Fe,
	f as He,
	M as Ve,
	g as De,
	h as Oe,
	i as Ue,
	k as qe,
	K as Ge,
	l as Qe,
	m as _e,
	p as Ke,
	E as Je,
	n as Xe,
	T as $e,
	o as Ze,
	q as Ye,
} from "./chunk-CH3kKxjo.js"
import "./mermaid-bundle.js"
/**
 * @license lucide-react v0.518.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const es = [
		["path", { d: "m12 19-7-7 7-7", key: "1l729n" }],
		["path", { d: "M19 12H5", key: "x3x0zl" }],
	],
	ss = q("arrow-left", es)
/**
 * @license lucide-react v0.518.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const ts = [
		["path", { d: "m11 17-5-5 5-5", key: "13zhaf" }],
		["path", { d: "m18 17-5-5 5-5", key: "h8a8et" }],
	],
	os = q("chevrons-left", ts)
/**
 * @license lucide-react v0.518.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const rs = [
		["path", { d: "m6 17 5-5-5-5", key: "xnjwq" }],
		["path", { d: "m13 17 5-5-5-5", key: "17xmmf" }],
	],
	ns = q("chevrons-right", rs)
/**
 * @license lucide-react v0.518.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const is = [
		["path", { d: "M15 3h6v6", key: "1q9fwt" }],
		["path", { d: "M10 14 21 3", key: "gplh6r" }],
		["path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6", key: "a6xqqp" }],
	],
	as = q("external-link", is),
	ae = (d, a, v, m, y, u, l) => {
		const b = (x) => _e(x, u ?? 0, l ?? 0)
		switch (d) {
			case "launch":
				return "Launched browser"
			case "click":
				return `Clicked at: ${a || b(v)}`
			case "type":
				return `Typed: ${m}`
			case "press":
				return `Pressed key: ${Ke(m)}`
			case "scroll_down":
				return "Scrolled down"
			case "scroll_up":
				return "Scrolled up"
			case "hover":
				return `Hovered at: ${a || b(v)}`
			case "resize":
				return `Resized to: ${y == null ? void 0 : y.split(/[x,]/).join(" x ")}`
			case "close":
				return "Closed browser"
			default:
				return d
		}
	},
	ce = (d) => {
		switch (d) {
			case "click":
				return s.jsx(Qe, { className: "w-4 h-4 opacity-80" })
			case "type":
			case "press":
				return s.jsx(Ge, { className: "w-4 h-4 opacity-80" })
			case "scroll_down":
				return s.jsx(qe, { className: "w-4 h-4 opacity-80" })
			case "scroll_up":
				return s.jsx(Ue, { className: "w-4 h-4 opacity-80" })
			case "launch":
				return s.jsx(Oe, { className: "w-4 h-4 opacity-80" })
			case "close":
				return s.jsx(De, { className: "w-4 h-4 opacity-80" })
			case "resize":
				return s.jsx(Ve, { className: "w-4 h-4 opacity-80" })
			case "hover":
			default:
				return s.jsx(He, { className: "w-4 h-4 opacity-80" })
		}
	},
	cs = o.memo((d) => {
		const {
				messages: a,
				isLast: v,
				onHeightChange: m,
				lastModifiedMessage: y,
				onExpandChange: u,
				fullScreen: l,
			} = d,
			{ t: b } = de(),
			x = o.useRef(0),
			[S, k] = o.useState(!1),
			[z, W] = o.useState(!1),
			[T, pe] = o.useState("all"),
			F = o.useRef(null),
			[ge, he] = o.useState(0),
			[xe, fe] = o.useState(0)
		o.useEffect(() => {
			l && W(!0)
		}, [l]),
			o.useEffect(() => {
				const e = F.current
				if (!e) return
				const t = () => {
					const p = e.getBoundingClientRect()
					he(p.width), fe(p.height)
				}
				t()
				const n = typeof window < "u" && "ResizeObserver" in window ? new ResizeObserver(() => t()) : null
				return (
					n && n.observe(e),
					() => {
						n && n.disconnect()
					}
				)
			}, [])
		let K = d.browserViewportSizeProp || "900x600",
			J = d.isBrowserSessionActiveProp || !1
		try {
			const e = Ce()
			;(K = e.browserViewportSize || "900x600"), (J = e.isBrowserSessionActive || !1)
		} catch {}
		const [H, V] = K.split("x").map(Number),
			we = `${Math.round(H / 2)},${Math.round(V / 2)}`,
			D = o.useMemo(() => {
				const e = [...a].reverse().find((n) => n.say === "api_req_started")
				if (e != null && e.text) {
					const n = JSON.parse(e.text)
					if (n && n.cancelReason !== null) return !0
				}
				return !!(v && (y == null ? void 0 : y.ask) === "api_req_failed")
			}, [a, y, v]),
			j = o.useMemo(() => v && a.some((e) => e.say === "browser_action_result") && !D, [v, a, D]),
			r = o.useMemo(() => {
				const e = []
				return (
					a.forEach((t) => {
						if (t.say === "browser_action")
							try {
								const n = JSON.parse(t.text || "{}"),
									p = a.find((i) => i.say === "browser_action_result" && i.ts > t.ts && i.text !== "")
								if (p) {
									const i = JSON.parse(p.text || "{}")
									e.push({
										url: i.currentUrl,
										screenshot: i.screenshot,
										mousePosition: i.currentMousePosition,
										consoleLogs: i.logs,
										action: n,
										size: n.size,
										viewportWidth: i.viewportWidth,
										viewportHeight: i.viewportHeight,
									})
								} else e.push({ action: n, size: n.size })
							} catch {}
					}),
					e.length === 0 && e.push({}),
					e
				)
			}, [a]),
			[c, E] = o.useState(0),
			B = o.useRef(!1),
			X = o.useRef(!1),
			O = o.useRef(0)
		o.useEffect(() => {
			if (!X.current && r.length > 0) {
				;(X.current = !0), E(r.length - 1), (O.current = r.length)
				return
			}
			r.length > O.current && (c === O.current - 1 && !B.current && E(r.length - 1), (O.current = r.length))
		}, [r.length, c])
		const $ = o.useRef()
		o.useEffect(() => {
			if (typeof d.navigateToPageIndex == "number" && d.navigateToPageIndex !== $.current && r.length > 0) {
				const e = Math.max(0, Math.min(r.length - 1, d.navigateToPageIndex))
				E(e), e === r.length - 1 && (B.current = !1), ($.current = d.navigateToPageIndex)
			}
		}, [d.navigateToPageIndex])
		const G = o.useMemo(() => {
				const e = a.find((t) => t.ask === "browser_action_launch")
				return (e == null ? void 0 : e.text) || ""
			}, [a]),
			f = r[c],
			I = o.useMemo(() => {
				for (let e = r.length - 1; e >= 0; e--) if (r[e].screenshot) return r[e]
			}, [r]),
			Q = o.useMemo(() => {
				for (let e = c; e >= 0; e--) if (r[e].mousePosition) return r[e]
			}, [r, c]),
			w = {
				url: (f == null ? void 0 : f.url) || G,
				mousePosition: (f == null ? void 0 : f.mousePosition) || (Q == null ? void 0 : Q.mousePosition) || we,
				consoleLogs: f == null ? void 0 : f.consoleLogs,
				screenshot: (f == null ? void 0 : f.screenshot) || (I == null ? void 0 : I.screenshot),
			},
			U = o.useMemo(() => {
				const e = { debug: 0, info: 0, warn: 0, error: 0, log: 0 },
					t = { debug: [], info: [], warn: [], error: [], log: [] }
				return (
					(w.consoleLogs || "").split(/\r?\n/).forEach((p) => {
						const i = p.trim()
						if (!i) return
						const h = /^\[([^\]]+)\]\s*/i.exec(i)
						let g = ((h == null ? void 0 : h[1]) || "").toLowerCase()
						g === "warning" && (g = "warn"),
							["debug", "info", "warn", "error", "log"].includes(g) || (g = "log"),
							e[g]++,
							t[g].push(p)
					}),
					{ counts: e, byType: t }
				)
			}, [w.consoleLogs]),
			ve = o.useMemo(() => {
				if (!w.consoleLogs) return b("chat:browser.noNewLogs")
				if (T === "all") return w.consoleLogs
				const e = U.byType[T]
				return e.length
					? e.join(`
`)
					: b("chat:browser.noNewLogs")
			}, [w.consoleLogs, T, U, b]),
			be = [
				{ key: "all", label: "All" },
				{ key: "debug", label: "Debug" },
				{ key: "info", label: "Info" },
				{ key: "warn", label: "Warn" },
				{ key: "error", label: "Error" },
				{ key: "log", label: "Log" },
			],
			Ae = (600 / 900) * 100
		let C, P
		f != null && f.screenshot
			? ((C = f.viewportWidth ?? H), (P = f.viewportHeight ?? V))
			: I
				? ((C = I.viewportWidth ?? H), (P = I.viewportHeight ?? V))
				: ((C = H), (P = V))
		const me = o.useMemo(() => {
				var e
				return (e = r[c]) == null ? void 0 : e.action
			}, [r, c]),
			_ = o.useMemo(() => a.filter((t) => t.say === "browser_action").at(-1), [a]),
			Z = J,
			ye = o.useMemo(() => {
				if (!_ || D) return !1
				const e = [...a].reverse().find((t) => t.say === "browser_action_result")
				return e ? _.ts > e.ts : !0
			}, [a, _, D]),
			Y = o.useMemo(() => {
				let e = 0
				return (
					a.forEach((t) => {
						if (t.say === "api_req_started" && t.text)
							try {
								const n = JSON.parse(t.text)
								n.cost && typeof n.cost == "number" && (e += n.cost)
							} catch {}
					}),
					e
				)
			}, [a]),
			ee = o.useRef(null),
			[N, je] = o.useState(0)
		o.useEffect(() => {
			const e = ee.current
			if (!e) return
			let t = !0
			const n = (i) => {
					t && je(i)
				},
				p =
					typeof window < "u" && "ResizeObserver" in window
						? new ResizeObserver((i) => {
								var g
								const h = i[0]
								n(
									((g = h == null ? void 0 : h.contentRect) == null ? void 0 : g.height) ??
										e.getBoundingClientRect().height,
								)
							})
						: null
			return (
				n(e.getBoundingClientRect().height),
				p && p.observe(e),
				() => {
					;(t = !1), p && p.disconnect()
				}
			)
		}, [])
		const Se = () =>
				s.jsxs("div", {
					style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 0, userSelect: "none" },
					children: [
						s.jsx(ne, {
							className: "w-4 h-4 shrink-0",
							style: { opacity: 0.7, color: Z ? "#4ade80" : void 0, cursor: l ? "default" : "pointer" },
							"aria-label": "Browser interaction",
							...(l
								? {}
								: {
										onClick: () =>
											W((e) => {
												const t = !e
												return u == null || u(t), t
											}),
									}),
						}),
						s.jsxs("span", {
							...(l
								? {}
								: {
										onClick: () =>
											W((e) => {
												const t = !e
												return u == null || u(t), t
											}),
									}),
							style: {
								flex: 1,
								fontSize: 13,
								fontWeight: 500,
								lineHeight: "22px",
								color: "var(--vscode-editor-foreground)",
								cursor: l ? "default" : "pointer",
								display: "flex",
								alignItems: "center",
								gap: 8,
							},
							children: [
								b("chat:browser.session"),
								ye &&
									s.jsx("span", {
										className: "ml-1 flex items-center",
										"aria-hidden": "true",
										children: s.jsx(Me, {}),
									}),
								r.length > 0 &&
									s.jsxs("span", {
										style: { fontSize: 11, opacity: 0.6, fontWeight: 400 },
										children: [c + 1, "/", r.length],
									}),
								s.jsx("span", {
									style: {
										display: "inline-flex",
										alignItems: "center",
										gap: 6,
										fontSize: 12,
										color: "var(--vscode-descriptionForeground)",
										fontWeight: 400,
									},
									children: (() => {
										var i, h, g
										const e = me,
											t = (i = r[c]) == null ? void 0 : i.size,
											n = (h = r[c]) == null ? void 0 : h.viewportWidth,
											p = (g = r[c]) == null ? void 0 : g.viewportHeight
										return e
											? s.jsxs(s.Fragment, {
													children: [
														ce(e.action),
														s.jsx("span", {
															children: ae(
																e.action,
																e.executedCoordinate,
																e.coordinate,
																e.text,
																t,
																n,
																p,
															),
														}),
													],
												})
											: G
												? s.jsxs(s.Fragment, {
														children: [
															ce("launch"),
															s.jsx("span", {
																children: ae("launch", void 0, G, void 0),
															}),
														],
													})
												: null
									})(),
								}),
							],
						}),
						Y > 0 &&
							s.jsxs("div", {
								className:
									"text-xs text-vscode-dropdown-foreground border-vscode-dropdown-border/50 border px-1.5 py-0.5 rounded-lg",
								style: { opacity: 0.4, height: "22px", display: "flex", alignItems: "center" },
								children: ["$", Y.toFixed(4)],
							}),
						!l &&
							s.jsx("span", {
								onClick: () =>
									W((e) => {
										const t = !e
										return u == null || u(t), t
									}),
								className: `codicon ${z ? "codicon-chevron-up" : "codicon-chevron-down"}`,
								style: {
									fontSize: 13,
									fontWeight: 500,
									lineHeight: "22px",
									color: "var(--vscode-editor-foreground)",
									cursor: "pointer",
									display: "inline-block",
									transition: "transform 150ms ease",
								},
							}),
						Z &&
							!l &&
							s.jsx(R, {
								content: "Disconnect session",
								children: s.jsx(Le, {
									variant: "ghost",
									size: "icon",
									onClick: (e) => {
										e.stopPropagation(), L.postMessage({ type: "killBrowserSession" })
									},
									"aria-label": "Disconnect session",
									children: s.jsx(ie, { className: "size-4" }),
								}),
							}),
					],
				}),
			ke = () =>
				z
					? s.jsxs("div", {
							style: {
								marginTop: l ? 0 : 6,
								background: "var(--vscode-editor-background)",
								border: "1px solid var(--vscode-panel-border)",
								borderRadius: l ? 0 : 6,
								overflow: "hidden",
								height: l ? "100%" : void 0,
								display: l ? "flex" : void 0,
								flexDirection: l ? "column" : void 0,
							},
							children: [
								s.jsxs("div", {
									style: {
										padding: "6px 8px",
										display: "flex",
										alignItems: "center",
										gap: "8px",
										borderBottom: "1px solid var(--vscode-panel-border)",
										background: "var(--vscode-editor-background)",
									},
									children: [
										s.jsx(R, {
											content: "Go to beginning",
											children: s.jsx("button", {
												onClick: (e) => {
													e.stopPropagation(), (B.current = !0), E(0)
												},
												disabled: c === 0 || j,
												style: {
													background: "none",
													border: "1px solid var(--vscode-panel-border)",
													borderRadius: 4,
													cursor: c === 0 || j ? "not-allowed" : "pointer",
													opacity: c === 0 || j ? 0.4 : 0.85,
													padding: "4px",
													display: "flex",
													alignItems: "center",
													color: "var(--vscode-foreground)",
												},
												"aria-label": "Go to beginning",
												children: s.jsx(os, { className: "w-4 h-4" }),
											}),
										}),
										s.jsx(R, {
											content: "Back",
											children: s.jsx("button", {
												onClick: (e) => {
													e.stopPropagation(), (B.current = !0), E((t) => Math.max(0, t - 1))
												},
												disabled: c === 0 || j,
												style: {
													background: "none",
													border: "1px solid var(--vscode-panel-border)",
													borderRadius: 4,
													cursor: c === 0 || j ? "not-allowed" : "pointer",
													opacity: c === 0 || j ? 0.4 : 0.85,
													padding: "4px",
													display: "flex",
													alignItems: "center",
													color: "var(--vscode-foreground)",
												},
												"aria-label": "Back",
												children: s.jsx(ss, { className: "w-4 h-4" }),
											}),
										}),
										s.jsx(R, {
											content: "Forward",
											children: s.jsx("button", {
												onClick: (e) => {
													e.stopPropagation()
													const t = Math.min(r.length - 1, c + 1)
													;(B.current = t !== r.length - 1), E(t)
												},
												disabled: c === r.length - 1 || j,
												style: {
													background: "none",
													border: "1px solid var(--vscode-panel-border)",
													borderRadius: 4,
													cursor: c === r.length - 1 || j ? "not-allowed" : "pointer",
													opacity: c === r.length - 1 || j ? 0.4 : 0.85,
													padding: "4px",
													display: "flex",
													alignItems: "center",
													color: "var(--vscode-foreground)",
												},
												"aria-label": "Forward",
												children: s.jsx(ze, { className: "w-4 h-4" }),
											}),
										}),
										s.jsx(R, {
											content: "Go to end",
											children: s.jsx("button", {
												onClick: (e) => {
													e.stopPropagation(), (B.current = !1), E(r.length - 1)
												},
												disabled: c === r.length - 1 || j,
												style: {
													background: "none",
													border: "1px solid var(--vscode-panel-border)",
													borderRadius: 4,
													cursor: c === r.length - 1 || j ? "not-allowed" : "pointer",
													opacity: c === r.length - 1 || j ? 0.4 : 0.85,
													padding: "4px",
													display: "flex",
													alignItems: "center",
													color: "var(--vscode-foreground)",
												},
												"aria-label": "Go to end",
												children: s.jsx(ns, { className: "w-4 h-4" }),
											}),
										}),
										s.jsxs("div", {
											role: "group",
											"aria-label": "Address bar",
											style: {
												flex: 1,
												display: "flex",
												alignItems: "center",
												gap: 8,
												border: "1px solid var(--vscode-panel-border)",
												borderRadius: 999,
												padding: "4px 10px",
												background: "var(--vscode-input-background)",
												color: "var(--vscode-descriptionForeground)",
												minHeight: 26,
												overflow: "hidden",
											},
											children: [
												s.jsx(ne, { className: "w-3 h-3 shrink-0 opacity-60" }),
												s.jsx("span", {
													style: {
														fontSize: 12,
														lineHeight: "18px",
														textOverflow: "ellipsis",
														overflow: "hidden",
														whiteSpace: "nowrap",
														color: "var(--vscode-foreground)",
													},
													children: w.url || "about:blank",
												}),
											],
										}),
										s.jsx(R, {
											content: "Disconnect session",
											children: s.jsx("button", {
												onClick: (e) => {
													e.stopPropagation(), L.postMessage({ type: "killBrowserSession" })
												},
												style: {
													background: "none",
													border: "1px solid var(--vscode-panel-border)",
													borderRadius: 4,
													cursor: "pointer",
													opacity: 0.85,
													padding: "4px",
													display: "flex",
													alignItems: "center",
													color: "var(--vscode-foreground)",
												},
												"aria-label": "Disconnect session",
												children: s.jsx(ie, { className: "w-4 h-4" }),
											}),
										}),
										s.jsx(R, {
											content: "Open in external browser",
											children: s.jsx("button", {
												onClick: (e) => {
													e.stopPropagation(),
														w.url && L.postMessage({ type: "openExternal", url: w.url })
												},
												style: {
													background: "none",
													border: "1px solid var(--vscode-panel-border)",
													borderRadius: 4,
													cursor: w.url ? "pointer" : "not-allowed",
													opacity: w.url ? 0.85 : 0.4,
													padding: "4px",
													display: "flex",
													alignItems: "center",
													color: "var(--vscode-foreground)",
												},
												"aria-label": "Open external",
												disabled: !w.url,
												children: s.jsx(as, { className: "w-4 h-4" }),
											}),
										}),
										s.jsx(R, {
											content: "Copy URL",
											children: s.jsx("button", {
												onClick: async (e) => {
													e.stopPropagation()
													try {
														await navigator.clipboard.writeText(w.url || "")
													} catch {}
												},
												style: {
													background: "none",
													border: "1px solid var(--vscode-panel-border)",
													borderRadius: 4,
													cursor: "pointer",
													opacity: 0.85,
													padding: "4px",
													display: "flex",
													alignItems: "center",
													color: "var(--vscode-foreground)",
												},
												"aria-label": "Copy URL",
												children: s.jsx(We, { className: "w-4 h-4" }),
											}),
										}),
									],
								}),
								s.jsxs("div", {
									"data-testid": "screenshot-container",
									ref: F,
									style: {
										width: "100%",
										position: "relative",
										backgroundColor: "var(--vscode-input-background)",
										borderBottom: "1px solid var(--vscode-panel-border)",
										...(l ? { flex: 1, minHeight: 0 } : { paddingBottom: `${Ae.toFixed(2)}%` }),
									},
									children: [
										w.screenshot
											? s.jsx("img", {
													src: w.screenshot,
													alt: b("chat:browser.screenshot"),
													style: {
														position: "absolute",
														top: 0,
														left: 0,
														width: "100%",
														height: "100%",
														objectFit: "contain",
														objectPosition: "top center",
														cursor: "pointer",
													},
													onClick: () =>
														L.postMessage({ type: "openImage", text: w.screenshot }),
												})
											: s.jsx("div", {
													style: {
														position: "absolute",
														top: "50%",
														left: "50%",
														transform: "translate(-50%, -50%)",
													},
													children: s.jsx("span", {
														className: "codicon codicon-globe",
														style: {
															fontSize: "80px",
															color: "var(--vscode-descriptionForeground)",
														},
													}),
												}),
										w.mousePosition &&
											(() => {
												var oe, re
												const e =
														ge ||
														(((oe = F.current) == null ? void 0 : oe.clientWidth) ?? 0),
													t =
														xe ||
														(((re = F.current) == null ? void 0 : re.clientHeight) ?? 0)
												if (e <= 0 || t <= 0)
													return s.jsx(le, {
														style: {
															position: "absolute",
															top: "0px",
															left: "0px",
															zIndex: 2,
															pointerEvents: "none",
														},
													})
												const n = C / P,
													p = e / t
												let i = e,
													h = t,
													g = 0,
													M = 0
												p > n
													? ((h = t), (i = t * n), (g = (e - i) / 2), (M = 0))
													: ((i = e), (h = e / n), (g = 0), (M = 0))
												const A =
														/^\s*(\d+)\s*,\s*(\d+)(?:\s*@\s*(\d+)\s*[x,]\s*(\d+))?\s*$/.exec(
															w.mousePosition || "",
														),
													Ee = parseInt((A == null ? void 0 : A[1]) || "0", 10),
													Be = parseInt((A == null ? void 0 : A[2]) || "0", 10),
													se = A != null && A[3] ? parseInt(A[3], 10) : C,
													te = A != null && A[4] ? parseInt(A[4], 10) : P,
													Ie = g + (se > 0 ? (Ee / se) * i : 0),
													Ne = M + (te > 0 ? (Be / te) * h : 0)
												return s.jsx(le, {
													style: {
														position: "absolute",
														top: `${Ne}px`,
														left: `${Ie}px`,
														zIndex: 2,
														pointerEvents: "none",
														transition: "top 0.15s ease-out, left 0.15s ease-out",
													},
												})
											})(),
									],
								}),
								s.jsxs("div", {
									style: { padding: "8px 10px", marginTop: l ? "auto" : void 0 },
									children: [
										s.jsxs("div", {
											onClick: (e) => {
												e.stopPropagation(), k((t) => !t)
											},
											className:
												"text-vscode-editor-foreground/70 hover:text-vscode-editor-foreground transition-colors",
											style: {
												display: "flex",
												alignItems: "center",
												gap: "8px",
												marginBottom: S ? "6px" : 0,
												cursor: "pointer",
											},
											children: [
												s.jsx(Te, { className: "w-3" }),
												s.jsx("span", {
													className: "text-xs",
													style: { fontWeight: 500 },
													children: b("chat:browser.consoleLogs"),
												}),
												s.jsxs("div", {
													onClick: (e) => e.stopPropagation(),
													style: {
														display: "flex",
														alignItems: "center",
														gap: 6,
														marginLeft: "auto",
													},
													children: [
														be.map(({ key: e, label: t }) => {
															const n = e === "all",
																p = n
																	? Object.values(U.counts).reduce((g, M) => g + M, 0)
																	: U.counts[e],
																i = T === e,
																h = p === 0
															return s.jsxs(
																"button",
																{
																	onClick: () => {
																		k(!0),
																			pe(n ? "all" : (g) => (g === e ? "all" : e))
																	},
																	disabled: h,
																	title: `${t}: ${p}`,
																	style: {
																		border: "1px solid var(--vscode-panel-border)",
																		borderRadius: 999,
																		padding: "0 6px",
																		height: 18,
																		lineHeight: "16px",
																		fontSize: 10,
																		color: "var(--vscode-foreground)",
																		background: i
																			? "var(--vscode-editor-selectionBackground)"
																			: "transparent",
																		opacity: h ? 0.35 : 0.85,
																		cursor: h ? "not-allowed" : "pointer",
																	},
																	children: [t, ": ", p],
																},
																e,
															)
														}),
														s.jsx("span", {
															onClick: () => k((e) => !e),
															className: `codicon codicon-chevron-${S ? "down" : "right"}`,
															style: { marginLeft: 6 },
														}),
													],
												}),
											],
										}),
										S &&
											s.jsx("div", {
												style: { marginTop: "6px" },
												children: s.jsx(Fe, { source: ve, language: "shell" }),
											}),
									],
								}),
							],
						})
					: null,
			Re = s.jsxs("div", {
				ref: ee,
				style: {
					padding: "6px 10px",
					background: "var(--vscode-editor-background,transparent)",
					height: "100%",
				},
				children: [s.jsx(Se, {}), s.jsx(ke, {})],
			})
		return (
			o.useEffect(() => {
				const e = x.current === 0
				v && N !== 0 && N !== 1 / 0 && N !== x.current && (e || m == null || m(N > x.current), (x.current = N))
			}, [N, v, m]),
			Re
		)
	}, Pe),
	le = ({ style: d }) => {
		const { t: a } = de()
		return s.jsx("img", {
			src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAYCAYAAAAVibZIAAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAFaADAAQAAAABAAAAGAAAAADwi9a/AAADGElEQVQ4EZ2VbUiTURTH772be/PxZdsz3cZwC4RVaB8SAjMpxQwSWZbQG/TFkN7oW1Df+h6IRV9C+hCpKUSIZUXOfGM5tAKViijFFEyfZ7Ol29S1Pbdzl8Uw9+aBu91zzv3/nt17zt2DEZjBYOAkKrtFMXIghAWM8U2vMN/FctsxGRMpM7NbEEYNMM2CYUSInlJx3OpawO9i+XSNQYkmk2uFb9njzkcfVSr1p/GJiQKMULVaw2WuBv296UKRxWJR6wxGCmM1EAhSNppv33GBH9qI32cPTAtss9lUm6EM3N7R+RbigT+5/CeosFCZKpjEW+iorS1pb30wDUXzQfHqtD/9L3ieZ2ee1OJCmbL8QHnRs+4uj0wmW4QzrpCwvJ8zGg3JqAmhTLynuLiwv8/5KyND8Q3cEkUEDWu15oJE4KRQJt5hs1rcriGNRqP+DK4dyyWXXm/aFQ+cEpSJ8/LyDGPuEZNOmzsOroUSOqzXG/dtBU4ZysTZYKNut91sNo2Cq6cE9enz86s2g9OCMrFSqVC5hgb32u072W3jKMU90Hb1seC0oUwsB+t92bO/rKx0EFGkgFCnjjc1/gVvC8rE0L+4o63t4InjxwbAJQjTe3qD8QrLkXA4DC24fWtuajp06cLFYSBIFKGmXKPRRmAnME9sPt+yLwIWb9WN69fKoTneQz4Dh2mpPNkvfeV0jjecb9wNAkwIEVQq5VJOds4Kb+DXoAsiVquVwI1Dougpij6UyGYx+5cKroeDEFibm5lWRRMbH1+npmYrq6qhwlQHIbajZEf1fElcqGGFpGg9HMuKzpfBjhytCTMgkJ56RX09zy/ysENTBElmjIgJnmNChJqohDVQqpEfwkILE8v/o0GAnV9F1eEvofVQCbiTBEXOIPQh5PGgefDZeAcjrpGZjULBr/m3tZOnz7oEQWRAQZLjWlEU/XEJWySiILgRc5Cz1DkcAyuBFcnpfF0JiXWKpcolQXizhS5hKAqFpr0MVbgbuxJ6+5xX+P4wNpbqPPrugZfbmIbLmgQR3Aw8QSi66hUXulOFbF73GxqjE5BNXWNeAAAAAElFTkSuQmCC",
			style: { width: "17px", height: "22px", ...d },
			alt: a("chat:browser.cursor"),
			"aria-label": a("chat:browser.cursor"),
		})
	},
	ue = o.createContext(void 0),
	ls = ({ children: d }) => {
		const [a, v] = o.useState({ browserViewportSize: "900x600", isBrowserSessionActive: !1, language: "en" }),
			m = o.useCallback((y) => {
				const u = y.data
				switch (u.type) {
					case "state":
						u.state &&
							v((l) => {
								var b, x, S
								return {
									...l,
									browserViewportSize:
										((b = u.state) == null ? void 0 : b.browserViewportSize) || "900x600",
									isBrowserSessionActive:
										((x = u.state) == null ? void 0 : x.isBrowserSessionActive) || !1,
									language: ((S = u.state) == null ? void 0 : S.language) || "en",
								}
							})
						break
					case "browserSessionUpdate":
						u.isBrowserSessionActive !== void 0 &&
							v((l) => ({ ...l, isBrowserSessionActive: u.isBrowserSessionActive || !1 }))
						break
				}
			}, [])
		return (
			o.useEffect(
				() => (
					window.addEventListener("message", m),
					() => {
						window.removeEventListener("message", m)
					}
				),
				[m],
			),
			s.jsx(ue.Provider, { value: a, children: d })
		)
	},
	ds = () => {
		const d = o.useContext(ue)
		if (d === void 0) throw new Error("useBrowserPanelState must be used within a BrowserPanelStateProvider")
		return d
	},
	us = () => {
		const { browserViewportSize: d, isBrowserSessionActive: a } = ds(),
			[v, m] = o.useState({ messages: [] }),
			[y, u] = o.useState(void 0),
			[l, b] = o.useState({})
		return (
			o.useEffect(() => {
				const x = (S) => {
					const k = S.data
					switch (k.type) {
						case "browserSessionUpdate":
							k.browserSessionMessages && m((z) => ({ ...z, messages: k.browserSessionMessages || [] }))
							break
						case "browserSessionNavigate":
							typeof k.stepIndex == "number" && k.stepIndex >= 0 && u(k.stepIndex)
							break
					}
				}
				return (
					window.addEventListener("message", x),
					() => {
						window.removeEventListener("message", x)
					}
				)
			}, []),
			s.jsx("div", {
				className:
					"fixed top-0 left-0 right-0 bottom-0 flex flex-col overflow-hidden bg-vscode-editor-background",
				children: s.jsx(cs, {
					messages: v.messages,
					isLast: !0,
					lastModifiedMessage: v.messages.at(-1),
					isStreaming: !1,
					isExpanded: (x) => l[x] ?? !1,
					onToggleExpand: (x) => {
						b((S) => ({ ...S, [x]: !S[x] }))
					},
					fullScreen: !0,
					browserViewportSizeProp: d,
					isBrowserSessionActiveProp: a,
					navigateToPageIndex: y,
				}),
			})
		)
	},
	ps = () => (
		o.useEffect(() => {
			try {
				L.postMessage({ type: "webviewDidLaunch" })
			} catch {}
		}, []),
		s.jsx(Je, {
			children: s.jsx(Xe, {
				children: s.jsx($e, { children: s.jsx(Ze, { children: s.jsx(ls, { children: s.jsx(us, {}) }) }) }),
			}),
		})
	)
Ye.createRoot(document.getElementById("root")).render(s.jsx(o.StrictMode, { children: s.jsx(ps, {}) }))
//# sourceMappingURL=browser-panel.js.map
