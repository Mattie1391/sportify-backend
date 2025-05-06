# 使用輕量版 LTS 版本，適合部署且相容性佳
FROM node:20-slim

# 設定為 production 模式，影響套件行為與效能
ENV NODE_ENV=production

# 建立容器內工作目錄
WORKDIR /app

# 先複製 package 檔案，並裝好正式套件（避免變動造成快取失效）
COPY package*.json ./

# 安裝正式環境的依賴（不裝 devDependencies，例如 nodemon）
RUN npm ci --omit=dev

# 再複製其他所有原始碼（避免頻繁改動破壞上層快取）
COPY . .

# 若使用 dotenv，自行定義或透過 Render 的環境變數設定，不需複製 .env
# 可依需要開放對外 Port（非必要，但有助於本地測試）
EXPOSE 3000

# 使用 node 執行你的應用程式入口
CMD ["node", "./bin/www"]