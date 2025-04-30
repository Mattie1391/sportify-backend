const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cors = require("cors");
const pinoHttp = require("pino-http");
const cookieParser = require("cookie-parser");
const logger = require("morgan");

const indexRouter = require("./routes/index"); 
const usersRouter = require("./routes/users");
const authRouter = require("./routes/auth"); 

const app = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(pinoHttp());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/api/v1/users", usersRouter);
app.use("/api/v1/auth", authRouter); 

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  res.status(404).json({
    status: false,
    message: "找不到該路由"
  });
});

// error handler
app.use(function (err, req, res, next) {
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    status: statusCode === 500 ? false : true,
    message: err.message || "伺服器錯誤"
  })
});

const AppDataSource = require("./db/data-source");

AppDataSource.initialize()
  .then(() => {
    console.log("📦 Data Source has been initialized!");
  })
  .catch((err) => {
    console.error("❌ Error during Data Source initialization", err);
  });

module.exports = app;
