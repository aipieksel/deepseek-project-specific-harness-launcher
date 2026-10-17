window.__ModuleLoader__.load({
	id: "dsh-agents-pro",
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
		const tagId = "dsh-agents-pro/menu.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-agents-pro";
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

		function wrapFileTreeSplit(controller, ctx) {
			if (controller == null || typeof controller.openResourceIn !== "function" || controller.__dshFilesExplorerSplit) return;
			const original = controller.openResourceIn.bind(controller);
			controller.openResourceIn = function openResourceIn(sessionId, address, options = {}) {
                const isFile = typeof address === "string" && address.startsWith("dsh-resource://file/");
				const layout = typeof controller.layoutOf === "function" ? controller.layoutOf(sessionId) : undefined;
				const filesTab = layout == null ? undefined : Object.values(layout.tabs ?? {}).find((tab) => tab?.kind === "files");
				const filesPane = filesTab === undefined ? undefined : paneOfTab(layout, filesTab.id);
				const targetPane = options.paneId ?? layout?.activePaneId;
				const landsOnFiles = isFile && filesPane != null && targetPane === filesPane.id && options.replaceTab === undefined;
                if (landsOnFiles && dockPaneIds(layout).length===1 && !options.agentsProRoomReady) {
                    ctx.layout.panels.setRightbar(Math.max(800,window.innerWidth*.45));
                    requestAnimationFrame(()=>requestAnimationFrame(()=>{
                        const {agentsProRoomReady,...nextOptions}=options;
                        controller.openResourceIn(sessionId,address,{...nextOptions,agentsProRoomReady:true});
                    }));
                    return;
                }
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
                            const existing = pane?.tabs?.find(id => latest.tabs[id]?.contentId === address);
                            if (existing) replaceTab = existing;
						} catch {}
						return original(sessionId, address, {
							...options,
							paneId: beside,
                            revealIfOpened: false,
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
			const items = [{id:"add-chat",label:"Add to Chat"},{id:"comment",label:"Add Comment"},{id:"voice-comment",label:"Add Comment with Voice"},{type:"separator",id:"sep-pro"}];
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
			if (root == null) throw new Error("dsh-agents-pro: ReactDOM.createRoot is unavailable");
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
			"remote.session", "layout", "locale", "slots", "conversation", "documentPreviews"
		];

        function installFileLinks(ctx) {
          const markdown=primitives.MarkdownText,original=markdown?.type;
          if(typeof original!=='function')return;
          markdown.type=function AgentsProMarkdown(props){
            const local=new Set(),session=currentSession(ctx);
            const text=props.text?.replace(/\[([^\]\n]+)\]\((<[^>]+>|[^)\n]+)\)/g,(whole,label,target)=>{
              let path=target.replace(/^<|>$/g,'');
              if(/^(?:https?:|mailto:|#|data:|dsh-resource:)/i.test(path)||(!path.includes('/')&&!/\.[a-z0-9]{1,8}(?::\d+)?$/i.test(path)))return whole;
              if(path.startsWith('file://')){try{path=decodeURIComponent(new URL(path).pathname);}catch{return whole;}}
              local.add(path);return label+' (`'+path.replace(/`/g,'')+'`)';
            });
            return react.createElement(original,{...props,text,fileMentions:{resolve:path=>props.fileMentions?.resolve(path)||(local.has(path)?{title:path,label:'Open '+path,open:async()=>{const clean=path.replace(/:\d+(?::\d+)?$/,'');const directory=await ctx.remote.workspaceFiles.list(session.id,clean);if(directory.ok){ctx.sidebarRight.openTabIn(session.id,'files');const root=(session.cwd||'').replace(/\/$/,''),absolute=clean.startsWith('/')?clean:root+'/'+clean,relative=absolute.startsWith(root+'/')?absolute.slice(root.length+1):'';let part=root;for(const segment of relative.split('/').filter(Boolean)){part+='/'+segment;let row;for(let attempt=0;attempt<25;attempt++){row=document.querySelector('[data-files-path='+JSON.stringify(part)+'] > button');if(row)break;await new Promise(r=>setTimeout(r,80));}if(row){if(row.getAttribute('aria-expanded')==='false')row.click();row.scrollIntoView({block:'nearest'});}}return;}ctx.sidebarRight.openResourceIn(session.id,'dsh-resource://file/session/'+encodeURIComponent(session.id)+'/'+clean.split('/').map(encodeURIComponent).join('/'));}}:undefined)}});
          };
          ctx.effect(()=>()=>{markdown.type=original;});
        }

        function installPro(ctx) {
          const h=react.createElement;
          const endpoint='/api/agents-pro';
          const api=async input=>{const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});const value=await r.json();if(!r.ok)throw Error(value.error||'Agents Pro request failed');return value;};
          const states=new Map(), listeners=new Set();
          const notify=()=>listeners.forEach(f=>f());
          const state=id=>{if(!states.has(id))states.set(id,{status:'',busy:false});return states.get(id);};
          let preferences={send:false,cleanup:true,voiceSend:true,filesPinned:false,activity:false};
          try{preferences={...preferences,...JSON.parse(localStorage.getItem('agents-pro.preferences')||'{}'),activity:localStorage.getItem('agents-pro.activity')==='true'};}catch{}
          const settings=()=>preferences;
          const persistLocal=()=>{localStorage.setItem('agents-pro.preferences',JSON.stringify(preferences));localStorage.setItem('agents-pro.activity',String(preferences.activity));notify();};
          let settingsWrites=Promise.resolve();
          const setSettings=next=>{preferences={...preferences,...next};persistLocal();settingsWrites=settingsWrites.then(()=>api({action:'settings',change:next})).catch(e=>{const id=currentSession(ctx).id;error(id,e);});};
          api({action:'settings'}).then(async value=>{if(!value.settingsVersion){const change=Object.fromEntries(['send','cleanup','voiceSend','prompt','filesPinned','activity'].filter(k=>preferences[k]!==undefined).map(k=>[k,preferences[k]]));value=await api({action:'settings',change});}preferences=value;persistLocal();}).catch(e=>error(currentSession(ctx).id,e));
          const input=id=>{const scope=ctx.sessions.scope(id);return scope?ctx.conversation.input.for(scope):undefined;};
          const attach=async(id,path,kind='file')=>{
            if(kind==='directory'){insert(id,'\n[directory: '+path+']\n');return;}
            const result=await ctx.remote.workspaceFiles.readAll(id,path);if(!result.ok)throw Error(result.error.message);
            const ext=path.split('.').pop().toLowerCase(),mime=({png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp'})[ext]||'application/octet-stream';
            const files=ctx.conversation.createDrafts(id,[new File([decodeBase64Bytes(result.value.data)],basename(path),{type:mime})]);
            if(!input(id).addAttachments(files.map(f=>f.id))){ctx.conversation.releaseDraftAttachments(files);throw Error('Chat input is busy; try again.');}
          };
          const error=(id,e)=>{Object.assign(state(id),{busy:false,failed:true,status:e.message});notify();};
          const useTick=()=>{const [,update]=react.useState(0);react.useEffect(()=>{const f=()=>update(n=>n+1);listeners.add(f);return()=>listeners.delete(f);},[]);};
          const capture=id=>{
            const draft=input(id)?.state.getSnapshot().draft||'';
            const selection=window.getSelection();
            let start=draft.length,end=start;
            const editor=selection?.anchorNode?.parentElement?.closest('[contenteditable="true"]');
            if(editor&&selection.rangeCount){const range=selection.getRangeAt(0),before=range.cloneRange();before.selectNodeContents(editor);before.setEnd(range.startContainer,range.startOffset);start=before.toString().length;end=start+range.toString().length;}
            return {draft,start,end};
          };
          const insert=(id,text,anchor=capture(id))=>{
            const target=input(id);if(!target)throw Error('Original chat is unavailable; recover the saved recording when you reopen it.');
            const now=target.state.getSnapshot().draft;
            if(now!==anchor.draft)throw Error('Draft changed while processing. Your text is saved; use Insert on the saved recording.');
            target.setDraft(now.slice(0,anchor.start)+text+now.slice(anchor.end));
          };
          const download=(action,id,title)=>{const a=document.createElement('a');a.href=endpoint+'?'+new URLSearchParams({action,sessionId:id||'',title:title||'Chat'});a.download=action==='kit'?'agents-pro-checklist-kit.zip':'chat.md';a.click();};
          let recording;
          async function deliver(id,row,anchor,onText){
            if(onText){onText(row.cleaned);state(id).status='Comment ready';return;}
            if(row.send){
              const target=input(id);if(!target)throw Error('Original chat is unavailable. Recording is saved.');
              const snapshot=target.state.getSnapshot();if(snapshot.draft!==anchor.draft)throw Error('Draft changed while processing. Recording is saved; insert it when ready.');
              if(snapshot.phase!=='plain')throw Error('Original chat input is busy. Recording is saved; retry it when ready.');
              const text=anchor.draft.slice(0,anchor.start)+row.cleaned+anchor.draft.slice(anchor.end);
              target.setDraft(text);target.submit('queue');state(id).status='Sent / queued to chat';
            }else{insert(id,row.cleaned,anchor);state(id).status='Draft ready';}
          }
          async function processRecording(id,row,anchor,onText,sendOverride){
            const s=state(id);s.busy=true;s.job=row.id;notify();
            await api({action:'process',id:row.id});
            let done;
            do {await new Promise(r=>setTimeout(r,750));done=await api({action:'recording',id:row.id});s.status=done.status==='cleaning'?'Cleaning up…':'Transcribing…';notify();}while(!['ready','failed'].includes(done.status));
            if(done.status==='failed')throw Error(done.error+' — recording saved.');
            s.ready=done;await deliver(id,{...done,...sendOverride===undefined?{}:{send:sendOverride}},anchor,onText);s.busy=false;notify();
          }
          async function startVoice(id,onText,sendOverride){
            if(recording){if(recording.id!==id)throw Error('Recording in another chat. Stop it there first.');if(sendOverride!==undefined)recording.send=sendOverride;recording.media.stop();return;}
            const anchor=capture(id),prefs=settings();
            const stream=await navigator.mediaDevices.getUserMedia({audio:true});
            const media=new MediaRecorder(stream),chunks=[];recording={id,media,stream,send:prefs.send===true};
            let phraseBusy=false,lastChecked=0,lastSpeech=Date.now(),heard=false;
            const audioContext=new AudioContext(),analyser=audioContext.createAnalyser();audioContext.createMediaStreamSource(stream).connect(analyser);analyser.fftSize=512;const samples=new Float32Array(analyser.fftSize);
            const meter=setInterval(async()=>{analyser.getFloatTimeDomainData(samples);const level=Math.sqrt(samples.reduce((sum,x)=>sum+x*x,0)/samples.length);if(level>.018){lastSpeech=Date.now();heard=true;}if(prefs.voiceSend===false||onText||!heard||phraseBusy||Date.now()-lastSpeech<1200||lastSpeech<=lastChecked||chunks.length<2)return;phraseBusy=true;lastChecked=lastSpeech;try{const snapshot=new Blob(chunks,{type:media.mimeType});const audio=await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.readAsDataURL(snapshot);});const result=await api({action:'phrase',audio});if(result.send&&recording?.media===media){recording.voiceSend=true;media.stop();}}catch(e){state(id).status='Recording… (send phrase unavailable: '+e.message+')';notify();}finally{phraseBusy=false;}},500);

            state(id).failed=false;state(id).status='Recording…';notify();
            media.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
            media.onstop=async()=>{
              const phraseSend=recording?.voiceSend===true,requestedSend=recording?.send===true;clearInterval(meter);audioContext.close();stream.getTracks().forEach(t=>t.stop());recording=undefined;
              const blob=new Blob(chunks,{type:media.mimeType});state(id).audio=blob;state(id).status='Saving recording…';state(id).busy=true;notify();
              try{
                const audio=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=reject;r.readAsDataURL(blob);});
                const row=await api({action:'record',sessionId:id,audio,send:!onText&&(phraseSend||requestedSend),voiceSend:phraseSend,prompt:prefs.cleanup===false?'off':prefs.prompt});
                state(id).saved=row;notify();await processRecording(id,row,anchor,onText);
              }catch(e){error(id,e);}
            };
            media.start(1000);
          }
          const paths={mic:'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM6 11v1a6 6 0 0 0 12 0v-1M12 18v4M8 22h8',send:'M9 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM3 11v1a6 6 0 0 0 12 0M9 18v4M5 22h8M19 15V3M15 7l4-4 4 4',broom:'m14 3 7 7M18 6l-7 8M5 12l7 7M4 13l-2 8 8-2 3-4-5-5-4 3ZM4 21l4-5'};
          const icon=name=>paths[name]?h('svg',{viewBox:'0 0 24 24',width:16,height:16,fill:'none',stroke:'currentColor',strokeWidth:1.6,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:paths[name]})):h(name==='folder'?primitives.IconFolderClose16:primitives.IconChevronDownOutline14);
          const btn=(label,onClick,child,extra={})=>h(primitives.Button,{size:'sm',title:label,'aria-label':label,onClick,...extra},child||label);
          // Native components own color, borders, typography, focus and hover. Only layout lives here.
          const css=document.createElement('style');css.dataset.agentsPro='layout';css.textContent=`
            @media(min-width:768px){[data-sidebar-right-panel] [data-dockkit-cell]:has(>[data-dockkit-pane] [data-files-root]){flex:0 0 320px!important;min-width:320px;max-width:320px}[data-sidebar-right-panel] [data-dockkit-split]:has(>[data-dockkit-cell]>[data-dockkit-pane] [data-files-root])>[data-dockkit-cell]:not(:has([data-files-root])){flex:1 1 0!important}}
            .ap-controls{display:flex;align-items:center;gap:4px;margin-inline-end:8px;flex-shrink:0;order:1}:has(>[data-slot="conversation.input.right"] .ap-controls)>button:last-child{order:2}.ap-group{display:flex;align-items:center;gap:2px}.ap-group>button{padding-inline:5px}.ap-recording{color:var(--dsw-alias-link)}.ap-menu-navigation{display:flex;align-items:center;justify-content:space-between;gap:16px;width:100%}
            .ap-status{padding:4px 10px;font-size:12px;color:var(--dsw-alias-link)}.ap-error{color:var(--dsw-alias-state-error-primary)}
            .ap-tasks{min-width:0;width:calc(100% - 32px);max-width:var(--dsh-composer-card-max-width);margin:0 auto 4px;box-sizing:border-box;flex:none}.ap-tasks [data-trigger-menu]{position:relative;inset:auto;max-height:min(260px,30vh);box-sizing:border-box;width:100%}.ap-tasks [role=option]{height:auto;flex-shrink:0;align-items:flex-start}.ap-tasks [role=option]>span[class*="itemName"]{max-width:none;flex:1;white-space:normal;overflow-wrap:anywhere}.ap-tasks [role=option]>span[class*="itemDescription"]{flex:0 0 auto}.ap-tasks [data-disclosure-row]{min-height:36px;padding-inline:10px}.ap-task-list-heading{flex:none}.ap-task-count{margin-inline-start:auto;font-size:12px;color:var(--dsw-alias-label-tertiary)}
            .ap-actions{display:flex;gap:8px;flex-wrap:wrap}.ap-field{display:flex;flex-direction:column;gap:6px;min-width:0}.ap-field>span,.ap-field input{width:100%;box-sizing:border-box}.ap-field textarea{width:100%;min-height:100px;resize:vertical;box-sizing:border-box}.ap-recordings{display:flex;flex-direction:column;gap:16px;max-height:50vh;overflow:auto}.ap-preview-toolbar{display:flex;gap:4px;flex-wrap:wrap;padding:6px;border-bottom:1px solid var(--dsw-alias-border-l1)}.ap-preview-toolbar [aria-pressed=true]{background:var(--dsw-alias-interactive-bg-hover)}.ap-activity-row{width:100%;height:auto!important;justify-content:flex-start!important;text-align:left}.ap-activity-copy{display:flex;flex-direction:column;min-width:0}.ap-activity-copy>span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ap-activity{font-size:12px;color:var(--dsw-alias-label-tertiary)}.ap-native-modal{pointer-events:auto}.ap-native-modal [role=dialog]{max-height:85vh;overflow:auto}.ap-header-button{flex-shrink:0}@media(max-width:600px){.ap-header-actions{display:none}.ap-controls{margin-inline-end:2px;gap:2px}}
          `;document.head.appendChild(css);
          function Dialog({children,onClose,title='Agents Pro',footer}){return h(primitives.Modal,{open:true,onClose,title,closeLabel:'Close',footer,className:'ap-native-modal'},children);}
          function Choice({label,value,items,onChange}){const [open,setOpen]=react.useState(false);return h(primitives.Menu,{open,portal:true,side:'bottom',align:'end',autoFocus:true,selectedId:value,items,onSelect:id=>{onChange(id);setOpen(false);},onClose:()=>setOpen(false),anchor:btn(label,()=>setOpen(!open),h(react.Fragment,null,items.find(i=>i.id===value)?.label||value,h(primitives.IconChevronDownOutline14)),{'aria-expanded':open,'aria-haspopup':'menu'})});}
          const textArea=props=>{const el=primitives.Input(props);return react.cloneElement(el,{style:{height:'auto',alignItems:'stretch'}},react.Children.map(el.props.children,c=>c?.type==='input'?h('textarea',{...c.props,rows:5}):c));};
          const field=(label,value,onChange,options={})=>h('label',{className:'ap-field'},label,h(options.multiline?textArea:primitives.Input,{'aria-label':label,value,onChange:e=>onChange(e.target.value),placeholder:options.placeholder,...options.multiline?{}:{type:'text'}}));
          function openSettings(){const trigger=document.querySelector('button[aria-label="Settings"][aria-haspopup="dialog"]');trigger?.click();let attempts=0;const timer=setInterval(()=>{const nav=[...document.querySelectorAll('[role=dialog] nav button')].find(b=>b.textContent.trim()==='Agents Pro');if(nav){nav.click();clearInterval(timer);}else if(++attempts>30)clearInterval(timer);},30);}
          // Adapt native slot components; never copy their CSS or substitute lookalikes.
          const nativeSection=id=>ctx.slots.entries('settings.section').find(e=>e.options.id===id)?.component;
          function mapNative(node,visit){
            if(!react.isValidElement(node))return node;
            const children=react.Children.map(node.props.children,child=>mapNative(child,visit));
            return visit(react.cloneElement(node,{},children));
          }
          function nativeFields(){
            const entry=ctx.slots.entries('settings.plugin.item').find(e=>e.options.key==='web-search-deepseek');
            if(!entry)throw Error('Harness native plugin settings components are unavailable.');
            const sample=entry.component({t:k=>k,useWebSearchCard:select=>select({available:true,writable:true,baseURL:{text:''},maxUses:{text:''},apiKey:{text:''}})});
            return {Card:sample.type,Field:react.Children.toArray(sample.props.children)[1].type};
          }
          function NativeField({label,children,value,onChange,hint=''}){
            const {Field}=nativeFields(),id=react.useId();
            const tree=Field({id,label,hint,text:value||'',onEdit:onChange});
            return children?mapNative(tree,node=>node.type==='input'?h('div',{id},children):node):tree;
          }
          const settingsCopy={save:'Save',saving:'Saving…',discard:'Discard',unsaved:'Unsaved',expand:'Show settings',collapse:'Hide settings',readOnly:'Settings are read-only',saveFailed:'Could not save. Check the values and try again.'};
          function Configuration(){
            useTick();const prefs=settings(),[config,setConfig]=react.useState(null),[saved,setSaved]=react.useState(null),[busy,setBusy]=react.useState(false),[notice,setNotice]=react.useState('');
            react.useEffect(()=>{api({action:'settings'}).then(v=>{setConfig(v);setSaved(v);}).catch(e=>setNotice(e.message));},[]);
            const {Card}=nativeFields();
            const switches=[['Automatic cleanup','cleanup'],['Say “go” to send','voiceSend'],['Group sessions by activity','activity']];
            const save=async()=>{setBusy(true);try{const change=Object.fromEntries(['python','modelPath','ffmpeg','recordingsDirectory','cleanupProvider','cleanupModel'].map(k=>[k,config[k]]));const v=await api({action:'settings',change});setConfig(v);setSaved(v);setNotice('Configuration saved');}catch(e){setNotice(e.message);}finally{setBusy(false);}};
            const state={available:true,writable:true,dirty:false,saving:false,failed:false};
            return h('ul',{style:{listStyle:'none',padding:0,margin:0,display:'grid',gap:12}},
              h(Card,{t:k=>({title:'Recording and cleanup',description:'Delivery, cleanup and session display',...settingsCopy}[k]||k),titleKey:'title',descriptionKey:'description',state},
                h(NativeField,{label:'After recording',hint:'Applied to new recordings.'},h(Choice,{label:'After recording',value:prefs.send?'send':'draft',items:[{id:'draft',label:'Keep as draft'},{id:'send',label:'Send or queue'}],onChange:v=>setSettings({send:v==='send'})})),
                ...switches.map(([label,key])=>h(NativeField,{key,label},h(primitives.Switch,{label,checked:prefs[key]===true,onChange:value=>setSettings({[key]:value})}))),btn('Saved recordings',()=>showSaved(currentSession(ctx).id))),
              config&&h(Card,{t:k=>({title:'Speech and cleanup configuration',description:'Executables, model, saved recordings and cleanup provider',...settingsCopy}[k]||k),titleKey:'title',descriptionKey:'description',state:{...state,dirty:JSON.stringify(config)!==JSON.stringify(saved),saving:busy},onSave:save,onDiscard:()=>{setConfig(saved);setNotice('');}},
                ...[['Python executable','python'],['Whisper model directory','modelPath'],['FFmpeg executable','ffmpeg'],['Recordings directory','recordingsDirectory']].map(([label,key])=>h(NativeField,{key,label,value:config[key],onChange:v=>setConfig({...config,[key]:v})})),
                h(NativeField,{label:'Cleanup provider'},h(Choice,{label:'Cleanup provider',value:config.cleanupProvider,items:[{id:'codex-cli',label:'Codex CLI'},{id:'grok-cli',label:'Grok CLI'}],onChange:v=>setConfig({...config,cleanupProvider:v,cleanupModel:v==='grok-cli'?'grok-4.7':'gpt-5.6-luna'})})),h(NativeField,{label:'Cleanup model',value:config.cleanupModel,onChange:v=>setConfig({...config,cleanupModel:v})})),notice&&h('p',{role:'status'},notice));
          }
          const presetText={nav:'Cleanup prompts',sectionIntro:'Select a prompt for dictation and selected-text cleanup. View or edit its instructions.',builtInGroup:'Prompts',customGroup:'Custom',builtIn:'Prompt',userTrust:'Custom',inUse:'In use',setDefault:'Use prompt',view:'View',duplicate:'Edit',close:'Close',composition:'Prompt instructions',noDescription:'',duplicateUnavailable:'Unavailable',error:'Unable to load',retry:'Retry'};
          const noop=()=>{};
          // The actual AgentPresetSection renders cards, descriptions, View modal and editor frame.
          // Only the action/data bindings and editable content are adapted here.
          function EditablePresets({rows,title,intro,selected,onSelect,onSave,onCreate,readOnly=false,onLoad,onToggle,toggling}){
            const [view,setView]=react.useState(null),[editing,setEditing]=react.useState(false),[draft,setDraft]=react.useState(''),[saving,setSaving]=react.useState(false),[failure,setFailure]=react.useState(null);
            const Native=nativeSection('agent-presets');if(!Native)throw Error('Harness native preset component is unavailable.');
            const open=async(id,edit)=>{const row=rows.find(r=>r.id===id);setFailure(null);setView({id,title:row.name,content:onLoad?'Loading…':row.content});setDraft(row.content||'');setEditing(edit);if(onLoad){try{const loaded=await onLoad(id);setView(current=>current?.id===id?{...current,content:(loaded.path||loaded.resourceBase?.path||'')+'\n\n'+loaded.content}:current);}catch(e){setView(current=>current?.id===id?{...current,content:'Unable to load skill: '+e.message}:current);}}};
            const close=()=>{if(!saving)setView(null);};
            const state={status:'ready',rows:rows.map(r=>({...r,trust:'system',isDefault:r.id===selected})),authorable:true,hasDocument:false,copy:null,view,pendingDelete:null,error:failure,revealedPaths:{}};
            const tree=Native({useAgentPresetSection:select=>select(state),t:k=>({ ...presetText,nav:title,sectionIntro:intro||presetText.sectionIntro,builtIn:readOnly?'Skill':presetText.builtIn,builtInGroup:readOnly?'Available skills':presetText.builtInGroup,composition:readOnly?'Skill instructions':title==='Instructions'?'Markdown instructions':'Prompt instructions',setDefault:readOnly||title==='Instructions'?'View':'Use prompt'}[k]||k),load:noop,view:id=>open(id,false),closeView:close,makeDefault:onSelect||(id=>open(id,false)),beginCopy:id=>open(id,true),cancelCopy:noop,confirmDelete:noop});
            const save=async()=>{setSaving(true);setFailure(null);try{await onSave(view.id,draft);setView(null);}catch(e){setFailure(e.message);}finally{setSaving(false);}};
            const adapted=mapNative(tree,node=>{
              if(readOnly&&node.type==='button'&&node.props['aria-label']?.startsWith('Edit:')){
                const row=rows.find(r=>'Edit: '+r.name===node.props['aria-label']);
                return onToggle&&row?h(primitives.Switch,{label:'Enable '+row.name,checked:row.enabled===true,disabled:!!toggling,onChange:enabled=>onToggle(row.id,enabled)}):null;
              }
              if(node.type==='button'&&node.props['aria-label']?.startsWith('Edit:'))return react.cloneElement(node,{'data-tip':'Edit'},h(primitives.IconEditOutline16));
              if(node.type===primitives.Modal&&node.props.description&&(node.props.title||'').startsWith('View ·')){
                const viewer=react.Children.toArray(node.props.children)[0];const content=editing?h('textarea',{className:viewer?.props.className,value:draft,onChange:e=>setDraft(e.target.value),autoFocus:true,'aria-label':title==='Instructions'?'Markdown instructions':'Prompt instructions',spellCheck:false,style:{width:'100%',boxSizing:'border-box',resize:'vertical',minHeight:320,fontFamily:'inherit'}}):node.props.children;
                return react.cloneElement(node,{title:(editing?'Edit':'View')+' · '+(view?.title||''),onClose:close,footer:h(react.Fragment,null,btn('Close',close,null,{variant:'outline',disabled:saving}),editing?btn(saving?'Saving…':'Save',save,null,{disabled:saving||!draft.trim()}):!readOnly&&btn('Edit',()=>setEditing(true),h(react.Fragment,null,h(primitives.IconEditOutline16),'Edit')))},content,failure&&h('p',{role:'alert'},failure));
              }
              return node;
            });
            return h(react.Fragment,null,adapted,onCreate&&btn('New instructions',onCreate,h(react.Fragment,null,h(primitives.IconPlusOutline16),'New instructions')));
          }
          function CleanupPrompts(){
            useTick();const prefs=settings(),[rows,setRows]=react.useState([]),[failure,setFailure]=react.useState('');
            react.useEffect(()=>{api({action:'prompts'}).then(setRows).catch(e=>setFailure(e.message));},[]);
            const all=rows.some(r=>r.text===prefs.prompt)||!prefs.prompt?rows:[...rows,{name:'custom',text:prefs.prompt}];
            return h(react.Fragment,null,failure&&h('p',{role:'alert'},failure),h(EditablePresets,{title:'Cleanup prompts',rows:all.map(r=>({id:r.name,name:r.name,content:r.text,description:r.text.replace(/^#+\s*/gm,'').slice(0,400)})),selected:all.find(r=>r.text===prefs.prompt)?.name,onSelect:id=>setSettings({prompt:all.find(r=>r.name===id).text,cleanup:true}),onSave:async(name,text)=>{const updated=await api({action:'prompts',change:{name,text}});if(all.find(r=>r.name===name)?.text===prefs.prompt)setSettings({prompt:text});setRows(updated);notify();}}));
          }
          function Instructions(){
            const id=currentSession(ctx).id,[rows,setRows]=react.useState([]),[creating,setCreating]=react.useState(false),[name,setName]=react.useState(''),[scope,setScope]=react.useState('user'),[notice,setNotice]=react.useState('');
            react.useEffect(()=>{api({action:'customizations',sessionId:id}).then(setRows).catch(e=>setNotice(e.message));},[id]);
            const save=async(row,content)=>{const updated=await api({action:'customizations',sessionId:id,change:{action:'save',kind:'instructions',scope:row.scope,name:row.name,content}});setRows(updated);};
            return h(react.Fragment,null,h(EditablePresets,{title:'Instructions',intro:'Existing personal and workspace instructions remain active. Custom agents are managed by native Agent presets.',rows:rows.filter(r=>r.kind==='instructions').map(r=>({id:r.path,name:r.name,content:r.content,description:r.scope+' · '+r.content.slice(0,250)})),onSave:async(path,content)=>save(rows.find(r=>r.path===path),content),onCreate:()=>{setName('');setNotice('');setCreating(true);}}),notice&&h('p',{role:'alert'},notice),creating&&h(Dialog,{title:'New instructions',onClose:()=>setCreating(false),footer:btn('Create',async()=>{try{await save({name,scope},'# '+name+'\n\nAdd your instructions here.\n');setCreating(false);}catch(e){setNotice(e.message);}},null,{disabled:!name.trim()})},h(NativeField,{label:'Name',value:name,onChange:setName}),h(NativeField,{label:'Location'},h(Choice,{label:'Instruction location',value:scope,items:[{id:'user',label:'User · all projects'},{id:'workspace',label:'Workspace'}],onChange:setScope})),notice&&h('p',{role:'alert'},notice)));
          }
          function Skills(){
            const sessionId=currentSession(ctx).id,[catalog,setCatalog]=react.useState(null),[query,setQuery]=react.useState(''),[notice,setNotice]=react.useState(''),[refresh,setRefresh]=react.useState(0),[toggling,setToggling]=react.useState(null);
            const toggle=async(name,enabled)=>{setToggling(name);setNotice('');try{setCatalog(await api({action:'skill-enabled',sessionId,name,enabled}));}catch(e){setNotice(e.message);}finally{setToggling(null);}};
            react.useEffect(()=>{let live=true;setCatalog(null);setNotice('');api({action:'skills',sessionId}).then(value=>{if(live)setCatalog(value);}).catch(e=>{if(live)setNotice(e.message);});return()=>{live=false;};},[sessionId,refresh]);
            const rows=(catalog?.skills||[]).filter(row=>(row.name+' '+row.description+' '+(row.resourceBase?.path||'')).toLowerCase().includes(query.toLowerCase()));
            return h(react.Fragment,null,
              h(NativeField,{label:'Search skills',value:query,onChange:setQuery,hint:'Search by name, description or location.'}),
              notice&&h('p',{role:'alert'},notice),
              !catalog&&!notice&&h('p',{role:'status'},'Loading skills…'),
              catalog&&!catalog.complete&&h('p',{role:'status'},'Skill discovery is incomplete. Refresh to try again.'),
              catalog&&h(EditablePresets,{title:'Skills',intro:catalog.skills.filter(r=>r.enabled).length+' enabled · '+rows.length+' of '+catalog.skills.length+' skills. All disabled by default. Changes apply to this project across sessions.',readOnly:true,onToggle:toggle,toggling,rows:rows.map(row=>({id:row.name,name:row.name,description:row.description,enabled:row.enabled})),onLoad:name=>api({action:'skills',sessionId,name})}),
              catalog&&rows.length===0&&h('p',{role:'status'},query?'No skills match your search.':'No skills found for this workspace or user.'),
              btn('Refresh skills',()=>setRefresh(v=>v+1),'Refresh skills'),
              btn('Download checklist integration kit',()=>download('kit'),h(react.Fragment,null,h(primitives.IconDownloadOutline16),'Download checklist integration kit')));
          }
          // Adapt the native Models row renderer and retain its real API controllers,
          // editors, child slots and styles. CLI rows have no API settings actions.
          const cliIds=new Set(['codex-cli','grok-cli','openai-codex','xai']);
          function CliModelsLoaded({native:Native,injected,renderSlot}){
            const [connections,setConnections]=react.useState([]),[notice,setNotice]=react.useState(''),[detail,setDetail]=react.useState(null),[refresh,setRefresh]=react.useState(0);
            react.useEffect(()=>{let live=true;api({action:'cli-connections'}).then(value=>{if(live){setConnections(value);setNotice('');}}).catch(e=>{if(live)setNotice(e.message);});return()=>{live=false;};},[refresh]);
            const useSnapshot=select=>injected.useSnapshot(state=>{
              const namespaces=new Map(state.namespaces);namespaces.set('agents-pro-cli',{});
              const rows=[...connections.map(row=>({entry:{provider:row.id,displayName:row.name+' · '+row.login,settingsNs:'agents-pro-cli',settingsPath:[],active:true},configured:true,removable:false})),...state.rows.filter(row=>!cliIds.has(row.entry.provider))];
              return select({...state,namespaces,rows});
            });
            const tree=Native({injected:{...injected,useSnapshot,t:key=>key==='intro'?'Codex and Grok use your existing CLI logins. Other providers use their own API settings.':injected.t(key)},renderSlot});
            const adapted=mapNative(tree,node=>{
              const connection=node.type==='li'&&connections.find(row=>String(node.key).endsWith(row.id));
              if(!connection)return node;
              return mapNative(node,child=>{
                if(child.type==='button')return react.cloneElement(child,{'aria-label':'Connection details: '+connection.name,onClick:()=>setDetail(connection.id)},'Details');
                if(child.type==='span'&&child.props.className?.includes('rowIdentity'))return react.cloneElement(child,{},child.props.children,h(primitives.Tag,null,connection.available?'CLI available':'CLI not found'));
                return child;
              });
            });
            const connection=connections.find(row=>row.id===detail);
            return h(react.Fragment,null,adapted,notice&&h('p',{role:'alert'},notice),connections.length===0&&!notice&&h('p',{role:'status'},'Checking CLI connections…'),notice&&btn('Retry CLI discovery',()=>setRefresh(v=>v+1),'Retry'),connection&&h(Dialog,{title:connection.name,onClose:()=>setDetail(null),footer:btn('Refresh connection',()=>setRefresh(v=>v+1),'Refresh')},
              h(NativeField,{label:'Connection'},h('span',null,connection.login+' through the installed CLI')),
              h(NativeField,{label:'Executable'},h('code',null,connection.executable||'Not found')),
              h(NativeField,{label:'Authentication'},h('span',null,'Uses the CLI’s existing login. No API key is required here. Login validity is checked by the CLI when you send a message.')),
              h(NativeField,{label:'Sign in from Terminal'},h('code',null,connection.command)),
              !connection.available&&h('p',{role:'alert'},'Install '+connection.name+' and sign in, then refresh this connection.')));
          }
          const modelsEntry=ctx.slots.entries('settings.section').find(entry=>entry.options.id==='models');
          if(!modelsEntry)throw Error('Harness native Models settings component is unavailable.');
          const originalModels=modelsEntry.component;
          modelsEntry.component=function AgentsProModels(props){const tree=originalModels(props);return tree?h(CliModelsLoaded,{...tree.props,native:tree.type}):tree;};
          ctx.effect(()=>()=>{modelsEntry.component=originalModels;},'agents-pro native Models adapter');
          const settingsTabs=[{id:'general',label:'General'},{id:'prompts',label:'Cleanup prompts'},{id:'agents',label:'Agents'},{id:'instructions',label:'Instructions'},{id:'skills',label:'Skills'}];
          function NativeAgents({close}){
            const entry=ctx.slots.entries('settings.section').find(e=>e.options.id==='agent-presets');
            if(!entry)throw Error('Harness native agent presets are unavailable.');
            const injected=react.useMemo(()=>entry.inject(),[entry]);
            const store=injected.hooks.agentPresetSection;
            const snapshot=react.useSyncExternalStore(store.subscribe,store.getSnapshot);
            return h(entry.component,{...injected,close,t:ctx.locale.bind('settings.agentPreset'),useAgentPresetSection:select=>select(snapshot)});
          }
          function Settings({close}){
            const Native=nativeSection('plugins');if(!Native)throw Error('Harness native Settings tabs are unavailable.');
            return h(Native,{t:k=>({title:'Agents Pro',intro:'Voice, cleanup and skill integration. Agents use Harness’s native presets.',tabs:'Agents Pro settings'}[k]||k),useTabs:select=>select(settingsTabs),renderSlot:(_name,_props,{only})=>only==='general'?h(Configuration):only==='prompts'?h(CleanupPrompts):only==='agents'?h(NativeAgents,{close}):only==='instructions'?h(Instructions):h(Skills)});
          }
          const modalHost=(Component,props={})=>{const host=document.createElement('div');host.className='ap-native-modal';document.body.append(host);const root=reactDom.createRoot(host);const close=()=>{root.unmount();host.remove();};root.render(h(Component,{...props,onClose:close}));return close;};
          function SavedRecordings({id,onClose}){const [rows,setRows]=react.useState(null),[notice,setNotice]=react.useState('');react.useEffect(()=>{api({action:'recordings',sessionId:id}).then(setRows).catch(e=>setNotice(e.message));},[id]);return h(Dialog,{title:'Saved recordings',onClose},notice&&h('p',{role:'alert'},notice),rows===null?h('p',null,'Loading…'):rows.length===0?h('p',null,'No recordings in this session.'):h('div',{className:'ap-recordings'},rows.map(row=>h('div',{key:row.id},h('strong',null,new Date(row.createdAt).toLocaleString()+' · '+row.status),h('p',null,row.error||row.cleaned||row.raw),h('div',{className:'ap-actions'},btn('Insert recording',()=>{try{insert(id,row.cleaned||row.raw);onClose();}catch(e){setNotice(e.message);} },null,{disabled:!(row.cleaned||row.raw)}),btn('Retry saved dictation',()=>{onClose();processRecording(id,row,capture(id),undefined,false).catch(e=>error(id,e));}))))));}
          const showSaved=id=>modalHost(SavedRecordings,{id});
          function NativeTaskList({NativeList,menu,headers,snapshot,lists,setDetail,setHover,open,setOpen,sessionId,completed,items}){const list=NativeList({menu,headers,onPick:(source,index)=>{const group=snapshot.groups.findIndex(g=>g.source===source);setDetail({...lists[group]?.items[index],listId:lists[group]?.id});},onCrumb:()=>{},onHover:(source,index)=>setHover({source,index}),onDismiss:()=>{},t:key=>key==='suggestions.aria'?'Task progress':key});return react.cloneElement(list,{style:{position:'relative',inset:'auto',maxHeight:'min(260px,30vh)',width:'100%',boxSizing:'border-box'},'data-ap-task-native':true,onKeyDown:e=>{if(e.key!=='Enter'&&e.key!==' ')return;const row=e.target.closest('[role=option]');if(!row)return;const index=[...e.currentTarget.querySelectorAll('[role=option]')].indexOf(row);if(items[index]){e.preventDefault();setDetail(items[index]);}}},h('div',{className:'ap-task-list-heading'},h(primitives.DisclosureRow,{icon:h(primitives.IconChecklistOutline14),title:'Tasks',open,expandable:true,expandOnRowClick:true,keepContentWhenOpen:true,collapsedContent:h('span',{className:'ap-task-count'},completed+' / '+items.length),onToggle:()=>{setOpen(!open);localStorage.setItem('ap.tasks.'+sessionId,open?'closed':'open');}})),open&&list.props.children);}
          function Tasks({sessionId}){
            useTick();const [lists,setLists]=react.useState([]),[open,setOpen]=react.useState(()=>localStorage.getItem('ap.tasks.'+sessionId)!=='closed'),[detail,setDetail]=react.useState(null),[resuming,setResuming]=react.useState(false),[resumeNotice,setResumeNotice]=react.useState(''),[hover,setHover]=react.useState(null);
            react.useEffect(()=>{setLists([]);setDetail(null);setHover(null);setOpen(localStorage.getItem('ap.tasks.'+sessionId)!=='closed');let live=true;const update=()=>api({action:'checklists',sessionId}).then(v=>{if(live)setLists(v.lists);}).catch(e=>error(sessionId,e));update();const timer=setInterval(update,1200);return()=>{live=false;clearInterval(timer);};},[sessionId]);
            const NativeList=ctx.slots.entries('conversation.input.overlay').find(e=>e.options.id==='slash-menu')?.component;
            const items=lists.flatMap(l=>l.items.map(i=>({...i,listId:l.id}))),completed=items.filter(i=>i.status==='completed').length;
            const snapshot=react.useMemo(()=>({open:true,highlight:hover,groups:lists.map(l=>({source:'ap-'+sessionId+'-'+l.id,status:'ready',showGroupTitle:false,items:l.items.map(i=>({name:(i.status==='completed'?'✓ ':i.status==='in_progress'?'◌ ':i.status==='blocked'?'! ':'○ ')+i.text,description:i.status.replace('_',' ')}))}))}),[lists,hover,sessionId]);
            const menu=react.useMemo(()=>({subscribe:()=>()=>{},getSnapshot:()=>snapshot}),[snapshot]),headers=react.useMemo(()=>{const empty=new Map();return{subscribe:()=>()=>{},getSnapshot:()=>empty};},[]);

            return h('div',{className:'ap-tasks'},items.length>0&&NativeList&&h(NativeTaskList,{NativeList,menu,headers,snapshot,lists,setDetail,setHover,open,setOpen,sessionId,completed,items}),state(sessionId).status&&h('div',{className:'ap-status'+(state(sessionId).failed?' ap-error':''),role:'status'},state(sessionId).status),detail&&h(Dialog,{title:'Task details',onClose:()=>setDetail(null),footer:btn(resuming?'Queuing…':'Resume pending tasks',async()=>{setResuming(true);setResumeNotice('');try{const request=await api({action:'resume-checklist',sessionId,id:detail.listId});const session=ctx.sessions.binding(sessionId)?.session;if(!session)throw Error('Original session is unavailable');const submission=session.beginSubmission({mode:'queue',text:request.text,attachments:[]});const result=await session.prompt([{type:'text',text:request.text}],'queue',undefined,submission.requestId);if(!result.ok)throw Error(result.error.message);setResumeNotice('Pending tasks sent / queued.');}catch(e){setResumeNotice(e.message);}finally{setResuming(false);}},null,{disabled:resuming||!lists.find(l=>l.id===detail.listId)?.items.some(i=>['pending','blocked'].includes(i.status))})},h('p',null,detail.text),h('p',null,'Status: '+(lists.find(l=>l.id===detail.listId)?.items.find(i=>i.id===detail.id)?.status||detail.status).replace('_',' ')),h('p',null,'Resume pending and blocked tasks in this checklist; completed tasks stay checked.'),resumeNotice&&h('p',{role:'status'},resumeNotice)));
          }
          function Controls({sessionId}){
            useTick();const [menu,setMenu]=react.useState(''),[prompts,setPrompts]=react.useState([]),s=state(sessionId),prefs=settings(),active=recording?.id===sessionId;
            react.useEffect(()=>{api({action:'prompts'}).then(setPrompts).catch(e=>error(sessionId,e));},[menu,prefs.prompt]);
            async function clean(){const anchor=capture(sessionId),text=anchor.draft.slice(anchor.start,anchor.end);if(!text){error(sessionId,Error('Select text in the chat input to clean it.'));return;}s.status='Cleaning up…';s.failed=false;s.busy=true;notify();try{const result=await api({action:'cleanup',text,prompt:prefs.prompt});insert(sessionId,result.text,anchor);s.status='Cleaned';s.busy=false;notify();}catch(e){error(sessionId,e);}}
            const navLabel=(label,forward=true)=>h('span',{className:'ap-menu-navigation'},label,h(forward?primitives.IconChevronRightOutline14:primitives.IconChevronLeftOutline14));
            const rootItems=[
              {id:'extension',label:'Extension settings',icon:h(primitives.IconSettingsOutline16)},
              {id:'cleanup',label:navLabel('Cleanup settings')},
              {id:'transcription',label:navLabel('Transcription settings')}
            ];
            const cleanupItems=[{id:'back',label:navLabel('Cleanup settings',false)},{id:'cleanup-separator',type:'separator'},{id:'auto',label:'Automatic cleanup'},{id:'raw',label:'Transcribe only'},{id:'prompts-label',type:'label',text:'Cleanup prompt'},...prompts.map(p=>({id:'prompt:'+p.name,label:p.name}))];
            const transcriptionItems=[{id:'back',label:navLabel('Transcription settings',false)},{id:'transcription-separator',type:'separator'},{id:'draft',label:'Keep as draft'},{id:'send',label:'Clean and send / queue'},{id:'voice-separator',type:'separator'},{id:'go',label:'Say “go” to send'},{id:'saved',label:'Saved recordings',icon:h(primitives.IconClockOutline16)}];
            const items=menu==='cleanup'?cleanupItems:menu==='transcription'?transcriptionItems:rootItems;
            const selectedIds=menu==='cleanup'?[prefs.cleanup===false?'raw':'auto','prompt:'+(prompts.find(p=>p.text===prefs.prompt)?.name||'')]:menu==='transcription'?[prefs.send?'send':'draft',prefs.voiceSend!==false?'go':'']:[];
            const choose=value=>{
              if(menu==='root'&&(value==='cleanup'||value==='transcription')){setMenu(value);return;}
              if(value==='back'){setMenu('root');return;}
              setMenu('');
              if(value==='extension'){openSettings();return;}
              if(value==='auto'||value==='raw'){setSettings({cleanup:value==='auto'});return;}
              if(value.startsWith('prompt:')){const p=prompts.find(row=>row.name===value.slice(7));if(p)setSettings({prompt:p.text,cleanup:true});return;}
              if(value==='draft'||value==='send'){setSettings({send:value==='send'});return;}
              if(value==='go'){setSettings({voiceSend:prefs.voiceSend===false});return;}
              if(value==='saved')showSaved(sessionId);
            };
            const options=btn('Recording and cleanup options',()=>setMenu(menu?'':'root'),h(primitives.IconSettingsOutline16),{'aria-expanded':!!menu,'aria-haspopup':'menu',disabled:!!recording});
            const optionsMenu=h(primitives.Menu,{open:!!menu,anchor:options,items,selectedIds,portal:true,side:'top',align:'end',autoFocus:true,onClose:()=>setMenu(''),onSelect:choose});
            const stop=()=>startVoice(sessionId,undefined,undefined).catch(e=>error(sessionId,e));
            const sendRecording=()=>startVoice(sessionId,undefined,true).catch(e=>error(sessionId,e));
            return h('div',{className:'ap-controls'},optionsMenu,btn('Clean selected text',clean,icon('broom'),{disabled:s.busy,onMouseDown:e=>e.preventDefault()}),h('div',{className:'ap-group'+(active?' ap-recording':'')},btn(active?'Stop recording':prefs.send?'Record, clean and send':'Record draft',stop,active?h(primitives.IconStopFill16):icon('mic'),{disabled:s.busy||!!recording&&!active,onMouseDown:e=>e.preventDefault()}),active&&btn('Stop recording, clean up, and send',sendRecording,h(primitives.IconSendOutline16),{disabled:s.busy,onMouseDown:e=>e.preventDefault()})));}
          function CloseEditors({sessionId}){
            const controller=ctx.sidebarRight;
            const store=controller.adopted?.get(sessionId)?.store;
            react.useSyncExternalStore(store?.subscribe||(()=>()=>{}),store?.getSnapshot||(()=>null));
            const [seat,setSeat]=react.useState(null);
            react.useEffect(()=>{
              let host;
              const position=()=>{
                const collapse=document.querySelector('[data-sidebar-right-panel] button[data-sidebar-right-collapse]')||[...document.querySelectorAll('[data-sidebar-right-panel] button')].find(b=>b.getAttribute('aria-label')==='Collapse right sidebar');
                if(!collapse)return;
                if(host?.parentElement===collapse.parentElement)return;
                host?.remove();host=document.createElement('span');collapse.before(host);setSeat({host,className:collapse.className});
              };
              const observer=new MutationObserver(position);observer.observe(document.body,{childList:true,subtree:true});position();
              return()=>{observer.disconnect();host?.remove();};
            },[sessionId]);
            const layout=controller.layoutOf(sessionId),files=Object.values(layout?.tabs||{}).find(t=>t.kind==='files');
            const previews=Object.values(layout?.tabs||{}).filter(t=>t.kind!=='files'&&t.kind!=='guide'&&paneOfTab(layout,t.id)?.host==='dock');
            const dockFiles=files&&paneOfTab(layout,files.id)?.host==='dock';
            react.useLayoutEffect(()=>{if(dockFiles&&previews.length===0)ctx.layout.panels.setRightbar(320);},[sessionId,dockFiles,previews.length]);
            if(!files||!previews.length||!seat)return null;
            return reactDom.createPortal(h(primitives.Tooltip,{label:'Close editors',side:'bottom'},h('button',{type:'button',className:seat.className,'aria-label':'Close editors',onClick:()=>{for(const tab of previews)controller.closeIn(sessionId,tab.id);controller.focus(files.id);}},h(primitives.IconCloseOutline16))),seat.host);
          }
          function HeaderActions({sessionId}){return h('div',{className:'ap-actions ap-header-actions'},btn('Save chat as Markdown',()=>download('export',sessionId),h(primitives.IconDownloadOutline16)),btn('Agents Pro settings',openSettings,h(primitives.IconSettingsOutline16)));}
          const register=(name,id,component)=>ctx.slots.inject(name,()=>ctx.slots.register({name,id,order:90},component));
          register('conversation.input.dock','agents-pro-tasks',Tasks);
          ctx.slots.inject('settings.section',()=>ctx.slots.register({name:'settings.section',id:'agents-pro',label:()=> 'Agents Pro',order:25},Settings));
          register('conversation.input.right','agents-pro-controls',Controls);
          register('conversation.session.header.utilities','agents-pro-close-editors',CloseEditors);
          register('conversation.session.header.actions','agents-pro-export',HeaderActions);
          const unsubscribe=ctx.sessions.list.subscribe(notify);
          ctx.__agentsPro={api,attach,insert,capture,startVoice,useTick,settings,setSettings,openSettings,modalHost,Dialog,textArea,showSaved,stopVoice:id=>{if(recording?.id===id)recording.media.stop();},download,btn,h,Settings,state,notify};
          ctx.effect(()=>()=>{unsubscribe();listeners.clear();css.remove();},'agents-pro controls');
        }
        function openComment(ctx,id,path,voice=false,element='') {
          const p=ctx.__agentsPro,h=p.h;
          function Comment({onClose}){
            p.useTick();const [text,setText]=react.useState(''),[recording,setRecording]=react.useState(false),[notice,setNotice]=react.useState(''),alive=react.useRef(true);const busy=p.state(id).busy;
            async function toggle(){try{await p.startVoice(id,value=>{if(alive.current){setText(value);setNotice('Review your comment, then Add to Chat.');}});setRecording(value=>!value);}catch(e){setNotice(e.message);}}
            react.useEffect(()=>{if(voice)toggle();return()=>{alive.current=false;};},[]);
            const close=()=>{if(recording)p.stopVoice(id);onClose();};
            return h(p.Dialog,{title:voice?'Add Comment with Voice':'Add Comment',onClose:close,footer:h('div',{className:'ap-actions'},p.btn(recording?'Stop recording':'Record comment',toggle,recording?h(primitives.IconStopFill16):undefined,{disabled:busy}),p.btn('Cancel',close),p.btn('Add to Chat',()=>{try{p.insert(id,'\n[Comment on '+path+(element?' — '+element:'')+']\n'+text+'\n');close();}catch(e){setNotice(e.message);}},null,{variant:'primary',disabled:busy||recording||!text.trim()}))},h('p',null,path+(element?' · '+element:'')),h('label',{className:'ap-field'},'Comment',h(p.textArea,{'aria-label':'Comment',value:text,onChange:e=>setText(e.target.value)})),h('p',{className:'ap-status',role:'status'},busy?p.state(id).status:notice||p.state(id).failed&&p.state(id).status||''));
          }
          p.modalHost(Comment);
        }

        function installPreviews(ctx) {
          const {h,btn}=ctx.__agentsPro;
          function fileOf(address){const u=new URL(address),parts=u.pathname.slice(1).split('/');if(parts.shift()!=='session')throw Error('Expected a session file');return {sessionId:decodeURIComponent(parts.shift()),path:decodeURIComponent(parts.join('/'))};}
          function Preview({sessionId,content,resourceAddress}) {
            const file=fileOf(resourceAddress),html=/\.html?$/i.test(file.path),ref=react.useRef(),[url,setUrl]=react.useState(''),[error,setError]=react.useState(''),[mode,setMode]=react.useState('');
            const channel=react.useMemo(()=>crypto.randomUUID(),[resourceAddress]);
            react.useEffect(()=>{
              if(content.kind!=='bytes')return;let live=true,urls=[];const abort=new AbortController();
              (async()=>{try{
                let blob;
                if(html){
                  const doc=new DOMParser().parseFromString(new TextDecoder().decode(content.data),'text/html');
                  for(const el of doc.querySelectorAll('img[src],script[src],link[rel="stylesheet"][href]')){
                    const attr=el.tagName==='LINK'?'href':'src',value=el.getAttribute(attr);
                    if(!value||/^(?:[a-z]+:|\/|#)/i.test(value))continue;
                    const result=await ctx.remote.workspaceFiles.readRelated(file.sessionId,file.path,decodeURIComponent(value.split(/[?#]/)[0]),abort.signal);
                    if(!result.ok)continue;
                    const mime=result.value.mimeType||(/\.css$/i.test(value)?'text/css':/\.js$/i.test(value)?'application/javascript':/\.svg$/i.test(value)?'image/svg+xml':/\.png$/i.test(value)?'image/png':'application/octet-stream');
                    el.dataset.apOriginal=value;el.setAttribute(attr,'data:'+mime+';base64,'+result.value.data);
                  }
                  const script=doc.createElement('script');script.textContent=`(()=>{let mode='';const channel=${JSON.stringify(channel)};addEventListener('message',e=>{if(e.source===parent&&e.data?.channel===channel)mode=e.data.mode||'';});const select=e=>{if(e.type==='click'&&!mode)return;e.preventDefault();e.stopPropagation();const el=e.target,selector=el.id?'#'+el.id:el.tagName.toLowerCase()+(el.classList.length?'.'+[...el.classList].slice(0,3).join('.'):''),text=(el.innerText||el.alt||'').slice(0,1200);parent.postMessage({channel,kind:'element',voice:mode==='voice',selector,text,image:el.tagName==='IMG'?(el.dataset.apOriginal||el.getAttribute('src')):null},'*');};addEventListener('contextmenu',select,true);addEventListener('click',select,true);})();`;
                  doc.documentElement.append(script);blob=new Blob(['<!doctype html>'+doc.documentElement.outerHTML],{type:'text/html'});
                }else{const ext=file.path.split('.').pop().toLowerCase(),mime=({svg:'image/svg+xml',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif'})[ext];blob=new Blob([content.data],{type:mime});}
                const src=URL.createObjectURL(blob);urls.push(src);if(live)setUrl(src);
              }catch(e){if(live)setError(e.message);}})();
              return()=>{live=false;abort.abort();urls.forEach(URL.revokeObjectURL);};
            },[content,resourceAddress]);
            react.useEffect(()=>{const receive=e=>{if(e.source!==ref.current?.contentWindow||e.data?.channel!==channel||e.data.kind!=='element')return;const data=e.data;showPreviewMenu(ctx,sessionId,file.path,typeof data.selector==='string'?data.selector.slice(0,300)+' '+String(data.text||'').slice(0,1200):'',data.voice,typeof data.image==='string'?data.image:null);};window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);},[sessionId,resourceAddress,channel]);
            const setCommentMode=value=>{setMode(value);ref.current?.contentWindow?.postMessage({channel,mode:value},'*');};
            return h('div',{className:'ap-preview',style:{height:'100%',display:'flex',flexDirection:'column',whiteSpace:'normal'},'data-ap-file':file.path},h('div',{className:'ap-preview-toolbar'},btn('Add to Chat',()=>ctx.__agentsPro.attach(sessionId,file.path).catch(e=>setError(e.message))),btn(html?'Comment on Elements':'Add Comment',()=>html?setCommentMode(mode==='text'?'':'text'):openComment(ctx,sessionId,file.path),null,{'aria-pressed':mode==='text'}),btn(html?'Comment on Elements with Voice':'Add Comment with Voice',()=>html?setCommentMode(mode==='voice'?'':'voice'):openComment(ctx,sessionId,file.path,true),null,{'aria-pressed':mode==='voice'})),error&&h('p',{role:'alert'},error),url&&(html?h('iframe',{ref,src:url,sandbox:'allow-scripts',title:'HTML preview with comments',onLoad:()=>setCommentMode(mode),style:{flex:1,width:'100%',border:0,minHeight:240,background:'white'}}):h('div',{style:{overflow:'auto',flex:1},onContextMenu:e=>{e.preventDefault();showPreviewMenu(ctx,sessionId,file.path);}},h('img',{src:url,alt:file.path,style:{maxWidth:'100%',height:'auto'}}))));
          }
          const key='agents-pro-document';ctx.effect(()=>ctx.documentPreviews.register({id:key,extensions:['html','htm','png','jpg','jpeg','webp','gif','svg'],priority:'extension',title:()=> 'Agents Pro preview',loading:'bytes-complete'}));
          ctx.slots.inject('sidebar.right.tab.document',()=>ctx.slots.register({name:'sidebar.right.tab.document',key},Preview));
        }
        function showPreviewMenu(ctx,id,path,element='',voice=false,image){
          if(voice){openComment(ctx,id,path,true,element);return;}
          const p=ctx.__agentsPro,h=p.h;
          function PreviewActions({onClose}){return h(p.Dialog,{title:element?'Element actions':'Image actions',onClose},h('p',null,element||path),h('div',{className:'ap-actions'},p.btn('Add to Chat',()=>{onClose();(async()=>{try{if(image&&!/^(?:data:|https?:|blob:)/i.test(image)){const parts=(image.startsWith('/')?image:path.slice(0,path.lastIndexOf('/')+1)+image).split('/'),resolved=[];for(const part of parts){if(part==='..')resolved.pop();else if(part!=='.')resolved.push(part);}await ctx.__agentsPro.attach(id,resolved.join('/'));}else if(!element)await ctx.__agentsPro.attach(id,path);if(element)ctx.__agentsPro.insert(id,'\n[file: '+path+']\n[Element: '+element+']\n');}catch(e){ctx.__agentsPro.state(id).status=e.message;ctx.__agentsPro.notify();}})();}),p.btn('Add Comment',()=>{onClose();openComment(ctx,id,path,false,element);}),p.btn('Add Comment with Voice',()=>{onClose();openComment(ctx,id,path,true,element);})));}
          p.modalHost(PreviewActions);
        }
        function installActivity(ctx){
          const p=ctx.__agentsPro,h=p.h;let host,root,buttonHost,buttonRoot;
          for(const label of document.querySelectorAll('.ap-row-project')){label.parentElement?.style.removeProperty('flex-wrap');label.remove();}
          const knownRow=row=>{const label=row.querySelector('[aria-label^="Session actions for "]')?.getAttribute('aria-label')?.slice(20);const matches=Object.values(ctx.sessions.list.getSnapshot().byId).filter(s=>s.displayTitle===label||s.title===label);return matches.length===1?matches[0]:undefined;};
          function exportMenu(row,event){event.preventDefault();event.stopPropagation();const rect=pointRect(event.clientX,event.clientY);p.modalHost(function ExportMenu({onClose}){return h(primitives.Menu,{open:true,portal:true,anchor:null,getAnchorRect:()=>rect,side:'right',items:[{id:'save',label:'Save Session as Markdown',icon:h(primitives.IconDownloadOutline16)}],onClose,onSelect:()=>{p.download('export',row.id,row.displayTitle);onClose();}});});}
          const context=e=>{const row=e.target.closest?.('[role=treeitem]');if(!row)return;const item=knownRow(row);if(item)exportMenu(item,e);else if(row.querySelector('[aria-label^="Session actions for "]')){e.preventDefault();e.stopPropagation();row.click();setTimeout(()=>{const snap=ctx.sessions.list.getSnapshot(),selected=snap.byId[snap.current];if(selected)exportMenu(selected,e);},200);}};document.addEventListener('contextmenu',context,true);
          const toggle=()=>{p.setSettings({activity:!p.settings().activity});render();};
          function render(){
            const enabled=p.settings().activity===true,view=document.querySelector('[aria-label="View options"]');if(!view)return;
            if(!buttonHost?.isConnected){buttonHost=document.createElement('span');view.parentElement.append(buttonHost);buttonRoot=reactDom.createRoot(buttonHost);}
            buttonRoot.render(p.btn('Group by activity',toggle,h(primitives.IconClockOutline16),{'aria-pressed':enabled}));
            const menu=[...document.querySelectorAll('[role=menu]')].find(m=>/Group by/.test(m.textContent)&&!m.closest('.ap-controls'));
            if(menu&&!menu.querySelector('[data-ap-activity]')){const item=document.createElement('div');item.dataset.apActivity='true';menu.append(item);const r=reactDom.createRoot(item);r.render(p.btn('Group by activity',()=>{toggle();view.click();},'Group by activity',{role:'menuitem',style:{width:'100%',justifyContent:'flex-start'}}));}
            const tree=document.querySelector('[role=tree]');if(!tree)return;
            if(!host?.isConnected){host=document.createElement('div');host.className='ap-activity-list';tree.parentElement.insertBefore(host,tree);root=reactDom.createRoot(host);}
            tree.style.display=enabled?'none':'';host.hidden=!enabled;
            const snapshot=ctx.sessions.list.getSnapshot();
            if(enabled){const rows=snapshot.ids.map(id=>snapshot.byId[id]).filter(s=>s&&!s.blank);root.render(h(react.Fragment,null,[true,false].map(running=>{const subset=rows.filter(s=>s.running===running).sort((a,b)=>b.updatedAt-a.updatedAt);return subset.length>0&&h('div',{key:String(running)},h(primitives.DisclosureRow,{title:running?'Working':'Recent',open:true,expandable:false}),subset.map(row=>p.btn(row.displayTitle,()=>ctx.sessions.open(row.id),h('span',{className:'ap-activity-copy'},h('span',null,running&&h(primitives.StateDot,{state:'ongoing',size:12}),row.displayTitle),h('span',{className:'ap-activity'},running?'Working':new Date(row.updatedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}))),{key:row.id,className:'ap-activity-row','data-session-id':row.id,'aria-current':snapshot.current===row.id,onContextMenu:e=>exportMenu(row,e)})));})));}

          }
          const timer=setInterval(render,700);const unsubscribe=ctx.sessions.list.subscribe(render);ctx.effect(()=>()=>{clearInterval(timer);unsubscribe();document.removeEventListener('contextmenu',context,true);root?.unmount();buttonRoot?.unmount();host?.remove();buttonHost?.remove();});render();
        }

		function apply(ctx) {
            installFileLinks(ctx);
            installPro(ctx);
            installPreviews(ctx);
            installActivity(ctx);
			wrapFileTreeSplit(ctx.sidebarRight, ctx);
			const run = async (id, path, kind) => {
				const session = currentSession(ctx);
				const root = workspaceRoot(session.cwd);
                if (id === "add-chat") {await ctx.__agentsPro.attach(session.id,path,kind);return;}
                if(id === "comment" || id === "voice-comment"){ openComment(ctx,session.id,path,id === "voice-comment");return;}
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
				void run(id, pending.path, pending.kind).catch(e => {const id=currentSession(ctx).id;ctx.__agentsPro.state(id).status=e.message;ctx.__agentsPro.notify();});
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
			}, "dsh-agents-pro: context menu");
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
