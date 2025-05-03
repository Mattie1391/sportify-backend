const { DataSource } = require("typeorm");
require("dotenv").config();

const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  synchronize: false, //開發時 true，部署時請改為 false 並使用 migration
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
