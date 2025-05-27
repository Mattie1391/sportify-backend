const AppDataSource = require("../db/data-source");
const courseRepo = AppDataSource.getRepository("Course");
const viewRepo = AppDataSource.getRepository("View_Stat");
const coachRepo = AppDataSource.getRepository("Coach");

//utils
const { isUndefined, isNotValidString, isNotValidUUID } = require("../utils/validators"); // 引入驗證工具函數
const generateError = require("../utils/generateError");
const { validateField } = require("../utils/coachProfileValidators");

//教練取得所有課程(可以限制特定一門課程)的每月觀看次數、總計觀看次數API
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
//教練修改個人檔案API
async function patchProfile(req, res, next) {
  //設定patch request欄位的白名單
  const allowedFields = [
    "nickname",
    "realname",
    "birthday",
    "id_number",
    "phone_number",
    "bank_code",
    "bank_account",
    "bankbook_copy_url",
    "job_title",
    "about_me",
    "skill",
    "skill_description",
    "experience_years",
    "experience",
    "license",
    "license_url",
    "hobby",
    "motto",
    "favorite_words",
    "profile_image_url",
    "background_image_url",
  ];
  try {
    //驗證教練req params是否是適當的uuid格式、是否可找到此教練
    const coachId = req.params.coachId;
    if (isNotValidUUID(coachId)) {
      return next(generateError(400, "教練 ID 格式不正確"));
    }
    //檢查該教練的資料內容，需取得skill才完整
    const profile = await coachRepo
      .createQueryBuilder("c")
      .leftJoin("c.Coach_Skill", "cs") //將教練專長關聯表併入
      .leftJoin("cs.Skill", "s") //再將skill表併入
      .select([
        "c.nickname",
        "c.realname",
        "c.birthday",
        "c.id_number",
        "c.phone_number",
        "c.bank_code",
        "c.bank_account",
        "c.bankbook_copy_url",
        "c.job_title",
        "c.about_me",
        "s.name as skill",
        "c.skill_description",
        "c.experience_years",
        "c.experience",
        "c.license",
        "c.license_url",
        "c.hobby",
        "c.motto",
        "c.favorite_words",
        "c.profile_image_url",
        "c.background_image_url",
      ]) //選取要用的欄位
      .where("c.id = :id", { id: coachId })
      .getOne();
    if (!profile) {
      return next(generateError(404, "查無教練個人資料"));
    }

    //取得req.body資料，並篩選有填寫的欄位加入filteredData
    const rawData = req.body;
    const filteredData = {};

    for (const key of allowedFields) {
      if (rawData[key] !== undefined) {
        filteredData[key] = rawData[key];
      }
    }
    //集合資料有改變的
    const updatedFields = [];

    for (const key of Object.keys(filteredData)) {
      const value = filteredData[key];
      const error = validateField(key, value);
      if (error) return next(generateError(400, `${key}${error}`));

      //取得舊值
      const oldVal = profile[key];
      //取得(req.body)的新值，如是string，就去空白，若是其他型別，就取原值
      const newVal = typeof value === "string" ? value.trim() : value;

      //如果新舊值不全等，就改原資料(profile)，並紀錄已被修改。
      if (!Object.is(oldVal, newVal)) {
        profile[key] = newVal;
        updatedFields.push(key);
      }
    }

    // if ("nickname" in filteredData && filteredData.nickname.trim().length === 0) {
    //   return next(generateError(400, "暱稱格式錯誤，且不可為空白"));
    // }
    const nicknameRegex = /^[^\d\s]+$/;
    if (filteredData.nickname.length > 50 || !nicknameRegex.test(filteredData.nickname)) {
      return next(generateError(400, "暱稱不可超過50字，且中間不能有空白"));
    }
    // storedProfile.nickname = filteredData.nickname;
    // console.log(storedProfile.nickname);
    //檢驗realname
    if (isNotValidString(filteredData.realname) && filteredData.realname.trim() > 50) {
      return next(generateError(400, "真實姓名格式錯誤"));
    }
    //檢驗所輸入的realname : 可改但不可從有變為無

    res.status(200).json({
      status: true,
      message: "成功更新資料",
      data: {},
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCoachViewStats,
  patchProfile,
};
