const { In } = require("typeorm");
const logger = require("../config/logger");
const cloudinary = require("cloudinary").v2;
const AppDataSource = require("../db/data-source");
const courseRepo = AppDataSource.getRepository("Course");
const viewRepo = AppDataSource.getRepository("View_Stat");
const coachRepo = AppDataSource.getRepository("Coach");
const skillRepo = AppDataSource.getRepository("Skill");
const coachSkillRepo = AppDataSource.getRepository("Coach_Skill");
const coachLisenseRepo = AppDataSource.getRepository("Coach_License");
const courseChapterRepo = AppDataSource.getRepository("Course_Chapter");

//services

//utils
const { isNotValidString, isNotValidUUID, isNotValidUrl } = require("../utils/validators"); // 引入驗證工具函數
const generateError = require("../utils/generateError");
const { validateField } = require("../utils/coachProfileValidators");
const { chaptersArraySchema } = require("../utils/courseDataValidators"); //引入驗證教練課程表單的章節架構驗證模組
const { raw } = require("body-parser");
const { formatDate } = require("../utils/formatDate");
const { chapterDestructor } = require("../utils/chapterShaper"); //引入教練課程表單中，將章節架構組裝、鋪平的工具
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

//取得教練個人資料
async function getProfile(req, res, next) {
  try {
    const coachId = req.params.coachId;
    if (isNotValidUUID(coachId)) {
      return next(generateError(400, "教練 ID 格式不正確"));
    }
    const coach = await coachRepo.findOneBy({ id: coachId });
    if (!coach) {
      return next(generateError(404, "查無此教練"));
    }
    //檢查頭貼網址是否正確，不正確則設為null
    if (!coach.profile_image_url || isNotValidUrl(coach.profile_image_url)) {
      coach.profile_image_url = null;
    }
    //檢查背景圖片網址是否正確，不正確則設為null
    if (!coach.background_image_url || isNotValidUrl(coach.background_image_url)) {
      coach.background_image_url = null;
    }
    //檢查銀行存摺影像網址是否正確，不正確則設為null
    if (!coach.bankbook_copy_url || isNotValidUrl(coach.bankbook_copy_url)) {
      coach.bankbook_copy_url = null;
    }
    const coachSkillData = await coachSkillRepo.find({
      where: { coach_id: coachId },
      relations: ["Skill"],
    });
    // 取得教練技能資料
    if (coachSkillData.length > 0) {
      const coachSkills = coachSkillData.map((cs) => ({
        name: cs.Skill.name,
      }));

      const coachData = {
        id: coach.id,
        email: coach.email,
        nickname: coach.nickname,
        skills: coachSkills || [], //技能陣列
        profile_image_url: coach.profile_image_url,
        background_image_url: coach.background_image_url,
        job_title: coach.job_title,
        about_me: coach.about_me,
        hobby: coach.hobby,
        experience: coach.experience,
        favorite_words: coach.favorite_words,
        motto: coach.motto,
        is_verified: coach.is_verified,
        realname: coach.realname,
        id_number: coach.id_number,
        phone_number: coach.phone_number,
        birthday: coach.birthday,
        lisence: coach.lisence,
        bank_code: coach.bank_code,
        bank_account: coach.bank_account,
        bankbook_copy_url: coach.bankbook_copy_url,
        skill_description: coach.skill_description,
        experience_years: coach.experience_years,
        created_at: formatDate(coach.created_at),
        updated_at: formatDate(coach.updated_at),
      };
      const coachLicenseData = await coachLisenseRepo.find({
        where: { coach_id: coachId },
      });
      let coachLicenses = [];
      if (coachLicenseData.length > 0) {
        coachLicenses = coachLicenseData.map((cl) => ({
          id: cl.id,
          name: cl.filename,
        }));
      }

      res.status(200).json({
        status: true,
        message: "成功取得資料",
        data: {
          coachDetails: coachData,
          licenses: coachLicenses || [],
        },
      });
    }
  } catch (error) {
    next(error);
  }
}

