# JaxMoney 專案交接資訊(v3.8.5)

## 專案是什麼
一個叫 **JaxMoney** 的 PWA,自己用也會分享給少數朋友用,主要功能:
- **換匯計算機**:5 個可自訂幣別欄位 + 計算機鍵盤,互相換算,有打折試算(長按 %$ 切換「折扣%」/「打幾折」)
- **幣別搜尋**(v3.8.3 前後加入):點幣別按鈕開選單,可用幣別代碼、中文幣別名、**國家名稱(中英文)**搜尋,例如 泰國 / Thailand → THB;結果會在幣別名稱後面顯示命中的國家名
- **歷史匯率**:兩個幣別間的歷史匯率走勢圖(1個月/半年/1年/3年),可收藏常用幣別對;圖表支援**互動式十字準線**(手指按住拖曳顯示該日匯率)
- 兩頁用**左右滑動**切換(不是底部分頁按鈕)
- 支援離線查看上次更新的匯率資料
- 資料來源:Frankfurter API(`https://api.frankfurter.dev/v2`),免費不用金鑰

## 技術架構
- 純 HTML/CSS/JS 單一檔案(`index.html`),沒用框架
- `sw.js`(Service Worker):stale-while-revalidate,同源 GET 一律「有快取先回快取、背景再更新」;`CACHE_NAME` 目前是 `jaxmoney-shell-v18`,之後每次改版都要跟著跳號(這個專案的慣例,不跳號的話使用者會被卡在舊版看不到新東西)。另有 **Navigation Preload**(`activate` 事件裡 `self.registration.navigationPreload.enable()`),SW 還在啟動的當下就先平行送出網路請求,縮短「SW 剛要接手、還沒準備好」的空窗期
- `manifest.json`:標準 Web App Manifest,定義 `start_url`/`scope`/`display: standalone`,讓 iOS 對「這次啟動該由哪個 SW 接手」的判斷更明確。**只有在「加入主畫面」那個當下會被讀取一次,之後更新這個檔案不會自動生效**,要讓使用者重新加入主畫面才吃得到新設定
- 部署在 GitHub Pages:`https://mightylordj.github.io/Jaxmoney/`(repo 從 miniproject 改名過來),以「加入主畫面」方式當 App 用(iOS standalone 模式)
- `viewport-test.html`:診斷版位用的獨立測試頁,**不含任何修正邏輯**,只讀取並顯示原始數值。2026-11-21 重寫過,目前內容:顯示 `standalone`、`innerWidth/Height`、`visualViewport`、`screen`、方向、dpr、`env(safe-area-inset-*)` 四邊數值;畫面上有從螢幕最上緣起算、每 20px 一條的尺規,紅條代表 `safe-area-inset-top`,紫條代表正式 App 標題大約位置;並記錄本次開啟的初始讀數。**必須「加入主畫面」並從圖示開啟(且「以網頁 App 方式打開」開關要開)才有意義**,在 Safari 分頁裡開會是 `standalone: false`、safe-area 全 0,測不出東西。另外 Safari 的 UA 會固定顯示 `OS 18_7`,不代表實際 iOS 版本

