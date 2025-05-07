#!/bin/sh
#依照環境是開發環境或生產環境，決定docker容器的build方式

if [ "$NODE_ENV" = "production" ]; then
  echo "🚀 Running in production mode"
  exec node ./bin/www
else
  echo "👨‍💻 Running in development mode, waiting for db..."
  exec ./wait-for-it.sh db:5432 -- npm run dev
fi