//教練修改個人檔案
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
    "bankbook_copy_public_id",
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
    "profile_image_public_id",
    "background_image_url",
    "background_image_public_id",
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

      //對於上傳檔案有關(大頭貼、存摺封面、背景圖)的資料，將url跟public_id組合，確保一同更新
      const fileFieldPairs = [
        ["profile_image_url", "profile_image_public_id"],
        ["bankbook_copy_url", "bankbook_copy_public_id"],
        ["background_image_url", "background_image_public_id"],
      ];
      for (const [urlKey, publicIdKey] of fileFieldPairs) {
        const newUrl = filteredData[urlKey];
        const newPublicId = filteredData[publicIdKey];

        //驗證兩個欄位是否都有提供
        if (newUrl !== undefined || newPublicId !== undefined) {
          if (!newUrl || !newPublicId) {
            throw generateError(400, `缺少 ${urlKey}或 ${publicIdKey}`);
          }
          const oldUrl = transactionalCoach[urlKey];
          const oldPublicId = transactionalCoach[publicIdKey];

          const trimmedUrl = typeof newUrl === "string" ? newUrl.trim() : newUrl;
          const trimmedId = typeof newPublicId === "string" ? newPublicId.trim() : newPublicId;

          //驗證是否有url、public_id只改了其中一欄 : true對false時就會報錯。
          const isUrlChanged = trimmedUrl !== oldUrl;
          const isIdChanged = trimmedId !== oldPublicId;
          if (isUrlChanged !== isIdChanged) {
            throw generateError(400, "檔案資訊不一致，必須同時更改 URL 與 Public ID");
          }
          //url/public key必須都被改寫才進行更新
          if (isUrlChanged && isIdChanged) {
            transactionalCoach[urlKey] = trimmedUrl;
            transactionalCoach[publicIdKey] = trimmedId;
            updatedFields.push(urlKey, publicIdKey);
            //刪除cloudinary上的舊檔案
            await cloudinary.uploader.destroy(oldPublicId);
          }
          //都沒改，就不會做任何處理
        }
      }

      //以迴圈取出有改動的欄位並更新資料，但若取到skill或license_data，因為處理邏輯特殊，用continue跳過此迴圈
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
        //skill更動原則 : 不可任意刪除、減少專長，否則會影響已開設的課程
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
            !fileInfo.file_public_id ||
            !fileInfo.filename
          ) {
            throw generateError(400, "上傳檔案所需資料不足，應包含檔名、url、public_id。");
          }
        }
        const currentLicenses = transactionalCoach.Coach_License || [];

        //列出需新增的證照
        const licenseToAdd = newLicensesFromReq.filter((newLicenseData) => {
          //完全比對是否有重複url和public_id相同
          const completelySame = currentLicenses.some(
            (currentLicense) =>
              currentLicense.file_url === newLicenseData.file_url &&
              currentLicense.file_public_id === newLicenseData.file_public_id
          );
          //任一欄位是否有與舊資料相同，若有就報錯
          const inputConflict = currentLicenses.some(
            (currentLicense) =>
              currentLicense.file_url === newLicenseData.file_url ||
              currentLicense.file_public_id === newLicenseData.file_public_id
          );
          if (inputConflict && !completelySame) {
            throw generateError(400, "檔案資訊不一致，必須同時更改 URL 與 Public ID");
          }
          return !completelySame; //僅計算完全url、public_id都變更的，為要更新的證照
        });

        //列出需要從資料庫移除的證照(若教練更新後去掉某證照附件)
        const licenseToRemove = currentLicenses.filter((currentLicense) => {
          const found = newLicensesFromReq.some(
            (newLicense) =>
              newLicense.file_url === currentLicense.file_url &&
              newLicense.file_public_id === currentLicense.file_public_id
          );
          return !found; //若req.body輸入的license資料等同資料庫資料(資料皆未改變)，found會是true，但只要有一項資料不符合(!found是true)，就加入licenseToRemove
        });

        //檢查license_data是否有刪除動作，有的話執行刪除(先從cloudinary刪除檔案，再將新上傳檔案資料與檔案名稱建入資料庫)並紀錄
        if (licenseToRemove.length > 0) {
          //執行刪除操作
          for (const license of licenseToRemove) {
            //從cloudinary刪除舊證照(若先前未上傳過，public為null就跳過)
            if (license.file_public_id) {
              await cloudinary.uploader.destroy(license.file_public_id);
            }
            await transactionalEntityManager
              .getRepository("Coach_License")
              .delete({ id: license.id });
          }
          licenseDataActuallyChanged = true;
        }
        //檢查license_data是否有新增或更新動作，有的話執行並記錄
        if (licenseToAdd.length > 0) {
          for (const newLicenseData of licenseToAdd) {
            //嘗試找到file_url和filename與資料庫都匹配的現有證照
            const newCoachLicense = transactionalEntityManager.create("Coach_License", {
              Coach: transactionalCoach,
              file_url: newLicenseData.file_url,
              file_public_id: newLicenseData.file_public_id,
              filename: newLicenseData.filename,
            });
            await transactionalEntityManager.getRepository("Coach_License").save(newCoachLicense);
          }
          licenseDataActuallyChanged = true;
        }
        //檢查若證照有更新，就紀錄license_data有變更
        if (licenseDataActuallyChanged) {
          updatedFields.push("license_data");
        }
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
        bank_code: finalCoachData.bank_code,
        bank_account: finalCoachData.bank_account,
        bankbook_copy_url: finalCoachData.bankbook_copy_url,
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
        profile_image_public_id: finalCoachData.profile_image_public_id,
        background_image_url: finalCoachData.background_image_url,
        background_image_public_id: finalCoachData.background_image_public_id,
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
        file_public_id: cl.file_public_id,
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

