<!-- 標籤來源參考：https://github.com/Envoy-VC/awesome-badges#github-stats -->

![](https://img.shields.io/github/stars/Mattie1391/sportify-backend.svg)｜![](https://img.shields.io/github/forks/Mattie1391/sportify-backend.svg)｜![](https://img.shields.io/github/issues/Mattie1391/sportify-backend.svg)

> 本專案是 Sportify 的後端服務，專為處理應用程式的伺服器邏輯與 API 端點設計。

---

# Sportify Backend

![專案封面圖](https://firebasestorage.googleapis.com/v0/b/coffeeshop-4ac57.firebasestorage.app/o/images%2F%E5%A4%A7%E6%88%AA%E5%9C%96%202025-05-13%20%E5%87%8C%E6%99%A81.52.39.png?alt=media&token=e6c702a9-04d6-42c8-b048-6a11aa165820)

> Sportify Backend 提供應用程式的資料處理與伺服器邏輯，支援完整的後端功能。

- [線上專案連結](https://github.com/Mattie1391/sportify-backend)

---

## 功能

測試帳號密碼 **（建議僅提供僅能查看的帳號密碼）**

```bash
帳號： user@example.com
密碼： Test123
```

- [x] 用戶註冊與登入
- [x] JWT 驗證
- [x] 資料庫操作
- [x] API 端點
- [x] Docker 支援

---

## 畫面

![範例圖片 1](https://firebasestorage.googleapis.com/v0/b/coffeeshop-4ac57.firebasestorage.app/o/images%2F%E6%88%AA%E5%9C%96%202025-05-13%20%E5%87%8C%E6%99%A81.54.27.png?alt=media&token=a035711c-4acf-4344-8ded-4b5973d44be8 )
![範例圖片 2](https://firebasestorage.googleapis.com/v0/b/coffeeshop-4ac57.firebasestorage.app/o/images%2F%E6%88%AA%E5%9C%96%202025-05-13%20%E5%87%8C%E6%99%A81.54.59.png?alt=media&token=7e231eee-8bfd-42d7-bcb2-825141bdfce0)
![範例圖片 3](https://firebasestorage.googleapis.com/v0/b/coffeeshop-4ac57.firebasestorage.app/o/images%2F%E6%88%AA%E5%9C%96%202025-05-13%20%E5%87%8C%E6%99%A81.55.27.png?alt=media&token=32fcdcdd-0a4b-4884-8ebe-fc61bfc9cde1)

---

## 安裝

以下是如何將此專案安裝於本地環境的指引：

### 取得專案

```bash
git clone https://github.com/Mattie1391/sportify-backend.git
```

### 移動到專案資料夾

```bash
cd sportify-backend
```

### 安裝相依套件

```bash
npm install
```

### 環境變數設定

請在終端機輸入以下指令來複製 `.env` 檔案，並依需求修改內容：

```bash
cp .env.example .env
```

### 運行專案

```bash
npm run dev
```

### 開啟專案

在瀏覽器中輸入以下網址：

```bash
http://localhost:3000/
```

---

## 環境變數說明

```env
PORT= #定義應用程式運行的伺服器端口號
DB_HOST= #定義資料庫主機的地址，通常是伺服器的 IP 或域名。
DB_PORT= #定義資料庫服務的連接端口號。
DB_USERNAME= #定義資料庫服務的連接端口號。
DB_PASSWORD= #定義連接資料庫所需的密碼。
DB_NAME= #定義應用程式使用的資料庫名稱。
JWT_EXPIRES_DAY= #定義 JSON Web Token (JWT) 的有效期限。
JWT_TEMPORARY_EXPIRES_DAY= #定義臨時 JSON Web Token (如重設密碼的 Token) 的有效期限。
JWT_SECRET= #定義用於加密和驗證 JWT 的密鑰。
GMAIL_USER_NAME= #定義應用程式使用的 Gmail 帳戶名稱，通常用於發送電子郵件
GMAIL_APP_PASSWORD= #定義 Gmail 帳戶的應用程式密碼，用於安全地發送電子郵件。
DB_SYNCHRONIZE= #定義是否自動同步資料庫的表結構。
```

---

## 資料夾說明

- **bin**: 儲存應用程式啟動腳本。
- **config**: 配置檔案資料夾，例如資料庫設定。
- **controllers**: 處理業務邏輯與 API 請求的控制器。
- **db**: 資料庫連接與操作相關檔案。
- **entities**: 定義資料模型與 ORM 實體。
- **middlewares**: 中介層邏輯，例如認證與日誌記錄。
- **node_modules**: 自動生成的依賴套件資料夾。
- **public**: 靜態資源，如圖片與 CSS 檔案。
- **routes**: 定義應用程式的路由。
- **services**: 處理複雜邏輯或外部 API。
- **utils**: 共用工具函數。
- **views**: 用於伺服器端渲染的模板檔案。

---

## 專案技術

- Node.js v16.15.0
- Express.js
- PostgreSQL
- JWT 身份驗證
- Docker

---

## CI/CD 說明

本專案使用 GitHub Actions，當提交 Pull Request 時會執行以下動作：

- 建立 Node.js 環境
- 安裝相依套件
- 編譯程式碼
- 執行測試
- 部署至伺服器

---

## 聯絡作者

- [GitHub](https://github.com/Mattie1391)
- Email: sportifyplus2025@gmail.com
