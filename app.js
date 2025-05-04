const express = require("express");
const path = require("path");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const AppDataSource = require("./db/data-source");
const generateError = require("./utils/generateError");

const indexRouter = require("./routes/index");
const userRouter = require("./routes/user");
const authRouter = require("./routes/auth");

const app = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/auth", authRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
	next(generateError(404, "找不到該路由"));
});

// error handler
app.use(function (err, req, res, next) {
	const statusCode = err.statusCode || 500;
	res.status(statusCode).json({
		status: false,
		message: err.message || "伺服器錯誤",
	});
});

AppDataSource.initialize()
	.then(() => {
		console.log("📦 Data Source has been initialized!");
	})
	.catch((err) => {
		console.error("❌ Error during Data Source initialization", err);
	});

module.exports = app;