//教練後台取得自己課程列表
async function getOwnCourses(req, res, next) {
  try {
    const coachId = req.user.id;

    //取得需顯示的教練個人資訊
    const coachProfile = await coachRepo.findOne({
      select: ["id", "nickname", "profile_image_url", "is_verified", "job_title"],
      where: { id: coachId },
    });
    //排除找不到教練個人資訊的狀況
    if (!coachProfile) {
      return next(generateError(404, "查無教練資料"));
    }
    //改寫is_verified的值為已審核/未審核
    coachProfile.is_verified = coachProfile.is_verified === true ? "已審核" : "未審核";

    //取得教練所有課程
    const courses = await courseRepo
      .createQueryBuilder("c")
      .leftJoin("c.Skill", "s")
      .select([
        "c.id AS course_id",
        "c.name AS title",
        "s.name AS type",
        "c.image_url AS picture_url",
        "c.score AS score",
        "c.numbers_of_view AS numbers_of_view",
        "c.total_hours AS total_hours",
        "c.description AS description",
        "c.is_approved AS is_approved",
      ])
      .where("c.coach_id = :id", { id: coachId })
      .orderBy("c.numbers_of_view", "DESC")
      .addOrderBy("c.is_approved", "DESC")
      .getRawMany();

    //改寫courses資料的審核狀況為 已審核/未審核
    courses.forEach((item) => {
      item.is_approved = item.is_approved === true ? "已審核" : "未審核";
    });

    //組裝呈現資料
    const data = {
      coach: coachProfile,
      courses: courses,
    };
    res.status(200).json({
      status: true,
      message: "成功取得資料",
      data: data,
    });
  } catch (error) {
    next(error);
  }
}

