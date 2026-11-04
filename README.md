# 116 申請入學校系查詢入口

這個資料夾是可直接部署的純靜態網站。入口為 `index.html`，兩個查詢站分別在 `university/` 與 `tech/`，包含所需資料與 PDF。

## GitHub Pages

最簡單的方式是將 **`web` 資料夾內所有檔案與子資料夾** 放到 GitHub 儲存庫根目錄，再於 Settings → Pages 選擇從該分支的 `/ (root)` 發布。若整個 `web` 資料夾直接放在儲存庫根目錄，入口網址則是 GitHub Pages 網址後加上 `/web/`。GitHub Pages 不能直接選 `web` 作為發布目錄；若希望入口位於網站根網址，可把 `web` 改名為 `docs` 並選擇 `/docs` 發布。

兩個站皆以相對路徑載入資源；請保持 `university/`、`tech/`、`portal.css` 及資料夾內的 `data/` 原有結構。開發預覽建議用本機 HTTP 伺服器，從 `web` 目錄執行 `python -m http.server 8000` 後開啟 `http://localhost:8000/`。

網站資料僅供查詢與比較；招生條件請以各招生單位當年度正式簡章及公告為準。
