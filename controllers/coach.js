const { In } = require("typeorm");
const AppDataSource = require("../db/data-source");
const courseRepo = AppDataSource.getRepository("Course");
const viewRepo = AppDataSource.getRepository("View_Stat");
const coachRepo = AppDataSource.getRepository("Coach");
const skillRepo = AppDataSource.getRepository("Skill");
const coachLicenseRepo = AppDataSource.getRepository("Coach_License");

//services
const { checkValidQuerys } = require("../services/queryServices");

//utils
const { isNotValidString, isNotValidUUID } = require("../utils/validators"); // 引入驗證工具函數
const generateError = require("../utils/generateError");
const { validateField } = require("../utils/coachProfileValidators");
const Coach_Skill = require("../entities/Coach_Skill");

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
  // 禁止前端亂輸入參數，如 banana=999
  const invalidQuerys = checkValidQuerys(req.query, ["coachId"]);
  if (invalidQuerys.length > 0) {
    return next(generateError(400, `不允許的參數：${invalidQuerys.join(", ")}`));
  }

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
    "skill", //取得時為頓號分隔的字串，拆解成陣列後存入skill表
    "skill_description",
    "experience_years",
    "experience",
    "license", //取得時為頓號分隔的字串，拆解成陣列後存入coach_license表
    "license_data", //取得時為陣列，存入coach_license表
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
    //取得並檢查該教練的資料內容，並載入相關技能跟證照(因skill與license欄位是輸入頓號分隔字串，在後端轉化為陣列存入資料庫)
    const coach = await coachRepo
      .createQueryBuilder("c")
      .leftJoinAndSelect("c.Coach_Skill", "cs") //將教練專長關聯表併入
      .leftJoinAndSelect("cs.Skill", "s") //再將skill表併入
      .leftJoinAndSelect("c.Coach_License", "cl") //併入教練證照關聯表
      .where("c.id = :id", { id: coachId })
      .getOne();

    if (!coach) {
      return next(generateError(404, "查無教練個人資料"));
    }

    // //取得並檢查該教練的資料內容
    // const profile = await coachRepo
    //   .createQueryBuilder("c")
    //   .leftJoin("c.Coach_Skill", "cs") //將教練專長關聯表併入
    //   .leftJoin("cs.Skill", "s") //再將skill表併入
    //   .leftJoin("c.Coach_License", "cl") //併入教練證照關聯表
    //   .select([
    //     "c.nickname",
    //     "c.realname",
    //     "c.birthday",
    //     "c.id_number",
    //     "c.phone_number",
    //     "c.bank_code",
    //     "c.bank_account",
    //     "c.bankbook_copy_url",
    //     "c.job_title",
    //     "c.about_me",
    //     "s.name as skill",
    //     "c.skill_description",
    //     "c.experience_years",
    //     "c.experience",
    //     "cl.title as license",
    //     "cl.file_url as license_url",
    //     "c.hobby",
    //     "c.motto",
    //     "c.favorite_words",
    //     "c.profile_image_url",
    //     "c.background_image_url",
    //   ]) //選取要用的欄位
    //   .where("c.id = :id", { id: coachId })
    //   .getOne();
    // if (!profile) {
    //   return next(generateError(404, "查無教練個人資料"));
    // }

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
    let hasSkillOrLicenseUpdated = false; //標記技能或證照是否更新

    await AppDataSource.transaction(async (transactionalEntityManager) => {
      //處理一般欄位的更新
      //以迴圈比對過濾出的欄位的值，判斷是否需改寫欄位，並儲存狀態
      for (const key of Object.keys(filteredData)) {
        if (key === "skill" || key === "license" || key === "license_data") {
          continue;
        }

        const value = filteredData[key];
        const error = validateField(key, value);
        if (error) return next(generateError(400, `${key}${error}`));

        //取得舊值
        const oldVal = coach[key];
        //取得(req.body)的新值，如是string，就去空白，若是其他type，就取原值
        const newVal = typeof value === "string" ? value.trim() : value;

        //比對req.body的新值(newVal)與資料庫的舊值(oldVal)不同，就讓原資料(coach)儲存新值，並紀錄已被修改。
        if (!Object.is(oldVal, newVal)) {
          coach[key] = newVal;
          updatedFields.push(key);
        }
      }
      //處理Skill資料表的更新
      let newSkillsFromReq = [];
      if (filteredData.skill !== undefined) {
        hasSkillOrLicenseUpdated = true;

        //將request body的專長字串的頓號去掉，存入一個陣列。
        //skill更動原則 : 不可任意刪除、減少專長，否則影響
        newSkillsFromReq = filteredData.skill
          .split("、")
          .map((s) => s.trim())
          .filter((s) => s !== ""); //過濾空字串
      }
      //將目前教練存入skill資料表的專長撈出，並存成陣列。
      const currentSkills = coach.Coach_Skill.map((cs) => cs.Skill.name);

      //找出需要新增的技能項目
      const skillsToAdd = newSkillsFromReq.filter(
        (skillName) => !currentSkills.includes(skillName)
      );
      //找到會被刪除的技能名稱
      const skillToRemove = currentSkills.filter(
        (skillName) => !newSkillsFromReq.includes(skillName)
      );
      if (skillToRemove.length > 0) {
        return next(generateError(400, `刪除技能${skillToRemove}需聯絡管理員`));
      }
      //驗證新增技能項目是否在許可的技能種類中
      //找到可以加入的技能
      const existingSkill = await transactionalEntityManager
        .getRepository("Skill")
        .find({ where: { name: In(skillsToAdd) } });

      //找出request body有，Skill資料表卻不存在的專長
      const foundSkillNames = new Set(existingSkill.map((s) => s.name));
      const nonExistingSkills = skillsToAdd.filter((skillName) => !foundSkillNames.has(skillName));
      console.log(nonExistingSkills);
      if (nonExistingSkills.length > 0) {
        return next(generateError(400, `${nonExistingSkills}不是可開課的專長，請聯絡管理員`));
      }
      //新增Coach_Skill關係資料
      for (const skillName of skillsToAdd) {
        const skill = existingSkill.find((s) => s.name === skillName);

        if (!skill) {
          return next(generateError(404, `查找${skillName}失敗，請聯絡管理員`));
        }
        const newCoachSkill = transactionalEntityManager.create(Coach_Skill, {
          coach_id: coach.id,
          skill_id: skill.id,
        });
        await transactionalEntityManager.save(Coach_Skill, newCoachSkill);
        updatedFields.push("skill");
      }

      //處理License更新
      if (filteredData.license !== undefined) {
        hasSkillOrLicenseUpdated = true;
        const newLicensesFromReq = Array.isArray(filteredData.license) ? filteredData.license : [];
      }
    });

    //若無任何更新，仍然算成功更新，只是告知無資料變更
    // if (updatedFields.length === 0) {
    //   res.status(200).json({
    //     status: true,
    //     message: "沒有資料被更新",
    //   });
    // }
    // const updatedCoach = await coachRepo.update(coachId, coach);

    res.status(200).json({
      status: true,
      message: "成功更新資料",
      // data: { coach: { updatedCoach } },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCoachViewStats,
  patchProfile,
};