//教練建立課程API
async function postNewCourse(req, res, next) {
  try {
    const coachId = req.user.id;
    //驗證JWT token解出的教練id格式，及是否有此教練
    if (!coachId || isNotValidString(coachId) || coachId.length === 0 || isNotValidUUID(coachId)) {
      return next(generateError(400, "教練ID格式不正確"));
    }
    const { name, description, sports_type, image_url } = req.body;
    if (
      isNotValidString(name) ||
      isNotValidString(description) ||
      isNotValidString(sports_type) ||
      isNotValidUrl(image_url)
    ) {
      return next(generateError(400, "欄位未填寫正確"));
    }
    //取得教練相關rawData
    const rawData = await coachRepo
      .createQueryBuilder("c")
      .leftJoin("c.Coach_Skill", "cs")
      .leftJoin("cs.Skill", "s")
      .where("c.id = :id", { id: coachId })
      .select(["c.id AS coach_id", "s.id AS skill_id", "s.name AS skill_name"])
      .getRawMany();

    if (rawData.length === 0) {
      return next(generateError(400, "未能確認教練身分"));
    }
    if (name.length < 2 || name.length > 50) {
      return next(generateError(400, `${name}超出字數限制`));
    }
    if (description.length < 2 || description.length > 2048) {
      return next(generateError(400, `${description}超出字數限制`));
    }
    if (sports_type.length > 20) {
      return next(generateError(400, `${sports_type}超出字數限制`));
    }
    //驗證是否是有效的專長(課程類別
    const skill = await skillRepo.findOneBy({ name: sports_type });
    if (skill.length === 0) {
      return next(generateError(400, `${sports_type}不是可開課的專長，詳洽管理員`));
    }
    //驗證教練是否具有所填入表單的專長
    const hasSkillCheck = rawData.filter((data) => data.skill_name === sports_type);
    if (hasSkillCheck.length === 0) {
      return next(generateError(400, `您不具${sports_type}專長，無法開設此課程`));
    }

    //使用Joi驗證章節框架資料
    const data = req.body.chapters;
    const { error, value } = chaptersArraySchema.validate(data, { abortEarly: false }); //abortEarly若為true，則發現錯誤就會中斷程式運行
    if (error) {
      const errors = error.details.map((detail) => {
        return {
          field: detail.path.join("."), // 錯誤發生的路徑，例如 chapters.0.sub_chapter.1.subtitle，與message一起存到errors裡並用logger印出
          message: detail.message,
        };
      });
      logger.warn(errors);
      return next(generateError(400, "章節格式驗證失敗"));
    }
    //將課程資料存入course資料表
    //驗證是否有相同課程名稱
    let course = await courseRepo.find({ where: { name: name } });
    if (course.length > 0) {
      return next(generateError(409, "課程名稱已存在，不可重複建立"));
    }
    const newCourse = courseRepo.create({
      name,
      coach_id: coachId,
      description,
      type_id: skill.id,
      image_url,
      is_approved: false,
    });
    await courseRepo.save(newCourse);
    //將章節資料存入course_chapter資料表
    const savedData = await courseRepo.findOneBy({ coach_id: coachId, name: name });
    const chapterRecordsToCreate = [];

    for (const chapter of value) {
      const { chapter_number, chapter_name, sub_chapter } = chapter;

      for (const subItem of sub_chapter) {
        const { sub_chapter_number, subtitle } = subItem;

        const newChapterRecord = courseChapterRepo.create({
          course_id: savedData.id,
          chapter_number,
          title: chapter_name,
          sub_chapter_number,
          subtitle,
        });
        chapterRecordsToCreate.push(newChapterRecord);
      }
    }
    //typeorm可以批量插入資料庫
    const insertedChapters = await courseChapterRepo.save(chapterRecordsToCreate);

    //組合回傳結果
    //重新組裝章節架構
    const responseChapters = [];
    const chapterMap = new Map();
    for (const item of insertedChapters) {
      const { chapter_number, title, sub_chapter_number, subtitle, id } = item;

      if (!chapterMap.has(chapter_number)) {
        chapterMap.set(chapter_number, {
          chapter_number: chapter_number,
          chapter_name: title,
          sub_chapter: [],
        });
      }
      chapterMap.get(chapter_number).sub_chapter.push({
        id: id,
        sub_chapter_number: sub_chapter_number,
        subtitle: subtitle,
      });
    }
    responseChapters.push(...chapterMap.values());

    const result = {
      course_id: savedData.course_id,
      name: savedData.name,
      description: savedData.description,
      sports_type: savedData.name,
      chapters: responseChapters,
    };

    res.status(201).json({
      status: true,
      message: "成功新增資料",
      data: { course: result },
    });
  } catch (error) {
    next(error);
  }
}

