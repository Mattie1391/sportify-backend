const { DataSource } = require("typeorm");
const db_config = require("../config/db");

const AppDataSource = new DataSource({
  type: "postgres",
  host: db_config.host,
  port: db_config.port,
  username: db_config.username,
  password: db_config.password,
  database: db_config.database,
  ssl: db_config.ssl,
  synchronize: db_config.synchronize, // 開發時 true，部署時請改為 false 並使用 migration
  logging: true,
  entities: [
    require("../entities/Admin"),
    require("../entities/User"),
    require("../entities/Coach"),
    require("../entities/Course"),
    require("../entities/Subscription"),
    require("../entities/Subscription_Skill"),
    require("../entities/Rating"),
    require("../entities/Coach_Skill"),
    require("../entities/Skill"),
    require("../entities/User_Course_Favorite"),
    require("../entities/Course_Chapter"),
    require("../entities/Payment_Transfer"),
    require("../entities/Course_Video"),
  ],
});

module.exports = AppDataSource;