## 核心訴求 / 偏好
1. 深色 Apple 風格介面,紫色(#5E5CE6)主色調
2. 不要出現捲軸,內容剛好塞進螢幕
3. 標題列固定在最上面,不隨內容變化移動
4. 兩頁滑動切換,拖曳跟手指即時移動,拖夠長才切頁、沒拖夠彈回
5. 頁面指示器兩個小圓點貼齊螢幕最下緣
6. 選過的 5 個幣別記在 localStorage
7. 小數點位數依幣別最小單位決定(對照表在 `CURRENCY_DECIMALS`),換匯計算機裡各種情況都套同一套規則


## ✅ iOS PWA 冷啟動縮小 bug — 已解決(v3.7.2)
**現象:** App 長時間關閉/背景待機、旋轉螢幕、甚至剛開啟時,畫面有機率整個內容被誤判需要縮小,四周留白。

**根因:** `window.innerHeight`/`visualViewport.height` 有時候會**卡在一個錯誤但穩定的固定值**(這裝置上是精準卡在「正確值 − 50」),不會自己彈回來,過去所有「等穩定才套用」的做法都對這個 bug 無效,因為錯誤值本身完全符合「穩定」的判斷標準。

**解法:** `screen.height`/`screen.width`/`screen.orientation.type` 這三個值在同一段卡住縮小的期間全程正確,於是把版位高度的計算依據換成靠這三個值算的 `trustedViewportHeight()`,不再依賴 `window.innerHeight`/`--vh`/dvh。只有 `screen.orientation` API 不存在時才退回舊邏輯。

**目前狀態:** 多次冷啟動、關閉重開、旋轉測試都沒有再縮小,視為已解決。唯一的殘留副作用是**下方頁面指示圓點偶爾會被 Safari 自動收合的工具列蓋住**——因為修法把版位高度改成完全不理會 `visualViewport`(這樣才能躲開卡死的錯值),代價是也感知不到工具列這種合法、暫時性的遮擋。已確認接受這個副作用,因為圓點只是裝飾、沒有功能。

## ✅ iOS 27.2.1 標題被狀態列模糊蓋住 — 已解決(v3.8.5,2026-11-21)
**現象:** 在 iPhone 18 Pro(iOS 27.2.1)上,標題列「JaxMoney」上緣變暗、像被切掉。其他機型沒有這個狀況。

**診斷(用 `viewport-test.html` 在主畫面 standalone 模式量測):**
- `standalone: true`,`innerHeight` 與 `screen.height` 都是 874(`docClientWH` 起初 874、1.5 秒後變 812),`screen` 402×874、dpr 3,`env(safe-area-inset-top)` = 62px、bottom = 34px,**數值全部正確,不是版位計算出錯**
- 從尺規看,螢幕頂端有一層**系統加的漸層模糊**,0~60px 的線都被淡掉,約到 75~80px 才恢復清楚(這個範圍是從尺規目測估計,不是系統給的數字)
- 原本標題頂端在 `62 + 10 = 72px`,剛好落在模糊還沒退乾淨的邊緣
- 我們在 `index.html` 用 `apple-mobile-web-app-status-bar-style: black-translucent`,內容會畫到狀態列底下,標題完全靠 `env(safe-area-inset-top)` 推開
- 網路上有 Apple 開發者論壇的回報指出 iOS 27.2 在狀態列/safe-area 行為上與 27.1 不同(但那是原生 App 的 WKWebView 案例,不是 PWA,只能當旁證,**沒有確認 Apple 這次改動的確切內容**)

**解法:** `index.html` 的 `.board-header` 上方 padding 由 `calc(10px + env(safe-area-inset-top))` 改成 `calc(24px + env(safe-area-inset-top))`,標題頂端變成 62 + 24 = 86px,離模糊邊緣約有 6px 餘裕。先用獨立的 `index-test.html` 在實機驗證(標題清楚、無被蓋住)後才套到正式版,測試檔已刪除。

**副作用 / 注意:**
- 標題列變高 14px,整個畫布會自動縮小約 2% 來塞進螢幕
- 沒有這層模糊的機型,標題上方只是多 14px 空白
- 如果之後別的機型或 iOS 版本又出現標題被蓋住,先用 `viewport-test.html` 量,再決定要不要調 24 這個數字

## 🟡 iOS 冷啟動黑畫面過久 — 已找到根因,已部分改善,無法完全根除
**現象:** App 久放背景後(process 被系統清掉)重新開啟,點圖示後會有一段黑畫面,快的話幾乎沒感覺,慢的時候可以到 2-5 秒。**剛關閉立刻重開則幾乎不會慢**(process 還在,不用整個重建)。

**診斷過程:** 自己在 `index.html` 裡寫了一個暫時性的除錯面板(記錄每次啟動的 SW 控制狀態、TTFB、DOMContentLoaded、load 事件時間、各子資源載入時間,寫進 localStorage),抓了好幾輪實測數據後確認:
- 網頁本身的載入(TTFB、SW 攔截、`load` 事件完全結束)其實很快,量到的數字通常在 1-2 秒內
- 真正拖到 2-5 秒的那段,發生在「點主畫面圖示」到「網頁開始 navigate、任何一行 JS 開始執行」之間——這段完全在網頁程式碼的世界之外,是 **iOS 重新建立整個 WKWebView 容器 process** 的開機時間,無法用 JS 觀察也無法用 JS 縮短
- 除錯面板已經在確認完根因之後拿掉,不影響正式版

**已嘗試且有實測效果的改善:**
1. **加上 `manifest.json`**(見上方技術架構):讓 iOS 對「這次算不算同一個已安裝的 App、可以沿用還是要整個重建」的判斷更明確,推測降低了觸發「完整冷啟動」的頻率
2. **`sw.js` 加 Navigation Preload**:縮短 SW 啟動中的空窗期

**A/B 測試結果(2026-07-27):** 拿掉所有其他改動、只加 `manifest.json` 單獨測試,對比最原始 v3.7.2 baseline——原本「幾乎每次久放重開都會慢」,變成「久放重開有高機率(但非必然)出現 2-5 秒黑畫面,時長本身會浮動」。疊加完整改動(manifest + SW 重寫 + Navigation Preload)之後,實測抓到約 20 次只出現 1 次明顯慢的狀況,比單獨 manifest.json 更好。合理推論 manifest.json 貢獻了主要但非全部的改善,其餘改動疊加後還有進一步壓低機率的效果。

**目前結論:** 剩下這部分的浮動(2-5 秒、出現機率)主要跟裝置當下的記憶體壓力有關(背景開多少其他 App、iOS 決定要不要清掉這個 process),不是程式碼能再進一步解決的範圍,已經算是逼近目前這個做法能做到的極限。理論上效能更好(尤其記憶體更大)的手機,出現頻率跟時長都會更好,但沒有跨機型實測數據佐證,只是根據 iOS 記憶體管理機制的合理推論。

**啟動畫面(目前暫停):** 一開始因為「不想只是掩蓋延遲」而拒絕使用,後來確認黑畫面本質是網頁程式碼完全接觸不到的系統開機時間之後,啟動畫面重新變成「這段空檔唯一能用的工具」而不是逃避問題的做法。做過一次概念驗證(佔位圖 + "Loading..." 字樣),但發現 iOS 的 `apple-touch-startup-image` 機制**必須針對每一種裝置尺寸+方向+像素密度各自準備一張圖、精確寫 `media` 條件才會生效**,沒有「一張圖打天下」的做法,而且這個機制在部分 iOS 版本上被回報過即使設定正確也可能失效,屬於 Apple 沒有正式文件保證的功能。目前決定**暫緩**這個方向,沒有包含任何啟動畫面設定。如果之後想重新撿起來,做法是先問清楚需要涵蓋哪些手機型號(自己的 + 主要分享對象的),針對性做 2-4 張圖就好,不用做到涵蓋所有機型。

## ✅ 快速輸入漏數字 bug — 已解決(v3.8.1,2026-07-28)
**現象:** 計算機快速連按數字時偶爾漏掉(例如按 515 只記到 55)。

**根因(兩層):**
1. 滑動換頁的 touch 事件綁在整個 `.canvas-wrap`(含鍵盤),快速點擊時手指若有 6px 內的微小晃動,可能被判定成水平滑動而呼叫 `preventDefault()`,把按鍵的 click 吃掉
2. iOS 的 `click` 是「合成事件」,快速連續點不同鍵時 WebKit 偶爾會漏合成

**解法:**
1. `touchstart` 時,如果目標在 `.key, button, select, input, .quick-btn, .range-tab, .page-dot` 內,就不啟動滑動偵測
2. 鍵盤改用 `touchend` 處理(並 `preventDefault()` 避免之後又觸發重複的 click);`click` 只保留給滑鼠/觸控板當後備,用 `handledByTouch` 旗標避免同一次點擊重複輸入

**已知取捨:** 因為從按鍵、按鈕上起手的觸控不會觸發換頁,**鍵盤區本身無法用來左右滑動換頁**,只能從空白處或匯率那頁滑。目前接受這個代價。

## 🔵 待辦 / 題外話筆記

### 分享給朋友時的 SW 更新問題(尚未處理,不急)
朋友使用時可能遇到「你更新了 `sw.js`,但朋友那邊沒吃到新版」的狀況,原因:
- 因為是 stale-while-revalidate,**要完整關掉 App 再開兩次**才會看到新版(第一次開啟是舊快取、背景更新,第二次才是新版)
- `manifest.json`、圖示這類設定**只有在「加入主畫面」當下讀取一次**,之後不管怎麼更新都不會自動生效,只能請朋友重新加入主畫面一次

比較治本的做法(不需要朋友做任何操作):`sw.js` 的 `install` 事件已經有 `self.skipWaiting()`,再搭配在頁面上監聽 `controllerchange` 事件、偵測到新版本接手時自動重新整理頁面。**這個還沒實作**(`index.html` 裡目前沒有 `controllerchange` 監聽),只是先記下來。

### 待查證(只是推測,尚未確認)
- **RUB(俄羅斯盧布)可能抓不到匯率**:幣別清單裡有 RUB,但 Frankfurter 傳統上依歐洲央行資料,而歐洲央行 2022 年起沒有盧布報價。**還沒有驗證 Frankfurter v2 現在是否還支援**。如果不支援,選到 RUB 時可能讓整個換算請求失敗(`loadConverterRates` 一次請求 5 個幣別)。確認方式:直接呼叫 `https://api.frankfurter.dev/v2/rates?base=TWD&quotes=RUB` 看回應
- `loadConvCurrencies()` 只檢查 localStorage 裡存的是不是 5 個字串,沒有檢查這些幣別是否還在 `CURRENCIES` 清單裡,影響很小


## 其他功能細節(供參考,非核心問題)
- 貨幣預設:TWD / USD / JPY / KRW / EUR
- 打折按鈕:短按進入輸入模式(兩位數字自動完成計算),長按切換「%$」/「折」兩種模式
- 歷史匯率頁記憶常用幣別對(quickPairs,存 localStorage)
- 版本歷史摘要:v3.7.2 縮小 bug 修正 → v3.8.0 manifest + SW 重寫 + Navigation Preload → v3.8.1 快速輸入漏數字修正(sw 快取 v14)→ 之後加入十字準線、`touchend` 鍵盤處理、國家名稱搜尋等 → v3.8.5 標題避開 iOS 27.2 狀態列模糊(sw 快取 v18)