//教練編輯課程API
async function patchCourse(req, res, next) {
  try {
    const coachId = req.user.id;
    const courseId = req.params.courseId;
    if (isNotValidUUID(courseId)) {
      return next(generateError(400, "找不到該課程，id格式錯誤"));
    }
    const course = courseRepo.findOneBy({ id: courseId });
    if (!course) {
      return next(generateError(400, "找不到該課程"));
    }

    //取得並驗證request body內容
    const { name, description, sports_type, image_url, image_public_id, chapters } = req.body;
    if (
      isNotValidString(name) ||
      isNotValidString(description) ||
      isNotValidString(sports_type) ||
      isNotValidUrl(image_url) ||
      isNotValidString(image_public_id)
    ) {
      return next(generateError(400, "欄位未填寫正確"));
    }
    //取得教練相關rawData
    const rawData = await coachRepo
      .createQueryBuilder("c")
      .leftJoin("c.Coach_Skill", "cs")
      .leftJoin("cs.Skill", "s")
      .where("c.id = :id", { id: coachId })
      .select(["c.id AS coach_id", "s.id AS skill_id", "s.name AS skill_name"])
      .getRawMany();

    if (rawData.length === 0) {
      return next(generateError(400, "未能確認教練身分"));
    }
    if (name.length < 2 || name.length > 50) {
      return next(generateError(400, `${name}超出字數限制`));
    }
    if (description.length < 2 || description.length > 2048) {
      return next(generateError(400, `${description}超出字數限制`));
    }
    if (sports_type.length > 20) {
      return next(generateError(400, `${sports_type}超出字數限制`));
    }
    //驗證是否是有效的專長(課程類別
    const skill = await skillRepo.findOneBy({ name: sports_type });
    if (skill.length === 0) {
      return next(generateError(400, `${sports_type}不是可開課的專長，詳洽管理員`));
    }
    //驗證教練是否具有所填入表單的專長
    const hasSkillCheck = rawData.filter((data) => data.skill_name === sports_type);
    if (hasSkillCheck.length === 0) {
      return next(generateError(400, `您不具${sports_type}專長，無法開設此課程`));
    }

    //使用Joi驗證章節框架資料
    const { error, value } = chaptersArraySchema.validate(chapters, { abortEarly: false }); //abortEarly若為true，則發現錯誤就會中斷程式運行
    if (error) {
      const errors = error.details.map((detail) => {
        return {
          field: detail.path.join("."), // 錯誤發生的路徑，例如 chapters.0.sub_chapter.1.subtitle，與message一起存到errors裡並用logger印出
          message: detail.message,
        };
      });
      logger.warn(errors);
      return next(generateError(400, "章節格式驗證失敗"));
    }
    //鋪平巢狀的req.body章節架構
    const { chapterMap, subChapterMap } = chapterDestructor(chapters);
    console.log(subChapterMap.get(1));
    // console.log(subChapterMap.get(1));

    //取得資料庫儲存的章節資料

    res.status(200).json({
      status: true,
      message: "成功修改資料",
      data: {},
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCoachViewStats,
  getProfile,
  patchProfile,
  getOwnCourses,
  postNewCourse,
  patchCourse,
};
