const express = require("express");
const path = require("path");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const AppDataSource = require("./db/data-source");
const generateError = require("./utils/generateError");
const errorHandler = require("./middlewares/errorHandler");

//取得路由
const indexRouter = require("./routes/index");
const userRouter = require("./routes/user");
const authRouter = require("./routes/auth");
const courseRouter = require("./routes/course");
const adminRouter = require("./routes/admin");
const coachRouter = require("./routes/coach");
const muxRouter = require("./routes/mux");
const chatRouter = require("./routes/chat");

//排程
const { scheduleMuxDaliyStats } = require("./services/viewStatsCatcher");
const { scheduleCourseDeletion } = require("./services/courseDeletion");
const { scheduleShareProfit } = require("./services/shareProfit");

const app = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(logger("dev"));
app.use(express.json());
// 處理來自 HTML form 的 application/x-www-form-urlencoded 資料格式
// 設定 extended: true 可支援巢狀物件（例如 user[name]=Jenni）
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
//讓public資料夾可以存放upload.html
app.use(express.static("public"));

app.use("/", indexRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/courses", courseRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/coaches", coachRouter);
app.use("/api/v1/mux", muxRouter);
app.use("/api/v1/chat", chatRouter);

// 錯誤處理中介軟體
app.use(function (req, res, next) {
  next(generateError(404, "找不到該路由"));
});
app.use(errorHandler);

AppDataSource.initialize()
  .then(() => {
    console.log("📦 Data Source has been initialized!");
    //啟動排程
    scheduleMuxDaliyStats();
    scheduleCourseDeletion();
    scheduleShareProfit();
  })
  .catch((err) => {
    console.error("❌ Error during Data Source initialization", err);
  });

module.exports = app;
