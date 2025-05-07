# 使用輕量版 LTS 版本，適合部署且相容性佳
FROM node:20-slim

# 設定為 production 模式，影響套件行為與效能
ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV

# 建立容器內工作目錄
WORKDIR /app

# 先複製 package 檔案，並裝好正式套件（避免變動造成快取失效）
COPY package*.json ./

# 根據環境安裝依賴
# - production: 不安裝 devDependencies
# - development: 安裝所有依賴（含 nodemon）
RUN if [ "$NODE_ENV" = "production" ]; then \
      npm ci --omit=dev; \
    else \
      npm install; \
    fi

# 再複製其他所有原始碼（避免頻繁改動破壞上層快取）
COPY . .

#賦予腳本執行權限
RUN chmod +x wait-for-it.sh

# 若使用 dotenv，自行定義或透過 Render 的環境變數設定，不需複製 .env
# 可依需要開放對外 Port（非必要，但有助於本地測試）
EXPOSE 3000

# 根據環境設定啟動命令
CMD ["sh", "-c", "if [ \"$NODE_ENV\" = \"production\" ]; then node ./bin/www; else ./wait-for-it.sh db:5432 -- npm run dev; fi"]