window.__ModuleLoader__.load({
	id: "dsh-files-explorer",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const jsx = require("react/jsx-runtime");
		const react = require("react");
		const reactDom = require("react-dom");
		const primitives = require("@deepseek-ai/dsh-client-ui-primitives");

		const css = [
			".dshFx_host{position:fixed;inset:0;pointer-events:none;z-index:80}",
			".dshFx_host [data-files-explorer-menu]{pointer-events:auto}"
		].join("");
		const tagId = "dsh-files-explorer/menu.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-files-explorer";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}

		function paneOfTab(layout, tabId) {
			if (layout == null || tabId == null) return;
			for (const [id, node] of Object.entries(layout.nodes ?? {})) {
				if (node?.kind === "pane" && Array.isArray(node.tabs) && node.tabs.includes(tabId)) {
					return { id, ...node };
				}
			}
		}

		function dockPaneIds(layout) {
			if (layout == null) return [];
			return Object.entries(layout.nodes ?? {}).filter(([, node]) => node?.kind === "pane" && node.host === "dock").map(([id]) => id);
		}

		function getPane(layout, paneId) {
			const node = layout?.nodes?.[paneId];
			if (node == null || node.kind !== "pane") return;
			return { id: paneId, ...node };
		}

		function relativeToRoot(root, path) {
			const r = String(root ?? "").replace(/\\/g, "/").replace(/\/+$/, "");
			const p = String(path ?? "").replace(/\\/g, "/");
			if (r === "") return p;
			if (p === r) return ".";
			if (p.startsWith(`${r}/`)) return p.slice(r.length + 1);
			return p;
		}

		function basename(path) {
			const trimmed = String(path ?? "").replace(/[/\\]+$/, "");
			const cut = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
			return cut < 0 ? trimmed : trimmed.slice(cut + 1);
		}

		function isHtmlPath(path) {
			return /\.(html?|xhtml)$/i.test(path);
		}

		async function copyText(text) {
			try {
				await navigator.clipboard.writeText(text);
				return;
			} catch {}
			const field = document.createElement("textarea");
			field.value = text;
			field.setAttribute("readonly", "");
			field.style.position = "fixed";
			field.style.left = "-9999px";
			document.body.appendChild(field);
			field.select();
			document.execCommand("copy");
			field.remove();
		}

		function pointRect(x, y) {
			return {
				x,
				y,
				width: 0,
				height: 0,
				top: y,
				left: x,
				right: x,
				bottom: y,
				toJSON() {
					return this;
				}
			};
		}

		function decodeBase64Bytes(data) {
			const binary = atob(data);
			const bytes = new Uint8Array(binary.length);
			for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
			return bytes;
		}

		function previewPaneBeside(controller, sessionId, filesTabId) {
			const layout = typeof controller.layoutOf === "function" ? controller.layoutOf(sessionId) : undefined;
			if (layout === undefined) return;
			const fromPane = paneOfTab(layout, filesTabId);
			if (fromPane == null || fromPane.host !== "dock") return;
			const other = dockPaneIds(layout).find((id) => id !== fromPane.id);
			if (other !== undefined) return other;
			if (typeof controller.split === "function") return controller.split(fromPane.id);
		}

		function wrapFileTreeSplit(controller) {
			if (controller == null || typeof controller.openResourceIn !== "function" || controller.__dshFilesExplorerSplit) return;
			const original = controller.openResourceIn.bind(controller);
			controller.openResourceIn = function openResourceIn(sessionId, address, options = {}) {
				const isFile = typeof address === "string" && address.startsWith("dsh-resource://file/");
				const layout = typeof controller.layoutOf === "function" ? controller.layoutOf(sessionId) : undefined;
				const filesTab = layout == null ? undefined : Object.values(layout.tabs ?? {}).find((tab) => tab?.kind === "files");
				const filesPane = filesTab === undefined ? undefined : paneOfTab(layout, filesTab.id);
				const targetPane = options.paneId ?? layout?.activePaneId;
				const landsOnFiles = isFile && filesPane != null && targetPane === filesPane.id && options.replaceTab === undefined;
				if (landsOnFiles) {
					const beside = previewPaneBeside(controller, sessionId, filesTab.id);
					if (beside !== undefined) {
						let replaceTab;
						try {
							const latest = controller.layoutOf(sessionId);
							const pane = getPane(latest, beside);
							const only = pane?.tabs?.length === 1 ? pane.tabs[0] : undefined;
							const onlyTab = only === undefined ? undefined : latest?.tabs?.[only];
							if (onlyTab != null && (onlyTab.kind === "files" || onlyTab.kind === "guide")) replaceTab = only;
						} catch {}
						return original(sessionId, address, {
							...options,
							paneId: beside,
							...replaceTab === undefined ? {} : { replaceTab }
						});
					}
				}
				return original(sessionId, address, options);
			};
			controller.__dshFilesExplorerSplit = true;
		}

		function sessionSnapshot(ctx) {
			return ctx.sessions?.list?.getSnapshot?.() ?? {};
		}

		function currentSession(ctx) {
			const list = sessionSnapshot(ctx);
			const id = list.current;
			return {
				id,
				cwd: id === undefined ? undefined : list.byId?.[id]?.cwd
			};
		}

		function workspaceRoot(cwd) {
			return document.querySelector("[data-files-root]")?.getAttribute("data-files-root") || cwd || "";
		}

		function menuItems(kind, path) {
			const html = kind === "file" && isHtmlPath(path);
			const items = [];
			if (kind === "file") {
				items.push({
					id: "open",
					label: "Open",
					icon: jsx.jsx(primitives.IconRightUpOutline16, { size: 16 })
				});
				if (html) items.push({
					id: "open-tab",
					label: "Open in New Tab",
					icon: jsx.jsx(primitives.IconRightUpOutline16, { size: 16 })
				});
				items.push({ type: "separator", id: "sep-open" });
			}
			items.push(
				{
					id: "copy-path",
					label: "Copy Path",
					icon: jsx.jsx(primitives.IconCopyOutline16, {})
				},
				{
					id: "copy-relative",
					label: "Copy Relative Path",
					icon: jsx.jsx(primitives.IconCopyOutline16, {})
				},
				{
					id: "copy-name",
					label: "Copy Name",
					icon: jsx.jsx(primitives.IconCopyOutline16, {})
				},
				{ type: "separator", id: "sep-copy" },
				{
					id: "reveal",
					label: "Reveal in Finder",
					icon: jsx.jsx(primitives.IconFolderOpenOutline16, {})
				},
				{
					id: "open-app",
					label: kind === "directory" ? "Open in Finder" : "Open with Default App",
					icon: jsx.jsx(primitives.IconFolderOpenOutline16, {})
				}
			);
			return items;
		}

		function FilesExplorerMenu({ open, x, y, items, onSelect, onClose }) {
			const getAnchorRect = react.useCallback(() => pointRect(x, y), [x, y]);
			return jsx.jsx("div", {
				"data-files-explorer-menu": true,
				children: jsx.jsx(primitives.Menu, {
					open,
					items,
					onSelect,
					onClose,
					portal: true,
					anchor: null,
					side: "right",
					align: "start",
					getAnchorRect
				})
			});
		}

		function mountMenu(onSelect) {
			let host = document.querySelector("[data-files-explorer-host]");
			if (host == null) {
				host = document.createElement("div");
				host.className = "dshFx_host";
				host.dataset.filesExplorerHost = "";
				document.body.appendChild(host);
			}
			const root = host.__dshFilesExplorerRoot ?? (reactDom.createRoot ? reactDom.createRoot(host) : undefined);
			if (root == null) throw new Error("dsh-files-explorer: ReactDOM.createRoot is unavailable");
			host.__dshFilesExplorerRoot = root;
			let state = { open: false, x: 0, y: 0, items: [] };
			const render = () => {
				root.render(jsx.jsx(FilesExplorerMenu, {
					open: state.open,
					x: state.x,
					y: state.y,
					items: state.items,
					onSelect,
					onClose: () => {
						state = { ...state, open: false };
						render();
					}
				}));
			};
			render();
			return {
				show(next) {
					state = { open: true, ...next };
					render();
				},
				hide() {
					state = { ...state, open: false };
					render();
				}
			};
		}

		async function openHtmlInTab(ctx, sessionId, path) {
			const result = await ctx.remote.workspaceFiles.readAll(sessionId, path);
			if (result?.ok && typeof result.value?.data === "string") {
				const blob = new Blob([decodeBase64Bytes(result.value.data)], { type: "text/html;charset=utf-8" });
				const url = URL.createObjectURL(blob);
				const opened = window.open(url, "_blank", "noopener,noreferrer");
				setTimeout(() => URL.revokeObjectURL(url), 120000);
				if (opened != null) return;
			}
			await ctx.remote.session.openWorkspacePath({ path });
		}

		const inject = [
			"sidebarRight",
			"sessions",
			"remote",
			"remote.workspaceFiles",
			"remote.session"
		];

		function apply(ctx) {
			wrapFileTreeSplit(ctx.sidebarRight);
			const run = async (id, path, kind) => {
				const session = currentSession(ctx);
				const root = workspaceRoot(session.cwd);
				if (id === "open") {
					const row = document.querySelector(`[data-files-path=${JSON.stringify(path)}] [class*="_row"], [data-files-path=${JSON.stringify(path)}] button`);
					if (row instanceof HTMLElement) row.click();
					return;
				}
				if (id === "copy-path") {
					await copyText(path);
					return;
				}
				if (id === "copy-relative") {
					await copyText(relativeToRoot(root, path));
					return;
				}
				if (id === "copy-name") {
					await copyText(basename(path));
					return;
				}
				if (id === "reveal") {
					await ctx.remote.session.openWorkspacePath({ path, action: "reveal" });
					return;
				}
				if (id === "open-app") {
					await ctx.remote.session.openWorkspacePath({ path });
					return;
				}
				if (id === "open-tab" && session.id !== undefined) {
					await openHtmlInTab(ctx, session.id, path);
				}
			};
			let menu;
			const onSelect = (id) => {
				const pending = menu?.pending;
				menu?.hide();
				if (pending == null) return;
				void run(id, pending.path, pending.kind).catch(() => {});
			};
			menu = mountMenu(onSelect);
			const onContextMenu = (event) => {
				const row = event.target instanceof Element ? event.target.closest("[data-files-entry][data-files-path]") : null;
				if (row == null) return;
				const kind = row.getAttribute("data-files-entry");
				const path = row.getAttribute("data-files-path");
				if ((kind !== "file" && kind !== "directory") || !path) return;
				event.preventDefault();
				event.stopPropagation();
				menu.pending = { kind, path };
				menu.show({
					x: event.clientX,
					y: event.clientY,
					items: menuItems(kind, path)
				});
			};
			document.addEventListener("contextmenu", onContextMenu, true);
			ctx.effect(() => () => {
				document.removeEventListener("contextmenu", onContextMenu, true);
			}, "dsh-files-explorer: context menu");
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
