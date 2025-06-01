const { In } = require("typeorm");
const AppDataSource = require("../db/data-source");
const courseRepo = AppDataSource.getRepository("Course");
const viewRepo = AppDataSource.getRepository("View_Stat");
const coachRepo = AppDataSource.getRepository("Coach");
const skillRepo = AppDataSource.getRepository("Skill");

//services
const { checkValidQuerys } = require("../services/queryServices");

//utils
const { isNotValidString, isNotValidUUID } = require("../utils/validators"); // 引入驗證工具函數
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
    "license", //為頓號分隔的字串
    "license_data", //取得時為陣列，包括檔案名稱與url，存入coach_license表
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
    let skillDataActuallyChanged = false; //標記技能是否更新
    let licenseDataActuallyChanged = false; //標記證照是否有更新

    //聲明一個儲存更新後的transactionalCoach資料
    let finalCoachData = null;

    await AppDataSource.transaction(async (transactionalEntityManager) => {
      //處理一般欄位的更新

      const transactionalCoach = await transactionalEntityManager
        .getRepository("Coach") // Get repo from transactionalEntityManager
        .createQueryBuilder("c")
        .leftJoinAndSelect("c.Coach_Skill", "cs")
        .leftJoinAndSelect("cs.Skill", "s")
        .leftJoinAndSelect("c.Coach_License", "cl")
        .where("c.id = :id", { id: coachId })
        .getOne();

      if (!transactionalCoach) {
        throw generateError(404, "查無教練個人資料");
      }

      //跳過特殊處理邏輯的專長及證照上傳
      for (const key of Object.keys(filteredData)) {
        if (key === "skill" || key === "license_data") {
          continue;
        }

        const value = filteredData[key];
        const error = validateField(key, value);
        if (error) throw generateError(400, `${key}${error}`);

        //取得舊值
        const oldVal = transactionalCoach[key];
        //取得(req.body)的新值，如是string，就去空白，若是其他type，就取原值
        const newVal = typeof value === "string" ? value.trim() : value;

        //比對req.body的新值(newVal)與資料庫的舊值(oldVal)不同，就讓原資料(coach)儲存新值，並紀錄已被修改。
        if (!Object.is(oldVal, newVal)) {
          transactionalCoach[key] = newVal;
          updatedFields.push(key);
        }
      }
      //處理Skill資料表的更新
      let newSkillsFromReq = [];
      if (filteredData.skill !== undefined) {
        skillDataActuallyChanged = true;

        //將request body的專長字串的頓號去掉，存入一個陣列。
        //skill更動原則 : 不可任意刪除、減少專長，否則影響
        newSkillsFromReq = filteredData.skill
          .split("、")
          .map((s) => s.trim())
          .filter((s) => s !== ""); //過濾空字串
      }
      //將目前教練存入skill資料表的專長撈出，並存成陣列。
      const currentSkills = transactionalCoach.Coach_Skill.map((cs) => cs.Skill.name);

      //找出需要新增的技能項目
      const skillsToAdd = newSkillsFromReq.filter(
        (skillName) => !currentSkills.includes(skillName)
      );
      //找到會被刪除的技能名稱
      const skillToRemove = currentSkills.filter(
        (skillName) => !newSkillsFromReq.includes(skillName)
      );
      if (skillToRemove.length > 0) {
        throw generateError(400, `刪除技能${skillToRemove}需聯絡管理員`);
      }
      //驗證新增技能項目是否在許可的技能種類中
      //找到可以加入的技能
      const existingSkill = await skillRepo.find({ where: { name: In(skillsToAdd) } });

      //找出request body有，Skill資料表卻不存在的專長
      const foundSkillNames = new Set(existingSkill.map((s) => s.name));
      const nonExistingSkills = skillsToAdd.filter((skillName) => !foundSkillNames.has(skillName));
      if (nonExistingSkills.length > 0) {
        throw generateError(400, `${nonExistingSkills}不是可開課的專長，請聯絡管理員`);
      }
      //新增Coach_Skill關係資料
      for (const skillName of skillsToAdd) {
        const skill = existingSkill.find((s) => s.name === skillName);

        if (!skill) {
          throw generateError(404, `查找${skillName}失敗，請聯絡管理員`);
        }
        const newCoachSkill = transactionalEntityManager.create("Coach_Skill", {
          Coach: transactionalCoach,
          Skill: skill,
        });
        await transactionalEntityManager.getRepository("Coach_Skill").save(newCoachSkill);
      }
      if (skillsToAdd.length > 0) {
        updatedFields.push("skill");
      }

      //處理license_data更新
      //檢查req.body是否輸入證照與資格(license)、證照與資格上傳(license_data)
      if (filteredData.license_data !== undefined) {
        //檢查上傳證照license_data是否是陣列。是的話讀取陣列，不是的話，使從req.body取得的資料為空陣列
        const newLicensesFromReq = Array.isArray(filteredData.license_data)
          ? filteredData.license_data
          : [];

        //檢查所寫證照與資格的數量與實際上傳的檔案數是否相符
        let parsedTitlesCount = 0;
        if (typeof filteredData.license === "string" && filteredData.license.trim() !== "") {
          parsedTitlesCount = filteredData.license
            .split("、")
            .map((t) => t.trim())
            .filter((t) => t !== "").length;
        }
        if (parsedTitlesCount !== newLicensesFromReq.length) {
          throw generateError(400, "證照資格的標題與上傳的附件數量不符");
        }

        //驗證每個檔案物件的格式
        for (const fileInfo of newLicensesFromReq) {
          if (
            typeof fileInfo !== "object" ||
            fileInfo === null ||
            !fileInfo.file_url ||
            !fileInfo.filename
          ) {
            throw generateError(400, "未上傳檔案或未取得檔案名稱");
          }
        }
        const currentLicenses = transactionalCoach.Coach_License || [];

        //找出需要從資料庫移除的證照(若教練更新後去掉某證照附件)
        const licenseToRemove = currentLicenses.filter((currentLicense) => {
          const found = newLicensesFromReq.some(
            (newLicense) =>
              newLicense.file_url === currentLicense.file_url &&
              newLicense.filename === currentLicense.filename
          );
          return !found; //若找不到，代表該證照要被移除
        });

        //找出需新增的證照
        const licenseToAdd = newLicensesFromReq.filter((newLicenseData) => {
          const found = currentLicenses.some(
            (currentLicenses) =>
              currentLicenses.file_url === newLicenseData.file_url &&
              currentLicenses.filename === newLicenseData.filename
          );
          return !found; //如果當前資料庫中沒有完全匹配的，則認為是新的
        });

        //檢查是否有實質性的license_data變動
        if (licenseToRemove.length > 0 || licenseToAdd.length > 0) {
          licenseDataActuallyChanged = true;
        }

        //執行刪除操作
        for (const license of licenseToRemove) {
          await transactionalEntityManager
            .getRepository("Coach_License")
            .delete({ id: license.id });
        }

        //找出須更新或新增的證照
        for (const newLicenseData of licenseToAdd) {
          //嘗試找到file_url和filename與資料庫都匹配的現有證照
          const newCoachLicense = transactionalEntityManager.create("Coach_License", {
            Coach: transactionalCoach,
            file_url: newLicenseData.file_url,
            filename: newLicenseData.filename,
          });
          await transactionalEntityManager.getRepository("Coach_License").save(newCoachLicense);
        }
        //如果有Coach_License存在的證照，就不做任何事。
      }
      if (licenseDataActuallyChanged) {
        updatedFields.push("license_data");
      }

      //更新Coach主表，license證照字串會原原本本寫入Coach資料表中
      if (updatedFields.length > 0 || skillDataActuallyChanged || licenseDataActuallyChanged) {
        await coachRepo.save(transactionalCoach);
      }
      //更新後重新載入一次Coach物件及其關聯
      finalCoachData = await transactionalEntityManager
        .getRepository("Coach")
        .createQueryBuilder("c")
        .leftJoinAndSelect("c.Coach_Skill", "cs")
        .leftJoinAndSelect("cs.Skill", "s")
        .leftJoinAndSelect("c.Coach_License", "cl")
        .where("c.id = :id", { id: coachId })
        .getOne();
    });
    //取得更新結果的教練個人資料
    let resData = {};

    if (finalCoachData) {
      resData = {
        id: finalCoachData.id,
        nickname: finalCoachData.nickname,
        realname: finalCoachData.realname,
        birthday: finalCoachData.birthday,
        phone_number: finalCoachData.phone_number,
        job_title: finalCoachData.job_title,
        about_me: finalCoachData.about_me,
        skill: req.body.skill, //沿用req.body的字串形式
        skill_description: finalCoachData.skill_description,
        experience_years: finalCoachData.experience_years,
        experience: finalCoachData.experience,
        hobby: finalCoachData.hobby,
        motto: finalCoachData.motto,
        favorite_words: finalCoachData.favorite_words,
        profile_image_url: finalCoachData.profile_image_url,
        background_image_url: finalCoachData.background_image_url,
        updated_at: finalCoachData.updated_at,
      };
    }

    //處理Coach_License資料
    //確保transactionalCoach.Coach_License 存在且是陣列
    if (
      finalCoachData &&
      finalCoachData.Coach_License &&
      Array.isArray(finalCoachData.Coach_License)
    ) {
      resData.license_data = finalCoachData.Coach_License.map((cl) => ({
        filename: cl.filename,
        file_url: cl.file_url,
      }));
    }

    //若無任何更新，仍然算成功更新，只是告知無資料變更
    if (updatedFields.length === 0) {
      res.status(200).json({
        status: true,
        message: "沒有資料被更新",
        data: {},
      });
    } else {
      res.status(200).json({
        status: true,
        message: "成功更新資料",
        data: { coach: resData },
      });
    }
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCoachViewStats,
  patchProfile,
};
