const AppDataSource = require("../db/data-source");
const courseRepo = AppDataSource.getRepository("Course");
const viewRepo = AppDataSource.getRepository("View_Stat");

//utils
const { isUndefined, isNotValidString, isNotValidUUID } = require("../utils/validators"); // 引入驗證工具函數
const generateError = require("../utils/generateError");

//教練取得所有課程(可以限制特定一門課程)的每月觀看次數、總計觀看次數
async function getCoachViewStats(req, res, next) {
  try {
    //禁止前端亂輸入參數，如banana=999
    const validQuery = ["courseId"];
    const queryKeys = Object.keys(req.query);
    const invalidQuery = queryKeys.filter((key) => !validQuery.includes(key));
    if (invalidQuery.length > 0) {
      return next(generateError(400, `不允許的參數：${invalidQuery.join(", ")}`));
    }
    const coachId = req.user.id;
    const courseId = req.query.courseId || null;
    if (courseId !== null && (isNotValidString(courseId) || isNotValidUUID(courseId))) {
      return next(generateError(400, "ID格式不正確"));
    }
    const course = await courseRepo.findOneBy({ id: courseId });
    if (!course) {
      return next(generateError(404, "查無此課程"));
    }
    if (courseId !== null && coachId !== course.coach_id) {
      return next(generateError(403, "權限不足，您未擁有這門課程"));
    }
    //建立查詢器
    let queryBuilder = viewRepo
      .createQueryBuilder("v") //將對View_Stat資料表的query暱稱為v
      .leftJoin("course", "c", "c.id=v.course_id") //併入course表(暱稱c)
      .select("v.course_id", "course_id") //選取課程id，將回傳的欄位命名為course_id
      .addSelect("c.name", "course_name") //選取課程名稱，欄位命名為course_name
      .addSelect(`DATE_TRUNC('month', v.date)`, "period") //用PostgesSQL函數DATE_TRUNC擷取timestamp到月份(到當月1號00:00:00)
      .addSelect("SUM(view_count)", "view_counts") //加總月度觀看次數，並命名欄位為"view_counts
      .groupBy("v.course_id") //依課程id排序(如果未指定課程的話)
      .addGroupBy("c.name") //依課程名稱分組
      .addGroupBy("period") //再依月份分組
      .orderBy("period", "ASC"); //採月份舊在前新在後

    //邏輯判斷，若前端有傳入course id，就只能查該門課程的觀看次數，若未傳入(else)，則是該教練所有課程的觀看次數加總
    if (courseId) {
      queryBuilder = queryBuilder.where("v.course_id = :courseId AND c.coach_id = :coachId", {
        courseId,
        coachId,
      }); //:courseId是防止SQL injection的參數佔位符，會被courseId的值取代
    } else {
      queryBuilder = queryBuilder.where("c.coach_id = :coachId", { coachId });
    }
    const rawData = await queryBuilder.getRawMany();

    //加總所有課程觀看次數
    const total_views = rawData.reduce((sum, row) => sum + parseInt(row.view_counts), 0);
    //整理資料格式，創建一個空白陣列，並用reduce、push將每筆row資料加入陣列當中。累加過程會儲存在acc變數中。
    const result = rawData.reduce((acc, row) => {
      const key = row.course_id;
      const course = acc.find((item) => item.course_id === key); //在acc中找尋對應課程id的統計資料，

      //轉換為台灣時區當日8點
      const raw = new Date(row.period);
      const utc8 = new Date(raw.getTime() + 8 * 60 * 60 * 1000);
      const year = utc8.getFullYear();
      const month = utc8.getMonth() + 1;

      const record = {
        // iso_month:`${year}-${month.toString().padStart(2,"0")}`,
        month: `${year}年${month}月`,
        view_counts: parseInt(row.view_counts),
      };
      //若有未加入過的課程在加總，適用if條件新建一個物件，若是已有課程的新的月份資料，就分類到該課程的物件裡
      if (!course) {
        acc.push({
          course_id: row.course_id,
          course_name: row.course_name,
          views_by_month: [record],
        });
      } else {
        course.views_by_month.push(record);
      }
      return acc;
    }, []);
    res.status(200).json({
      status: true,
      message: "成功取得資料",
      data: { total_views: total_views, view_stat: result },
    });
  } catch (error) {
    next(error);
  }
}
//教練後台取得自己課程列表
async function getCoachCourses(req, res, next) {
  try {
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCoachViewStats,
  getCoachCourses,
};
