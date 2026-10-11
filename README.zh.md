# dsh 娴忚鍣ㄦ搷浣?
> [!NOTE]
> **鎵撳紑娴忚鍣ㄦ墿灞曚晶杈规爮锛屽氨鑳藉師鍦版帴绠′綘褰撳墠姝ｅ湪娴忚鐨勭綉椤点€?*
>
> **鏈粨搴撴槸 [omdsh-dev/dsh-browser](https://github.com/omdsh-dev/dsh-browser) 鐨?fork**锛岃ˉ榻愪簡涓婃父娌℃湁鐨勮兘鍔涳細瑙嗗彛涓庢暣椤?`browser_screenshot`銆乣browser_hover`銆乣browser_click_at`銆乣browser_drag`銆乣browser_batch`銆乣browser_eval`銆乣browser_upload`銆乣browser_images`銆傛ˉ鎺ュ寘浣跨敤鐙珛鐨勫寘鍚?`@dightendless/dsh-bridge-browser`锛屽洜姝ゆ湰 fork 涓庝笂娓稿寘鍙互鍚屾椂瀛樺湪浜庡悓涓€涓?dsh profile 涓紝涓嶄細浜掔浉椤舵浛銆?
[English](README.md) | **涓枃**

[![npm version](https://img.shields.io/npm/v/%40dightendless%2Fdsh-bridge-browser?label=npm&color=cb3837)](https://www.npmjs.com/package/@dightendless/dsh-bridge-browser)

<img width="1672" alt="dsh 娴忚鍣ㄦ搷浣滐細鏈?fork 鏂板鐨勫伐鍏凤紝鍥寸粫涓€鍙板甫鏈夌紪鍙峰厓绱犳竻鍗曚笌渚ц竟鏍忕殑娴忚鍣ㄧ獥鍙ｆ帓甯? src="packages/browser/bridge-browser/assets/screenshots/cover.png" />

<img width="1672" alt="渚ц竟鏍忓凡杩炴帴锛屾鍦ㄨ鍙栦竴涓〉闈? src="packages/browser/bridge-browser/assets/screenshots/browser-and-panel.png" />

鎶?[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 杩炴帴鍒颁綘姝ｅ湪浣跨敤鐨?Chrome 鎴?Firefox 鏍囩椤点€傛ā鍨嬪彲浠ヨ鍙栭〉闈㈠唴瀹广€佹搷浣滄帶浠躲€佸鑸拰绠＄悊鏍囩椤碉紝鍚屾椂淇濈暀鐧诲綍鎬併€佷細璇濆拰 Cookie銆備晶杈规爮鎻愪緵瀵硅瘽鐣岄潰銆?
`dsh` 鏄敱 DeepSeek AI 寮€鍙戠殑寮€婧愩€佹彃浠跺寲 agent harness锛堟櫤鑳戒綋妗嗘灦锛夈€傛湰浠撳簱灏嗛厤濂楃殑娴忚鍣ㄦˉ鎻掍欢涓?Chrome/Firefox MV3 鎵╁睍缁勬垚涓€涓嫭绔嬬殑 pnpm workspace銆?
娴忚鍣ㄦ搷浣滀互鏂囨湰涓轰富锛氶〉闈細杞崲涓虹粨鏋勫寲鏂囨湰鍜屽甫缂栧彿鐨勪氦浜掑厓绱犳竻鍗曪紝妯″瀷閫氳繃缂栧彿瀹氫綅鍏冪礌銆俙browser_screenshot` 鏄敮涓€浼氳繑鍥炲浘鐗囩殑宸ュ叿鈥斺€斿畠鎶婃埅鍥惧瓨鎴愭湰鍦版枃浠讹紝鍙妸璺緞浜ょ粰妯″瀷锛屽洜姝ら〉闈㈤€氶亾渚濈劧淇濇寔鏂囨湰褰㈡€併€俤sh 0.2.0 鐨勫妯℃€佸璇濇槸鍙︿竴鏉＄嫭绔嬮€氶亾锛氬涓诲０鏄庡浘鐗囪兘鍔涙椂锛屼晶鏍忓彲鍙戦€?PNG銆丣PEG銆乄ebP 鍜?GIF銆?
> [!IMPORTANT]
> 褰撳墠宸ヤ綔鍖哄浐瀹氫娇鐢?dsh 0.2.0-rc.2 浣滀负鏈€浣庢敮鎸佺増鏈紱鍙戝竷鍖呭悓鏃舵帴鍙?`0.2.1-alpha` 涓€绾匡紙鍚?`0.2.1-alpha.1`锛屼篃灏辨槸鎻掍欢甯傚満鐢ㄤ簬楠岃瘉鐨勯偅涓増鏈級銆備笉鍐嶆敮鎸佹洿鏃х殑 DSH銆?
## 蹇€熷畨瑁?
鏈変笁鏉¤矾绾裤€傛湰椤圭洰鍚屾椂鍖呭惈 dsh bridge plugin 鍜屾祻瑙堝櫒鎵╁睍锛岃€屾墿灞曡繖涓€鍗婂湪 Chrome 閲屽彧鑳戒互銆屽姞杞藉凡瑙ｅ帇銆嶇殑鏂瑰紡瀹夎鈥斺€旀祻瑙堝櫒涓嶆彁渚涘埆鐨勯€斿緞銆傛墍浠ラ櫎闈炵敤瀹夎鍣紝涓ゅ崐鏄垎寮€瑁呯殑銆?
**1. 鍙鎻掍欢**锛堝凡棰勬瀯寤猴紝鏃犻渶鏋勫缓姝ラ锛屼篃涓嶉渶瑕?Git锛夛細

```sh
dsh plugin --profile web add https://github.com/DightEndless/dsh-browser/releases/download/v0.3.2/dightendless-dsh-bridge-browser-0.3.2.tgz
```

鍚屼竴涓寘涔熷彂甯冨湪 npm 涓婏細[`@dightendless/dsh-bridge-browser`](https://www.npmjs.com/package/@dightendless/dsh-bridge-browser)锛坄npm i @dightendless/dsh-bridge-browser`锛夛紝閫傚悎浠?registry 鑰屼笉鏄彂琛岃祫浜цВ鏋愭彃浠剁殑鐜銆?
**2. 鍙鎵╁睍**锛堝凡棰勬瀯寤猴級锛氫笅杞?[`dsh-browser-extension-0.3.2.zip`](https://github.com/DightEndless/dsh-browser/releases/download/v0.3.2/dsh-browser-extension-0.3.2.zip)锛?瑙ｅ帇鍚庢墦寮€ `chrome://extensions`锛圗dge 鏄?`edge://extensions`锛夛紝寮€鍚彸涓婅**寮€鍙戣€呮ā寮?*锛岀偣
**鍔犺浇宸茶В鍘嬬殑鎵╁睍绋嬪簭**锛岄€変腑瑙ｅ帇鍑烘潵鐨勯偅涓枃浠跺す銆?
璺嚎 1 鍔犺矾绾?2 灏辨槸瀹屾暣瀹夎锛岃€屼笖**閮戒笉闇€瑕?Node銆乸npm 鎴?Git**銆?
**3. 涓ゅ崐涓€璧疯**锛岀敤涓€琛屽畨瑁呭櫒锛氬畠浼氭瀯寤哄苟娉ㄥ唽妗ユ彃浠躲€佹妸 Chrome 鎵╁睍鏋勫缓鍒?`~/.dsh/browser-extension`锛岀劧鍚庢墦寮€ `chrome://extensions`锛?
macOS 涓?Linux锛?
```sh
curl -fsSL https://raw.githubusercontent.com/DightEndless/dsh-browser/refs/heads/main/scripts/install.sh | bash
```

Windows锛圥owerShell锛夛細

```powershell
$s="$env:TEMP\dsh-install.ps1"; irm https://raw.githubusercontent.com/DightEndless/dsh-browser/refs/heads/main/scripts/install.ps1 -OutFile $s; powershell -NoProfile -ExecutionPolicy Bypass -File $s
```

杩欐潯璺嚎闇€瑕?Node.js 22+ 涓?pnpm锛屽洜涓哄畠瑕佷粠婧愮爜鏋勫缓涓ゅ崐銆?
鏃犺璧板摢鏉¤矾绾匡紝鏈€鍚庨兘鍦ㄦ祻瑙堝櫒鎵╁睍椤甸潰閲屽姞杞芥垨閲嶆柊鍔犺浇 **dsh 娴忚鍣ㄥ姪鎵?*锛涘鏋?dsh 宸茬粡鍦ㄨ繍琛岋紝瑁呭畬璇烽噸鍚€傚墠缃姹傘€佸惎鍔ㄥ懡浠ゃ€佹洿鏂版柟寮忓拰寮€鍙戣€呭畨瑁呰瑙乕璇︾粏瀹夎涓庝娇鐢╙(#璇︾粏瀹夎涓庝娇鐢?銆?
涔熷彲浠ヤ粠浠撳簱婧愮爜瀹夎鎻掍欢鈥斺€擿dsh plugin --profile web add github:DightEndless/dsh-browser#path:/packages/browser/bridge-browser`鈥斺€斾絾璇ュ寘浼氬湪瀹夎鏃惰嚜琛屾瀯寤猴紝鑰?pnpm 瀵?git 鏉ユ簮鐨勫寘榛樿鎷掔粷鎵ц鏋勫缓鑴氭湰锛屽繀椤诲厛鎵嬪伐鍔犱竴鏉?`allowBuilds` 鎵嶄細鏋勫缓銆備笂闈㈢殑 release 璧勪骇娌℃湁杩欎釜闂锛屽洜涓哄畠浠凡缁忔槸鏋勫缓濂界殑浜х墿銆?
> [!IMPORTANT]
> npm 涓婃湭鍔?scope 鐨?[`dsh-browser`](https://www.npmjs.com/package/dsh-browser) 鍖呭睘浜庡彟涓€涓」鐩紝涓庢湰浠撳簱鏃犲叧銆傛湰 fork 鍚屾牱娌℃湁鍙戝竷 npm 鍖咃細涓婃柟鐨勯鏋勫缓璧勪骇灏辨槸瀹夎鏂瑰紡锛屽畨瑁呭櫒鍒欐槸"涓€鏉″懡浠よ榻?鐨勬浛浠ｆ柟妗堛€?
## 鎬ц兘鍩哄噯

鍦?2026 骞?8 鏈?18 鏃ュ畬鎴愮殑 60 娆￠厤瀵圭鍒扮璇勬祴涓紙璇ヨ瘎娴嬪湪涓婃父椤圭洰涓婃祴寰楋紝鏈?fork 涓庝箣鍏辩敤鍚屼竴濂楅〉闈㈠伐鍏烽潰锛夛紝涓や釜鍚庣鍒嗛厤鍒扮殑 30 娆¤繍琛屽潎鍏ㄩ儴鎴愬姛锛沝sh 娴忚鍣ㄦ搷浣滀娇鐢ㄤ簡鏇村皯鐨勬ā鍨?宸ュ叿杞锛屽苟浠ユ洿鐭椂闂村畬鎴愪换鍔★細

| 鍚庣 | 鎴愬姛鐜?| 骞冲潎绔埌绔€楁椂 | 骞冲潎娴忚鍣ㄥ伐鍏疯皟鐢?|
|---|---:|---:|---:|
| **dsh 娴忚鍣ㄦ搷浣?* | **30/30** | **5.32 绉?* | **3.4** |
| 瀵归綈宸ュ叿濂戠害鐨?Playwright 鍩虹嚎 | 30/30 | 6.67 绉?| 4.7 |

Playwright / 鎵╁睍鐨勯厤瀵硅€楁椂姣斾负 **1.24**锛?5% CI **1.16鈥?.34**锛夛細Playwright 鑰楁椂绾﹀ 24%锛涚瓑浠峰湴璇达紝dsh 娴忚鍣ㄦ搷浣滃皢寤惰繜闄嶄綆绾?20%锛屾瘡涓换鍔″钩鍧囪妭鐪?1.35 绉掋€傝瘎娴嬩娇鐢?6 涓祻瑙堝櫒浠诲姟銆? 涓‘瀹氭€?seed銆佺浉鍚岀殑 DSH profile 涓庢ā鍨嬶紙`deepseek-v4-flash`锛夛紝骞堕€氳繃鐙珛椤甸潰鐘舵€侀獙璇佺粨鏋溿€傝瑙乕璇勬祴鏂规硶涓庡鐜拌鏄嶿(benchmark/README.md)銆?
## 鏍稿績鑳藉姏

| 鑳藉姏 | 宸ュ叿 | 璇存槑 |
|---|---|---|
| 璇诲彇椤甸潰 | `browser_snapshot` | 缁撴瀯鍖栨枃鏈揩鐓э細鏍囬/URL/姝ｆ枃/缂栧彿浜や簰娓呭崟/琛ㄥ崟瀛楁锛堟晱鎰熷€兼帺鐮侊級锛沗delta: true` 鍙繑鍥炲彉鍖?|
| 鐐瑰嚮鍏冪礌 | `browser_click` | 鎸夌紪鍙风偣鍑婚摼鎺?鎸夐挳/澶嶉€夋绛?|
| 鎸夊潗鏍囩偣鍑?| `browser_click_at` | 鐢ㄥ彈淇′换鐨勯紶鏍囪緭鍏ョ偣鍑昏鍙ｅ唴鐨勪綅缃紱`x`/`y` 涓鸿鍙ｆ瘮渚?|
| 濉啓琛ㄥ崟 | `browser_type` | 杈撳叆鏂囨湰锛圧eact/Vue 鍙楁帶缁勪欢鍏煎锛夛紱鎸夊彲瑙佹枃瀛楁垨 value 閫変笅鎷夋锛涘嬀閫?鍙栨秷澶嶉€夋涓庡崟閫夋锛沗replace` 娓呯┖閲嶅～ |
| 涓婁紶鏂囦欢 | `browser_upload` | 鎸夎矾寰勬妸鏈湴鏂囦欢鎸傚埌鏂囦欢杈撳叆妗嗭紱瀹℃壒妗嗕細鏄剧ず鏂囦欢璺緞 |
| 鎵ц鑴氭湰 | `browser_eval` | 閫氳繃 DevTools 鍗忚鍦ㄩ〉闈㈤噷姹傚€?JavaScript 骞惰繑鍥炵粨鏋滐紱闇€瑕?`debugger` 鏉冮檺 |
| 鎸夐敭 | `browser_press` | Enter/Tab/Escape/鏂瑰悜閿瓑銆俆ab 鐪熸绉诲姩鐒︾偣锛孍nter/绌烘牸鐪熸瑙﹀彂椤甸潰榛樿琛屼负 |
| 婊氬姩 | `browser_scroll` | 瑙嗗彛婊氬姩锛坲p/down/top/bottom锛?|
| 椤甸潰瀵艰埅 | `browser_navigate` / `browser_open_tab` / `browser_back` / `browser_forward` / `browser_reload` | 鍙楁帶鏍囩椤靛唴瀵艰埅锛屾垨鏂板紑鏍囩椤靛苟璺熼殢锛坄active:false` 鏃朵繚鎸佸綋鍓嶉〉鍦ㄥ墠鍙帮級 |
| 鍒楀嚭鏍囩椤?| `browser_list_tabs` | 鍒楀嚭鍙闂爣绛鹃〉鐨勭ǔ瀹?ID銆佹爣棰樸€乁RL銆佺獥鍙?椤哄簭浠ュ強娲诲姩/鍙楁帶鐘舵€?|
| 璺熼殢鏍囩椤?| `browser_follow_tab` | 灏嗗悗缁祻瑙堝櫒宸ュ叿缁戝畾鍒?`browser_list_tabs` 杩斿洖鐨勬爣绛鹃〉锛岃€屼笉婵€娲昏鏍囩椤?|
| 鍏抽棴鏍囩椤?| `browser_close_tab` | 鍏抽棴 `browser_list_tabs` 杩斿洖鐨勬爣绛鹃〉 |
| 璇诲彇鍖哄煙 | `browser_get_text` | 鎳掑姞杞藉唴瀹?/ 灞€閮ㄦ枃鏈?|
| 鍒楀嚭鍥剧墖 | `browser_images` | 姝ｆ枃鍖虹殑缁濆鍥剧墖鍦板潃锛屾瘡寮犱竴琛岋紝甯﹀楂樸€乤lt 鍜屾噿鍔犺浇/鍗犱綅鏍囪锛涗細瑙ｆ瀽 `zoomfile`/`file`/`data-src` 閫氶亾锛屾敮鎸?`selector`銆乣limit`銆乣allFrames` |
| 鎴彇鐢婚潰 | `browser_screenshot` | 鎶婂彲瑙佸尯鍩熷瓨鎴愭湰鍦板浘鐗囧苟杩斿洖璺緞渚?`read_image` 鏌ョ湅锛涢〉闈㈠惈涔夐潬瑙嗚锛堥獙璇佺爜銆佸浘琛ㄣ€佹帓鐗堬級鎴栧浘鐗囨湰韬嬁涓嶅埌鏃剁敤瀹?|
| 绛夊緟 | `browser_wait` | 椤甸潰绋冲畾妫€娴嬶紱涔熷彲绛?`selector`/`text` 鍑虹幇锛屾垨閰嶅悎 `gone` 绛夊畠娑堝け锛岀敤 `timeoutMs` 闄愭椂 |
| 鍙戦€佸浘鐗?| `session.prompt` / `session.attachment` | 鎸夊涓昏兘鍔涘惎鐢ㄥ浘鐗囪崏绋裤€佺函鍥剧墖娑堟伅鍜屾寔涔呭巻鍙查瑙?|
| 寮曠敤閫変腑鍐呭 | 渚ф爮杈撳叆妗?| 鍦ㄩ〉闈㈤噷鍒掗€夌殑鏂囧瓧浼氬嚭鐜板湪杈撳叆妗嗭紝闅忎笅涓€鏉℃秷鎭竴璧峰彂閫侊紝骞跺甫涓婃潵婧愪笌涓嶅彲淇″唴瀹硅竟鐣?|

## 缁勬垚

```
packages/browser/bridge-browser/
  cordis.patch.yml
extensions/dsh-browser/
scripts/install.sh
scripts/install.ps1
```

## 涓轰粈涔堣繖鏍疯璁?
- **浣跨敤浣犵殑鐪熷疄娴忚鍣紝鑰屼笉鏄棤澶村壇鏈?*锛氭ā鍨嬫搷浣滀綘宸茬粡鎵撳紑鐨勯〉闈紝鐧诲綍鎬併€佷細璇濆拰 Cookie 鍧囦細淇濈暀銆?- **浠ユ枃鏈负涓荤殑椤甸潰鎺ュ彛**锛氱紪鍙锋帶浠躲€佽法蹇収绋冲畾 ID銆乨elta 鏇存柊鍜屾晱鎰熷€兼帺鐮侊紝浣挎ā鍨嬫棤闇€鎴浘涔熻兘鎿嶄綔椤甸潰锛涚敤鎴蜂富鍔ㄦ坊鍔犵殑瀵硅瘽鍥剧墖璧?dsh 鐙珛鐨勫妯℃€佹秷鎭€氶亾銆?- **鐢ㄣ€屾寚銆嶄唬鏇裤€屾弿杩般€?*锛氱洿鎺ュ垝閫変綘瑕侀棶鐨勯偅娈垫枃瀛楋紝渚ф爮浼氭妸瀹冨紩鐢ㄤ笅鏉ワ紝璇淬€岃В閲婅繖涓€嶄笉蹇呭啀鎻忚堪鏁撮〉鍐呭銆傚彧鏈変晶鏍忔墦寮€鏃舵墠浼氭崟鑾凤紝骞朵笖鍦ㄤ綘鍙戦€佹秷鎭箣鍓嶄笉浼氱寮€娴忚鍣ㄣ€?- **鏀剁獎闅愮杈圭晫**锛氬瘑鐮佸拰鏀粯鍗″瓧娈靛缁堟樉绀轰负 `鈥⑩€⑩€⑩€锛屽瓧娈靛€间笉浼氱寮€椤甸潰銆?- **鍙椾繚鎶ょ殑妗ヨ繛鎺?*锛氳繙绋嬭繛鎺ヤ娇鐢ㄨ璇佹彙鎵嬶紝鐗规潈缃戝叧鏂规硶鎷掔粷闈炲洖鐜皟鐢ㄦ柟锛屾墿灞曟妸宸ュ叿缁戝畾鍒颁竴涓敱鐢ㄦ埛鎺у埗鐨勬爣绛鹃〉銆?
## 璇︾粏瀹夎涓庝娇鐢?
鍓嶇疆瑕佹眰锛歂ode.js `^22.19` 鎴?`>=24`銆丆orepack/pnpm锛屼互鍙?Chrome 116+ 鎴?Firefox 140+銆俉indows 杩橀渶瑕佺郴缁熻嚜甯︾殑 Windows PowerShell 5.1锛屾垨 PowerShell 7+銆?
### 瀹夎鎴栨洿鏂?
鎵樼瀹夎璇疯繍琛岋細

```sh
curl -fsSL https://raw.githubusercontent.com/DightEndless/dsh-browser/refs/heads/main/scripts/install.sh | bash
```

Windows 璇疯繍琛岋細

```powershell
$s="$env:TEMP\dsh-install.ps1"; irm https://raw.githubusercontent.com/DightEndless/dsh-browser/refs/heads/main/scripts/install.ps1 -OutFile $s; powershell -NoProfile -ExecutionPolicy Bypass -File $s
```

瀹夎鍣ㄤ細涓嬭浇鏈粨搴撶殑榛樿鍒嗘敮銆佹瀯寤哄苟娉ㄥ唽妗ユ彃浠躲€佹妸 Chrome 鎵╁睍鏋勫缓鍒?`~/.dsh/browser-extension`锛岀劧鍚庢墦寮€ `chrome://extensions`銆傞娆″畨瑁呮椂锛岃鎶婅鐩綍浣滀负宸茶В鍘嬫墿灞曞姞杞斤紱鏇存柊鏃剁偣鍑?*閲嶆柊鍔犺浇**銆傚鏋?dsh 宸插湪杩愯锛岃閲嶅惎銆?
`scripts/install.sh` 瑕嗙洊 macOS 涓?Linux锛宍scripts/install.ps1` 瑕嗙洊 Windows锛涗袱鑰呭啓鍏ュ悓涓€涓墭绠″伐浣滃尯鍜屽悓涓€浠藉畨瑁呭厓鏁版嵁銆傚綋绯荤粺鎻愪緵鍓创鏉垮伐鍏凤紙`pbcopy`銆乣wl-copy`銆乣xclip`銆乣xsel` 鎴?PowerShell 鐨?`Set-Clipboard`锛夋椂锛屽畨瑁呭櫒浼氭妸鎵╁睍璺緞澶嶅埗鍒板壀璐存澘锛涙棤璁烘槸鍚﹀鍒舵垚鍔熼兘浼氭墦鍗拌璺緞銆傝嫢鏈娴嬪埌 Chrome/Chromium锛屽畨瑁呭櫒浼氭墦鍗板搴旂殑瀹夎鍛戒护锛涜缃?`DSH_INSTALL_BROWSER=1` 鍙瀹夎鍣ㄥ皾璇曡嚜鍔ㄥ畨瑁呫€?
Windows 鍛戒护鍏堜笅杞?`install.ps1` 鍐嶆墽琛岋紝鑰屼笉鏄閬撶粰 `Invoke-Expression`锛氳剼鏈槸甯?BOM 鐨?UTF-8锛學indows PowerShell 渚濊禆 BOM 鎵嶈兘姝ｇ‘鏄剧ず涓枃锛岃€?`Invoke-Expression` 鏃犳硶澶勭悊寮€澶寸殑 BOM銆傛湰鍦?checkout 璺緞鍙互鍖呭惈绌烘牸锛涘畨瑁呭櫒閫氳繃 profile 鍐呯殑鐩綍鑱旀帴娉ㄥ唽妗ユ彃浠讹紝鍥犳鍖呰鏍间腑涓嶄細鍑虹幇 Windows 缁濆璺緞銆?
濡傞渶浠庢簮鐮?checkout 瀹夎褰撳墠鍒嗘敮锛?
```sh
git clone https://github.com/DightEndless/dsh-browser.git
cd dsh-browser
./scripts/install.sh
```

Windows 璇峰湪 checkout 涓繍琛?`.\scripts\install.ps1`銆傛媺鍙栨垨鍒囨崲鐗堟湰鍚庯紝璇烽噸鏂拌繍琛屽畨瑁呭櫒骞堕噸鏂板姞杞芥墿灞曘€?
### Firefox 婧愮爜鏋勫缓

Firefox 浣跨敤鐙珛鐨?MV3 manifest銆佷簨浠堕〉鍚庡彴鍜?Sidebar銆傚湪 checkout 涓瀯寤哄悗锛屾墦寮€ `about:debugging#/runtime/this-firefox`锛岄€夋嫨銆屼复鏃惰浇鍏ラ檮鍔犵粍浠躲€嶏紝鍐嶉€夊彇 `extensions/dsh-browser/dist-firefox/manifest.json`锛?
```sh
pnpm install
pnpm --filter dsh-browser-extension run build:firefox
```

妗ュ湴鍧€浠嶄細鑷姩鎺㈡祴銆侳irefox 鐨?`moz-extension://` UUID 涓嶈兘璇佹槑鎵╁睍韬唤锛屽洜姝ら渶瑕佹妸 `~/.dsh/ext-bridge-token` 涓殑 bearer token 濉叆鎵╁睍璁剧疆锛坉sh 鍚姩鏃ュ織浼氭姤鍛婅鏂囦欢璺緞锛夈€傜鍚嶅彂甯冩椂鍙洿鎺ヤ娇鐢ㄥ悓涓€浠?`dist-firefox/` 浜х墿銆?
### 鍚姩涓庝娇鐢?
鍚姩鎵樼瀹夎锛?
```sh
cd ~/.dsh/dsh-browser && pnpm start
```

浣跨敤婧愮爜 checkout 鏃讹紝璇峰湪浠撳簱鏍圭洰褰曡繍琛?`pnpm start`銆傚彈鏀寔鐨勭簿纭叕寮€鐗堟湰涓猴細

```sh
npx @deepseek-ai/dsh@0.2.0-rc.2 web
```

Chrome 鏈満浣跨敤鏃犻渶閰嶇疆锛汧irefox 闇€瑕佸～鍐欎笂杩版湰鍦版ˉ token銆傛墦寮€椤甸潰锛岀偣鍑?DeepSeek 椴搁奔鍥炬爣锛岀瓑寰呬晶杈规爮鏄剧ず**宸茶繛鎺?*銆傚凡鏈?HTTP(S) 鏍囩椤典細鍦ㄧ涓€娆℃搷浣滄椂鑷姩鍔犺浇銆傚湪娴忚鍣ㄥ彈淇濇姢椤甸潰鍜屾墿灞曞晢搴椾腑锛屾ā鍨嬪彲浠ヨ鍙栨爣绛鹃〉鍏冩暟鎹紝骞堕€氳繃娴忚鍣ㄧ骇鑳藉姏瀵艰埅鍒?HTTP(S)銆佸悗閫€銆佸墠杩涘拰鍒锋柊锛屼絾涓嶈兘璇诲彇鎴栨搷浣滃彈淇濇姢椤甸潰鐨?DOM銆?
## 鏁呴殰鎺掓煡

**渚ц竟鏍忎竴鐩存樉绀恒€屾湭杩炴帴銆?*

- 纭鏈満 dsh web 姝ｅ湪杩愯锛堥粯璁?`http://127.0.0.1:3080`锛夈€?- 纭妗ユ帴宸插姞杞斤細娴忚鍣ㄦ墦寮€ `http://127.0.0.1:3080/ext/bridge-config`锛屽簲杩斿洖绫讳技 `{"wsUrl":"ws://127.0.0.1:3080/ext/bridge"}` 鐨?JSON銆傚鏋滆繑鍥炵殑鏄綉椤佃€屼笉鏄?JSON锛岃鏄庡綋鍓嶈繍琛岀殑 dsh 鏃╀簬妗ユ帴娉ㄥ唽鈥斺€旈噸鍚?dsh 骞跺埛鏂伴〉闈㈠嵆鍙紝鎵╁睍浼氳嚜鍔ㄩ噸杩炪€?- 鎵╁睍浼氳嚜鍔ㄦ帰娴?3080/3081/3090/14389 绔彛銆傝嫢 dsh 杩愯鍦ㄥ叾瀹冪鍙ｏ紝鎴栦娇鐢?`--host 0.0.0.0` 杩滅▼閮ㄧ讲锛岃鍦ㄩ潰鏉胯缃腑濉啓鍦板潃涓庢ˉ鎺?token銆侳irefox 濮嬬粓闇€瑕?token銆?
## 寮€鍙?
妗ユ帴鎻掍欢鍜?Chrome/Firefox 鎵╁睍閮藉睘浜庢湰浠撳簱 workspace锛涙墍鏈夊懡浠ゅ潎鍦ㄦ湰浠撳簱鏍圭洰褰曟墽琛屻€傞娆″紑鍙戝畨瑁呰繍琛?`pnpm install`銆?
```sh
pnpm run build
pnpm run typecheck
pnpm run test
pnpm run check:runtime
pnpm run test:smoke

pnpm --filter @dightendless/dsh-bridge-browser run build
pnpm --filter @dightendless/dsh-bridge-browser run typecheck
pnpm --filter @dightendless/dsh-bridge-browser run test

pnpm --filter dsh-browser-extension run build
pnpm --filter dsh-browser-extension run build:firefox
pnpm --filter dsh-browser-extension run test
```

娉ㄦ剰锛?
- 鍚姩鍓嶆ˉ鎺ユ彃浠跺繀椤诲凡鏈?`lib/` 渚?Loader 鍔犺浇锛沗scripts/install.sh` 鍜屾牴鐩綍 `pnpm run build` 閮戒細鍏堟瀯寤烘彃浠跺啀鏋勫缓鎵╁睍銆?- 妗ユ瀯寤轰娇鐢?Node.js `copyFileSync` 澶嶅埗娴忚鍣ㄥ鎴风锛屽洜姝ゅ悓涓€鏉″寘鑴氭湰涓嶄緷璧?Unix `cp` 鍛戒护銆?- `@deepseek-ai/dsh` 涓庢ˉ鎺ユ彃浠剁殑渚濊禆鍥哄畾鍦ㄥ悓涓€鏉＄粡杩囬獙璇佺殑鍏紑鍙戝竷绾夸笂锛涘崌绾ф椂蹇呴』鍚屾椂鏇存柊 manifest銆侀攣鏂囦欢骞堕噸璺戞牴鐩綍妫€鏌ャ€?
`check:runtime` 妫€鏌ュ疄闄呰В鏋愮殑 DSH 渚濊禆鍜岄攣鏂囦欢锛沗test:smoke` 浣跨敤涓存椂 DSH home 鍚姩鐪熷疄 web 瀹夸富锛岄獙璇佹ˉ鎺ュ拰閲嶅惎鍚庣殑浼氳瘽璇诲彇锛屾棤闇€妯″瀷瀵嗛挜銆侰I 鍦ㄥ共鍑€瀹夎鍚庤繍琛岃繖浜涙鏌ャ€?
濡傛灉閬囧埌 `cache.hydratePrepared is not a function`锛屾洿鏂颁粨搴撳悗閲嶆柊杩愯 `pnpm install --frozen-lockfile` 鍜?`pnpm run build`锛屽啀閲嶅惎 `pnpm start`銆傛棤闇€鍒犻櫎浼氳瘽鏁版嵁鎴栨竻绌哄叏灞€缂撳瓨銆?
## 瀹夊叏

- 妗ヨ矾寰勫湪 `/api` 淇′换鏍呮爮涔嬪锛岃嚜甯?bearer token 璁よ瘉銆?- Chrome 鎵╁睍鐨勬湰鍦?Origin 淇濈暀闆堕厤缃洖鐜闂紱Firefox Origin 鏄瘡娆″畨瑁呯敓鎴愮殑 UUID锛屽繀椤绘惡甯?bearer token銆?- 鐗规潈缃戝叧鏂规硶锛坄settings.*`/`credentials.*`/`host.open*`锛夊闈炲洖鐜潵婧愪竴寰嬫嫆缁濄€?- 鍗曟椿鍔ㄨ繛鎺ワ紱娴忚鍣ㄩ〉闈㈢绾块粯璁や互缁撴瀯鍖栨枃鏈憟鐜帮紝`browser_screenshot` 鏄敮涓€浼氳繑鍥炲浘鐗囩殑娴忚鍣ㄥ伐鍏凤細鎴浘钀藉埌鏈湴鏂囦欢锛屾ā鍨嬫嬁鍒扮殑鏄璺緞锛岃€屼笉鏄唴鑱斿儚绱犮€傜敤鎴蜂富鍔ㄦ坊鍔犵殑瀵硅瘽鍥剧墖浜ょ粰 dsh 鎸佷箙闄勪欢鏈嶅姟锛屽瘑鐮佸拰鍗″彿鍊兼案涓嶅洖浼犮€?- 鍔╂墜寮€濮嬪伐浣滄椂浼氱粦瀹氬綋鏃剁殑娲诲姩鏍囩椤碉紙鎻愪氦鎻愮ず鏃剁粦瀹氾紱鐩存帴璋冪敤娴忚鍣ㄥ伐鍏锋椂鍒欏湪棣栨璋冪敤缁戝畾锛夈€傜敤鎴锋墜鍔ㄥ垏椤靛悗锛屽悗缁祻瑙堝櫒鎿嶄綔浼氭殏鍋滐紝渚ф爮浼氳闂鍔╂墜缁х画鍘熼〉闈㈣繕鏄窡闅忔柊椤甸潰锛涢€夋嫨鍘熼〉闈㈠悗鍏佽鍦ㄥ悗鍙扮户缁紝浣嗘墿灞曠粷涓嶉潤榛樻敼缁戞垨鍒囨崲鐢ㄦ埛姝ｅ湪鐪嬬殑椤甸潰銆傚彈鎺ф爣绛鹃〉鍏抽棴鍚庝篃浼氭殏鍋滐紝鐩村埌鐢ㄦ埛鏄惧紡閫夋嫨褰撳墠椤点€?- 鍙湁鍦ㄤ晶鏍忔墦寮€銆佷笖椤甸潰鍏变韩涓嶆槸銆屽叧闂€嶆椂鎵嶄細鎹曡幏鍒掗€夊唴瀹癸紝瀵嗙爜鍜屽崱鍙峰瓧娈垫案涓嶈鍙栥€傚唴瀹瑰湪鍙戦€佷箣鍓嶅缁堢暀鍦ㄦ墿灞曞唴閮紱绉婚櫎銆侀〉闈㈣烦杞垨鏍囩椤靛叧闂兘浼氫涪寮冨畠锛涘彂閫佹椂涓庨〉闈㈠揩鐓т竴鏍峰寘鍦ㄤ笉鍙俊鍐呭杈圭晫鍐咃紝鏉ユ簮鏍囬鍜?URL 鍚屾牱鐢遍〉闈㈡彁渚涳紝鍥犳涔熸斁鍦ㄨ竟鐣屼箣鍐呫€?- 缃戦〉鏂囧瓧浼氭爣璁颁负涓嶅彲淇¤緭鍏ャ€傞粯璁ゃ€岃嚜鍔ㄥ叡浜€嶅彧鎸夐渶璇诲彇鍙楁帶鏍囩椤典笖涓嶉澶栧脊绐楋紱瀵归殣绉佹晱鎰熸椂鍙€夋嫨銆屾瘡娆¤闂€嶏紝鎴栫敤銆屽叧闂€嶅畬鍏ㄩ樆鏂鍙栥€傚湪銆屾瘡娆¤闂€嶆ā寮忎笅锛岃鍙栧脊绐楀彲浠ヤ粎鍏佽涓€娆★紝涔熷彲浠ユ寔涔呭垏鍥炶嚜鍔ㄨ鍙栵紱涔嬪悗浠嶅彲鍦ㄨ缃腑鍏抽棴銆傝鍙栫殑椤甸潰鏂囧瓧浼氬彂閫佺粰褰撳墠閫夋嫨鐨勬ā鍨嬨€?- 鐐瑰嚮銆佽緭鍏ャ€佹寜閿€佸鑸€佸巻鍙茶烦杞拰鍒锋柊榛樿澶辫触鍏抽棴锛屽繀椤荤敱鐢ㄦ埛鎵瑰噯銆傚彲浠ュ彧鍦ㄥ綋鍓嶄晶鏍忎細璇濅腑淇′换鍗曚釜 origin锛堟渶鍚庝竴涓晶鏍忓叧闂垨 Service Worker 閲嶅惎鍗虫竻绌猴級锛涙案涔呬俊浠婚渶鍦ㄨ缃腑鏄惧紡绠＄悊銆傛樉寮忚法鍩?`browser_navigate` 鍜屾湭鐭ョ洰鏍囩殑鍘嗗彶璺宠浆濮嬬粓閲嶆柊璇㈤棶銆?- **鍏佽妯″瀷瀹屽叏鎺у埗娴忚鍣?*鏄樉寮忕殑鍏ㄥ眬閫夋嫨锛屽彧鏈夎缃繚瀛樻垚鍔熷悗鎵嶄細鐢熸晥銆傚惎鐢ㄥ悗锛岄〉闈㈣鍙栥€侀〉闈㈡搷浣滃拰鏍囩椤靛垪鍑?璺熼殢/鍏抽棴閮戒笉浼氬啀璇锋眰纭銆傝皟鐢ㄥ湪鏀跺埌鏃跺浐瀹氬叾璁块棶妯″紡锛屽洜姝ゅ紑鍚畬鍏ㄦ帶鍒朵笉浼氳拷婧彁鍗囧凡缁忓紑濮嬬殑鍙楅檺璋冪敤銆傚叧闂細绔嬪嵆鐢熸晥锛氬彇娑堝皻鏈笅鍙戞搷浣滅殑璋冪敤锛岀瓑寰呭凡缁忎笅鍙戝埌娴忚鍣ㄧ殑鎿嶄綔瀹屾垚锛屽啀淇濆瓨闄愬埗璁剧疆銆傚揩閫熼噸鏂板紑鍚篃浼氬湪鏃ф潈闄愭挙閿€瀹屾垚鍓嶄繚鎸佸彈闄愶紝骞跺彂淇濆瓨浼氭寜璇锋眰椤哄簭钀界洏銆傛棤璁烘槸鍚﹀惎鐢紝娴忚鍣ㄥ彈淇濇姢椤甸潰鐨?DOM 鍐呭閮芥棤娉曡闂€?