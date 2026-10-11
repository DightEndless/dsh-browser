# @dightendless/dsh-bridge-browser

[English](README.md) | 涓枃

鏈寘鏄?[`DightEndless/dsh-browser`](https://github.com/DightEndless/dsh-browser)锛圼`omdsh-dev/dsh-browser`](https://github.com/omdsh-dev/dsh-browser) 鐨?fork锛夌殑妗ユ帴閮ㄥ垎锛屼娇鐢ㄧ嫭绔嬪寘鍚嶅彂甯冿紝鍥犳涓や釜鍖呭彲浠ュ湪鍚屼竴涓?dsh profile 涓叡瀛樸€?
dsh 鐨?*娴忚鍣ㄦ搷浣滄ˉ**锛氬湪瀹夸富 webserver 涓婃寕杞戒竴涓?**token 璁よ瘉鐨?WebSocket 閫氶亾**锛坄/ext/bridge`锛夛紝渚?Chrome 鎵╁睍杩炴帴锛涙妸鎵╁睍璋冪敤鎶曞奖鍒?dsh 0.2.0 Typert Remotes銆佹寜杩炴帴璺熼殢 Session 涓?Remote Event 娴侊紝骞舵敞鍐?*浠ユ枃鏈负涓?*鐨?`browser_*` 宸ュ叿闆嗏€斺€旂粡鎵╁睍鍦ㄧ湡瀹炴祻瑙堝櫒涓鍙栭〉闈€佺偣鍑诲厓绱犮€佸～鍐欒〃鍗曘€佹粴鍔ㄤ笌瀵艰埅锛岀櫥褰曟€佷繚鐣欍€備晶杈规爮鏄璇濆叆鍙ｏ紝宸ュ叿鎵嶆槸浜у搧鏈綋銆?
**浠ユ枃鏈负涓荤殑娴忚鍣ㄥ伐鍏凤紝澶氭ā鎬佸璇濋€忎紶**锛氶〉闈㈠揩鐓т粛鏄粨鏋勫寲鏂囨湰锛堟爣棰樸€佹鏂囥€佸甫缂栧彿鐨勪氦浜掓竻鍗曘€佹晱鎰熷€兼墦鐮佺殑琛ㄥ崟瀛楁锛夛紝鎵€鏈夋祻瑙堝櫒鍔ㄤ綔鎸夌ǔ瀹氱紪鍙峰鍧€銆俙browser_screenshot` 鏄敮涓€鐨勪緥澶栵紝鑰屼笖瀹冧粛淇濇寔宸ュ叿闈㈢殑鏂囨湰褰㈡€侊細鎻掍欢鎶婃埅鍥惧啓鍏ユ湰鍦版枃浠跺苟杩斿洖璇ヨ矾寰勶紝宸ュ叿缁撴灉閲屼笉鎼哄甫鍍忕礌銆傞€氱敤 RPC 閫氶亾涔熶細閫忎紶 dsh 0.2.0 鐨勫浘鐗囨秷鎭拰鎸佷箙闄勪欢璇诲彇锛涘欢杩熷垱寤虹殑鏂颁細璇濆彧鍦ㄥ涓荤‘瀹炴寕杞介檮浠舵湇鍔℃椂澹版槑鍥剧墖闄愬埗銆?
## 閰嶇疆

| 閿?| 绫诲瀷 | 榛樿 | 璇存槑 |
|---|---|---|---|
| `token` | `string` | 鑷姩鐢熸垚 | 鍥哄畾 bearer token銆傜己鐪佹椂棣栨鍚姩鐢熸垚锛屽啓鍏?`~/.dsh/ext-bridge-token`锛?600锛夊苟鎵撳嵃鍦ㄥ惎鍔ㄦ棩蹇椼€?|
| `toolTimeoutMs` | `number` | 90000 | 鍗曟宸ュ叿璋冪敤棰勭畻锛屼负鎵╁睍鐨?60 绉掑鎵圭獥鍙ｉ鐣欐椂闂淬€?|
| `snapshotMaxChars` | `number` | 32000 | 鍗曟蹇収娓叉煋瀛楃涓婇檺锛屾渶灏忎负 500锛堢粡 `hello.ok` caps 鍗忓晢缁欐墿灞曪級銆?|
| `maxInteractiveItems` | `number` | 60 | 鍗曟蹇収浜や簰娓呭崟鏉℃暟涓婇檺銆?|
| `sessionWorkspacePath` | `string` | `~/.dsh/browser-sessions` | 鎵╁睍鍒涘缓鐨勪細璇濇墍鐢ㄧ殑涓撶敤 Host Workspace銆傛彃浠朵細鍦ㄩ娆¤皟鐢ㄦ湭鏄惧紡鎸囧畾宸ヤ綔鍖虹殑 `session.create` 鏃跺垱寤哄苟骞傜瓑娉ㄥ唽璇ョ洰褰曪紱浼氳瘽鐨?cwd 闅忎箣鍙樹负姝よ矾寰勶紝鍥犳 GUI 浼氭樉绀?`browser-sessions` 宸ヤ綔鍖哄垎缁勩€傝涓?`""` 鍙浼氳瘽缁х画鏄剧ず鍦ㄢ€滄湭鍒嗙粍鈥濅腑銆?|
| `deferSessionCreate` | `boolean` | `true` | 浼氳瘽鍙湪绗竴鏉℃秷鎭椂鎵嶇湡姝ｅ垱寤猴細`session.create` 鍏堣繑鍥炰竴涓唴瀛樻殏瀹?ID锛堜笉钀藉簱锛夛紝鍘嗗彶璇诲彇涓虹┖锛岀涓€娆?`session.prompt` 鎵嶅垱寤虹湡瀹炰細璇濓紙鍚屼竴 ID銆佸洖鏀惧師濮嬪垱寤哄弬鏁帮級銆傚彧鎵撳紑闈㈡澘涓嶈璇濓紝浼氬湪浼氳瘽搴?GUI 閲屼笉鐣欎换浣曠棔杩广€?|

宸ヤ綔鍖哄垎缁勯噰鐢ㄥ敖鍔涜€屼负鏂瑰紡銆傚鏋滅粍鍚堟病鏈?workspace 鍩熴€佺洰褰曞垱寤哄け璐ワ紝鎴?`workspace.create` 鎷掔粷璇ヨ矾寰勶紝鎻掍欢浼氳褰曚竴鏉¤鍛婏紝骞跺湪涓嶆敞鍏ュ伐浣滃尯鐨勬儏鍐典笅鍙戦€佹墍鏈変細璇濆垱寤鸿姹傦紝鍥犳娴忚鍣ㄨ亰澶╀粛鍙娇鐢ㄣ€?
## 浣跨敤

杩滅▼瀹夎鍣ㄤ細涓嬭浇涓€涓敱鑴氭湰鎵樼鐨?workspace锛屾瀯寤烘彃浠讹紝骞跺皢瀹冪殑瀹樻柟 bundle 娉ㄥ唽鍒版湰鏈?dsh 鐨?`web` profile銆傝鏂瑰紡鏃犻渶 Git锛屼篃鏃犻渶鎻愬墠 clone锛?
```sh
curl -fsSL https://raw.githubusercontent.com/DightEndless/dsh-browser/refs/heads/main/scripts/install.sh | bash
cd ~/.dsh/dsh-browser && pnpm start
```

涓嶆兂鏋勫缓鐨勮瘽锛岀洿鎺ョ敤棰勬瀯寤哄寘锛歚npm i @dightendless/dsh-bridge-browser`锛屾垨鎶?`dsh plugin --profile web add` 鎸囧悜 [v0.3.2 鍙戣椤礭(https://github.com/DightEndless/dsh-browser/releases/tag/v0.3.2) 涓婄殑 tgz銆?
Windows 璇锋敼鐢?PowerShell 瀹夎鍣細

```powershell
$s="$env:TEMP\dsh-install.ps1"; irm https://raw.githubusercontent.com/DightEndless/dsh-browser/refs/heads/main/scripts/install.ps1 -OutFile $s; powershell -NoProfile -ExecutionPolicy Bypass -File $s
cd $HOME\.dsh\dsh-browser; pnpm start
```

寮€鍙戣€呬篃鍙互 clone 浠撳簱锛屽湪 checkout 涓緷娆¤繍琛?`./scripts/install.sh` 鍜?`pnpm start`銆傛湰鍦版ā寮忕洿鎺ヤ娇鐢ㄥ綋鍓嶅垎鏀紝涓嶄細涓嬭浇鎴栬鐩栨簮鐮併€備袱绉嶅畨瑁呮ā寮忛兘浼氭敞鍐屽悓涓€涓?profile bundle锛涙瀯寤哄伐鍏峰彧浠庨€夊畾鐨?workspace 瑙ｆ瀽锛岀粷涓嶈鍙栫埗 checkout 鎴栫埗鐩綍鐨?`node_modules`銆?
褰撳墠宸ヤ綔鍖哄浐瀹氫娇鐢?dsh 0.2.0-rc.2 浣滀负鏈€浣庢敮鎸佺増鏈紱鏈寘鐨?peer 鑼冨洿鍚屾椂鎺ュ彈 `0.2.1-alpha` 涓€绾匡紙鍚?`0.2.1-alpha.1`锛屼篃灏辨槸鎻掍欢甯傚満鐢ㄤ簬楠岃瘉鐨勯偅涓増鏈級銆備笉鍐嶆敮鎸佹洿鏃х殑 DSH锛?
```sh
npx @deepseek-ai/dsh@0.2.0-rc.2 web
```

瀹夎鍣ㄤ細鎶婂凡瑙ｅ帇鎵╁睍澶嶅埗鍒?`~/.dsh/browser-extension` 骞舵墦寮€ `chrome://extensions`銆傚湪 Chrome 涓姞杞借繖涓ǔ瀹氱洰褰曪紝鐒跺悗浣跨敤渚ц竟鏍忋€傛墿灞曚細鑷姩鍙戠幇鍥炵幆杩炴帴锛屾棤闇€杈撳叆 token锛涢潪鍥炵幆閮ㄧ讲浠嶉渶瑕侀厤缃殑 bearer token銆?
## 瀹夊叏妯″瀷

- 妗ヨ矾寰勫湪 `/api` 淇′换鏍呮爮**涔嬪**锛堟爡鏍忓彧缃?client-connection 娉ㄥ唽鐨勮矾鐢憋級锛屽洜姝よ嚜甯?bearer token 璁よ瘉锛氶甯у繀椤绘槸 `hello`锛? 绉掑唴锛夛紝甯搁噺鏃堕棿姣斿锛屽け璐ュ嵆鏂紑銆?- `/api` 杞戒綋閽夊湪鍥炵幆涓婄殑鏂规硶锛坄settings.*`銆乣credentials.*`銆乣host.pickDirectory`銆乣host.openPath`锛夊闈炲洖鐜潵婧?*鍗充娇 token 姝ｇ‘涔熸嫆缁?*鈥斺€斿 `--host 0.0.0.0` 閮ㄧ讲鐨勭旱娣遍槻寰°€?- 鍚屼竴鏃跺埢浠呬竴涓椿鍔ㄨ繛鎺ワ紝鏂拌璇佽繛鎺ラ《鏇挎棫杩炴帴銆?- 妗ユ槸 confused-deputy 杈圭晫鑰岄潪閫氱敤璁よ瘉灞傦細涓嶈鎶?`dsh web --host 0.0.0.0` 鏆撮湶鍦ㄤ笉淇′换鐨勭綉缁滀笂銆?- 鎶藉彇鐨勯〉闈㈡枃瀛椾細鏍囪涓烘ā鍨嬬殑涓嶅彲淇¤緭鍏ャ€傞〉闈㈣鍙栭伒寰墿灞曠殑璇㈤棶/鑷姩/鍏抽棴绛栫暐锛涚姸鎬佸彉鏇村伐鍏峰繀椤荤粡杩囨寜 origin 鐨勪晶杈规爮鍐崇瓥锛屾病鏈変晶杈规爮鏃跺け璐ュ叧闂€傚悓婧愬悗缁搷浣滃彲鍙湪褰撳墠渚ф爮浼氳瘽涓复鏃朵俊浠伙紝姘镐箙淇′换浠嶉渶鏄惧紡璁剧疆銆?
## 绾垮崗璁?
甯т负鎸?`t` 鍒ゅ埆鐨?JSON 瀵硅薄锛屽畾涔夊湪 [`protocol.ts`](src/protocol.ts)锛屾槸閫氳繃 workspace 鍖呯殑 `./src/*` export 涓庢墿灞曞叡浜殑鐪熸簮銆傛瀯寤哄悗鐨勫寘杩樹細鍙戝竷 `@dightendless/dsh-bridge-browser/protocol`锛屼緵澶栭儴娑堣垂鏂逛娇鐢ㄣ€?
- 瀹㈡埛绔?鈫?鏈嶅姟绔細`hello`锛堣璇?caps锛夈€乣rpc`锛堢綉鍏虫柟娉曢€忎紶锛夈€乣respond`锛堟寜 RPC id 缁撶畻瀹夸富浜や簰锛夈€乣tool.result`銆乣pong`銆?- 鏈嶅姟绔?鈫?瀹㈡埛绔細`hello.ok`锛堝洖鏄惧崗鍟嗗悗鐨?caps锛夈€乣rpc.result`銆乣respond.result`锛堢浉鍏宠仈鐨勫彈鐞嗙粨鏋滄垨閿欒锛夈€乣event`锛堢敱 dsh Remote 娴佷笌 waterfall 鎶曞奖鑰屾潵鐨?bridge 鍐呴儴浜嬩欢锛夈€乣tool.call`銆乣ping`銆乣error`銆?
姣忎釜 `respond` 鍚屾椂鎼哄甫鍏ㄥ眬鍞竴鐨勪紶杈?id 涓庡涓讳氦浜掔殑 `rpcId`銆傛墿灞曞彧鎶婂洖鎵ц矾鐢辩粰鍙戣捣鎿嶄綔鐨勯潰鏉匡紝骞跺湪瓒呮椂銆侀潰鏉垮叧闂垨妗ユ柇绾挎椂鎷掔粷灏氭湭瀹屾垚鐨勫搷搴斻€?
## 宸ュ叿

| 宸ュ叿 | 鐢ㄩ€?|
|---|---|
| `browser_snapshot` | 缁撴瀯鍖栨枃鏈揩鐓э紙鏍囬/URL/姝ｆ枃/娓呭崟/琛ㄥ崟锛夛紱`delta: true` 鍙繑鍥炲彉鍖栥€?|
| `browser_click` / `browser_click_at` / `browser_type` / `browser_press` / `browser_upload` / `browser_eval` | 鎸夌ǔ瀹氱紪鍙锋搷浣滄竻鍗曞厓绱狅紝鎴栫敤鍙椾俊浠昏緭鍏ョ偣鍑昏鍙ｅ潗鏍囷細杈撳叆鏂囨湰銆侀€変笅鎷夋銆佸嬀閫夋帶浠躲€佺湡瀹炴寜閿粯璁よ涓恒€佷笂浼犳湰鍦版枃浠讹紝浠ュ強閫氳繃 DevTools 鍗忚姹傚€艰剼鏈€?|
| `browser_scroll` / `browser_navigate` / `browser_open_tab` / `browser_back` / `browser_forward` / `browser_reload` | 椤甸潰绉诲姩銆?|
| `browser_get_text` / `browser_images` / `browser_screenshot` / `browser_wait` | 璇诲尯鍩熸枃鏈?/ 鍥剧墖鍦板潃 / 鎴睆瀛樻。 / 绋冲畾涓庢潯浠剁瓑寰呫€?|

## 妯″瀷浣撻獙

- **Token 褰卞搷**锛氫竴娆?`browser_snapshot`锛堥粯璁?32k 瀛楃锛夊甯歌鑻辨枃鏂囨湰绾︿负 8鈥?0k token锛屽叿浣撳彇鍐充簬璇█鍜屽垎璇嶅櫒锛沝elta 蹇収鍙渶闆跺ご銆傜郴缁熸彁绀烘钀藉紩瀵兼ā鍨嬫寜闇€蹇収鑰岄潪鍥ょН椤甸潰鏂囨湰銆?- **KV 缂撳瓨褰卞搷**锛氭棤锛堝揩鐓т笉鍋氭湇鍔＄缂撳瓨锛夈€?- **寤惰繜**锛氭瘡娆″姩浣滅瓑寰呮墿灞曞湪鐪熷疄椤甸潰鎵ц + 绋冲畾妫€娴嬶紙閫氬父 0.2鈥?s锛涘鑸渶闀?5s锛夈€?- **澶辫触妯″紡**锛歚bridge-closed`锛堟墿灞曟湭杩炴帴锛夈€乣timeout`銆乣no-active-tab`銆乣content-unavailable`锛堥〉闈㈤渶鍒锋柊锛夈€乣action-failed`锛堢紪鍙疯繃鏈熲€斺€旀ā鍨嬪簲閲嶆柊蹇収锛夈€?
## 鎵╁睍鐐?
- 宸ュ叿闆嗘槸娑堣垂闈紱seam 鏄ˉ鎺ョ嚎锛坄protocol.ts`锛夈€傚湪 `ctx.tools` 娉ㄥ唽鏂板伐鍏峰苟缁忕敱妗ュ垎鍙戝嵆鍙紝鎵╁睍鐨?content script 鎸夊姩浣滃悕鍒嗗彂銆?- 鍗忓晢 caps锛坄hello.ok`锛夎鎻掍欢鏃犻渶鍏变韩閰嶇疆鏂囦欢鍗冲彲鍚戞墿灞曚笅杈惧揩鐓ч绠椼€?
## 宸茬煡闄愬埗涓庡悗缁伐浣?
- 浠呬竴涓椿鍔ㄦ墿灞曡繛鎺ワ紙绗簩涓獥鍙ｉ《鏇跨涓€涓級銆?- 鍙闂殑璺ㄦ簮 iframe 浼氳繘鍏ュ揩鐓э紝骞堕€氳繃绋冲畾鐨?`(frame, index)` 鍦板潃鎵ц鎿嶄綔锛涘彈淇濇姢鎴栧凡閿€姣佺殑 frame 浼氭爣璁颁负涓嶅彲璁块棶锛屼笉褰卞搷鏁撮〉蹇収銆?- token 鎵嬪姩杞崲锛堟敼 `~/.dsh/ext-bridge-token` 鎴栭厤缃?`token`锛夛紝鏃犺繃鏈熴€?- Playwright 椹卞姩鐨勬墿灞?e2e 浼氬湪缂哄皯鍙敤鐨?Chromium 鍙墽琛屾枃浠舵垨鏋勫缓瀹屾垚鐨勬墿灞曞寘鏃惰嚜琛岃烦杩囥€?- 瀹℃壒鐢辨墿灞?service worker 寮哄埗鎵ц锛岃€屼笉鏄緷璧栨ā鍨嬭嚜瑙夈€傛湭鏉ユ帴鍏?dsh 宸ュ叿绠＄嚎鏃跺彲浠ユ妸鍚屼竴绛栫暐鏆撮湶缁欏叾瀹冨鎴风銆?