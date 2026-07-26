# JaxMoney 專案交接資訊(v3.7.2)

## 專案是什麼
一個叫 **JaxMoney** 的 PWA,自己用也會分享給少數朋友用,主要功能:
- **換匯計算機**:5 個可自訂幣別欄位 + 計算機鍵盤,互相換算,有打折試算(長按 %$ 切換「折扣%」/「打幾折」)
- **歷史匯率**:兩個幣別間的歷史匯率走勢圖(1個月/半年/1年/3年),可收藏常用幣別對
- 兩頁用**左右滑動**切換(不是底部分頁按鈕)
- 支援離線查看上次更新的匯率資料
- 資料來源:Frankfurter API(`https://api.frankfurter.dev/v2`),免費不用金鑰

## 技術架構
- 純 HTML/CSS/JS 單一檔案(`index.html`),沒用框架
- `sw.js`(Service Worker,app shell 與匯率資料都用 stale-while-revalidate;`CACHE_NAME` 目前是 `jaxmoney-shell-v4`,若之後改版建議跟著換版號以確保新裝置第一次連上不會拿到舊快取)
- 部署在 GitHub Pages:`https://mightylordj.github.io/Jaxmoney/`,以「加入主畫面」方式當 App 用(iOS standalone 模式)
- 另有一支獨立的診斷測試頁 `viewport-test.html`(跟 `index.html` 平行部署),不含任何修正邏輯,純粹記錄 `window.innerHeight`/`visualViewport`/`screen`/`header` 等原始數值到 localStorage,跨重開持續累積——之後如果又遇到類似的版位異常,可以先部署這支頁面重現、拿記錄比對,不要直接改正式版

## 核心訴求 / 偏好
1. 深色 Apple 風格介面,紫色(#5E5CE6)主色調
2. 不要出現捲軸,內容剛好塞進螢幕
3. 標題列固定在最上面,不隨內容變化移動
4. 兩頁滑動切換,拖曳跟手指即時移動,拖夠長才切頁、沒拖夠彈回
5. 頁面指示器兩個小圓點貼齊螢幕最下緣
6. 選過的 5 個幣別記在 localStorage
7. **小數點位數依幣別最小單位決定**(對照表在 `CURRENCY_DECIMALS`):TWD/JPY/KRW/VND/ISK/HUF/IDR 是 0 位,其餘預設 2 位;換匯計算機裡「非 active 欄位」「切換 active 欄位」「四則運算結果」「打折結果」都要套同一套規則,不能各自為政

## ✅ iOS PWA 冷啟動縮小 bug — 目前已解決(v3.7.2)

**過去的現象:** App 長時間關閉/背景待機、旋轉螢幕、甚至剛開啟時,畫面有機率整個內容被誤判需要縮小,四周留白,關掉重開通常會恢復,但下次又可能再發生。

**真正的根因(用獨立診斷測試頁實測抓到的):**
`window.innerHeight`/`visualViewport.height` 這兩個瀏覽器 API,有時候會**卡在一個錯誤的固定值**(這支裝置上實測是精準卡在「正確值 − 50」),而且這個錯誤值**不會自己彈回來、會持續穩定地回報同一個錯值長達好幾秒**。這點很關鍵——過去每一版嘗試的「安靜期驗證」「等穩定才套用」之類的做法,理論基礎都是「錯誤是暫時雜訊、多等一下正確值就會出現」,但實測發現錯誤值本身完全符合「穩定」的判斷標準,只是穩定地錯,所以不管怎麼調整等待/確認邏輯都沒用。

**解法:改用不受這個 bug 影響的獨立基準值**
實測驗證了 `screen.height`/`screen.width`/`screen.orientation.type`(硬體螢幕解析度 + 目前朝向)在同一段卡住縮小的期間,**全程都正確**,完全沒被牽連壞掉——這三個值拿來對照過三種不同的重現方式(狂轉螢幕、開啟就直接卡小、關閉重開)都一致可靠。於是把版位高度的計算依據整個換掉:

- `index.html` 裡的 `setViewportHeight()` 現在改成呼叫新的 `trustedViewportHeight()` 函式,直接依 `screen.height`/`screen.width` + `screen.orientation.type` 算出目前朝向下的正確高度,拿這個值去設定 `.canvas-wrap` 的 `top`/`height`,完全不再依賴 `window.innerHeight`/`--vh`/`dvh`
- 只要 `screen.orientation` API 不存在(極舊版 WebKit)才會退回用 `window.innerHeight`
- 其他既有的事件監聽(`load`/`resize`/`orientationchange`/`pageshow`/`visibilitychange`/`visualViewport` 事件)跟安靜期驗證機制(`scheduleStableRefresh`/`checkStable`)**完全沒動**,只換了最底層「相信哪個數值」這一步,是很小幅度的修改

**目前實測狀況:** 部署後多次冷啟動、關閉重開、旋轉測試都沒有再縮小。唯一一次例外是在另一支 iPhone 14 Pro 上**第一次**打開這個版本時發生過一次,之後在同一支裝置上重新打開就沒再出現——研判可能是那支裝置第一次連線時 Service Worker/CDN 快取還沒同步到新版本,拿到的是舊版邏輯,不是這次修正本身失效。如果之後想更保險地避免這種新裝置踩到舊快取的情況,可以在每次發布重大修正時把 `sw.js` 的 `CACHE_NAME` 也跟著提升版號。

**如果之後又復發,下一步怎麼查:**
先部署 `viewport-test.html`、加到主畫面重現問題,把記錄複製下來比對——重點看 `screen.height`/`width`/`orientation.type` 這幾個值在事發當下還準不準。如果連這幾個值都开始跟著不準,代表遇到了新的、不同機制的問題,不能直接套用現在這套修法。


## 其他功能細節(供參考,非核心問題)
- 貨幣預設:TWD / USD / JPY / KRW / EUR
- 打折按鈕:短按進入輸入模式(兩位數字自動完成計算),長按切換「%$」/「折」兩種模式
- 歷史匯率頁記憶常用幣別對(quickPairs,存 localStorage)
