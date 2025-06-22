const { In } = require("typeorm");
const logger = require("../config/logger");
const cloudinary = require("cloudinary").v2;
const dayjs = require("dayjs");

const AppDataSource = require("../db/data-source");
const courseRepo = AppDataSource.getRepository("Course");
const viewRepo = AppDataSource.getRepository("View_Stat");
const coachRepo = AppDataSource.getRepository("Coach");
const skillRepo = AppDataSource.getRepository("Skill");
const coachSkillRepo = AppDataSource.getRepository("Coach_Skill");
const coachLisenseRepo = AppDataSource.getRepository("Coach_License");
const courseChapterRepo = AppDataSource.getRepository("Course_Chapter");
const { Mux } = require("@mux/mux-node");
const config = require("../config/index");
const { muxTokenId, muxTokenSecret } = config.get("mux");
//建立mux api客戶端實例，設定存取憑證。建立後可用以調用各種mux提供的API方法。
const mux = new Mux({
  muxTokenId,
  muxTokenSecret,
});

//services

//utils
const {
  isNotValidString,
  isNotValidUUID,
  isNotValidUrl,
  isValidMonthFormat,
} = require("../utils/validators"); // 引入驗證工具函數
const generateError = require("../utils/generateError");
const { validateField } = require("../utils/coachProfileValidators");
const { chaptersArraySchema } = require("../utils/courseDataValidators"); //引入驗證教練課程表單的章節架構驗證模組
const { formatDate } = require("../utils/formatDate");
const maskString = require("../utils/maskString"); //引入遮蔽敏感資訊(如用戶相關id)的模糊化字串工具

//教練取得所有課程(可以限制特定一門課程)的每月觀看次數、總計觀看次數API
async function getCoachAnalysis(req, res, next) {
  try {
    //禁止前端亂輸入參數，如banana=999
    const validQuery = ["courseId", "month"]; //month是用以選擇特定收益月份
    const queryKeys = Object.keys(req.query);
    const invalidQuery = queryKeys.filter((key) => !validQuery.includes(key));
    if (invalidQuery.length > 0) {
      return next(generateError(400, `不允許的參數：${invalidQuery.join(", ")}`));
    }
    const coachId = req.user.id;
    //驗證req.body與query string的資訊
    const courseId = req.query.courseId || null;
    const month = req.query.month || null;
    if (courseId !== null && (isNotValidString(courseId) || isNotValidUUID(courseId))) {
      return next(generateError(400, "課程ID格式不正確"));
    }
    const course = await courseRepo.findOneBy({ id: courseId });
    if (!course) {
      return next(generateError(404, "查無此課程"));
    }
    if (courseId !== null && coachId !== course.coach_id) {
      return next(generateError(403, "權限不足，您未擁有這門課程"));
    }

    if (month && !isValidMonthFormat(month)) {
      return next(generateError(400, "月份格式錯誤，請使用 YYYY-MM 格式"));
    }
    //建立供教練選擇的課程選項列
    const courseOptions = await courseRepo.find({
      where: { coach_id: coachId, is_approved: "true" },
      select: ["id", "name"],
    });

    //將課程選項化為courseId
    const courseIds = courseOptions.map((c) => c.id);
    //若還沒有已上架的課程，則回傳空資料
    if (!courseIds.length)
      return res.status(200).json({
        courseOptions,
        status: true,
        message: "您還沒有開通課程，尚無報表可供查詢",
        data: null,
      });

    //依照courseId做篩選查詢。若未輸入id，則返回教練開設的所有課程
    const courseFilter = courseId ? "v.course_id = :courseId" : "v.course_id IN (:...courseIds)"; //將courseIds展開以列出所有值
    const courseParams = courseId ? { courseId } : { courseIds };

    //查詢by課程、所有月份觀看次數統計
    const viewStats = await viewRepo
      .createQueryBuilder("v")
      .leftJoin("v.Course", "c")
      .select([
        "v.course_id AS course_id",
        "DATE_TRUNC('month', v.date) AS month",
        "SUM(v.view_count) AS view_count",
        "c.name AS name",
      ])
      .where(courseFilter, courseParams)
      .groupBy("course_id")
      .addGroupBy("name")
      .addGroupBy("month")
      .orderBy("course_id")
      .addOrderBy("month", "ASC")
      .getRawMany();

    //調整觀看次數呈現的資料格式
    for (const i of viewStats) {
      i.month = i.month ? dayjs(i.month).format("YYYY-MM") : "未知";
    }

    //目前收益分成沒有計算by課程的要素，所以只有不分課程時才呈現
    // 但若深究分成計算方式，也會需要依照課程執行

    //設定若有只訂月份時的查詢範圍
    const monthBegin = dayjs(`${month}-01`).startOf("month").toDate();
    const monthEnd = dayjs(monthBegin).endOf("month").toDate();

    const revenueStats = await paymentRepo
      .createQueryBuilder("p")
      .select([
        "DATE_TRUNC('month', p.transfered_at) AS month",
        "SUM(p.amount) AS revenue",
        "p.is_transfered AS is_transfered",
      ])
      .where("p.coach_id = :coachId", { coachId })
      .andWhere("p.transfered_at BETWEEN :monthBegin AND :monthEnd", { monthBegin, monthEnd })
      .groupBy("month")
      .addGroupBy("is_transfered")
      .orderBy("month", "ASC")
      .getRawMany();

    //計算總收益(包括未匯款)
    let revenueOfAllTime = revenueStats.reduce((sum, r) => sum + Number(r.revenue), 0);

    //調整收益分成的金錢資料格式
    for (const i of revenueStats) {
      i.month = i.month ? dayjs(i.month).format("YYYY-MM") : "未知";
      i.revenue = i.revenue
        ? new Intl.NumberFormat("zh-TW", {
            style: "currency",
            currency: "NTD",
          }).format(i.revenue)
        : "0";
      i.is_transfered = i.is_transfered === true ? "已支付" : "未支付";
    }

    //加總觀看次數(特定課程或所有課程)
    let totalViewsByCourse = viewStats.reduce((sum, v) => sum + Number(v.view_count), 0);

    //製作圓餅圖呈現的百分比資料，因為圖表套件會自行套用百分比，只提供數值
    let pie_chart = [];
    for (const month of viewStats) {
      const viewCount = Number(month.view_count);
      const percentage =
        totalViewsByCourse > 0 ? Math.round((viewCount / totalViewsByCourse) * 100) : 0;
      pie_chart.push({ month: month.month, percentage: percentage });
    }

    //調整總觀看次數資料格式
    totalViewsByCourse = totalViewsByCourse
      ? new Intl.NumberFormat().format(totalViewsByCourse)
      : "0";

    //調整總收益的金錢資料格式
    revenueOfAllTime = revenueOfAllTime
      ? new Intl.NumberFormat("zh-TW", {
          style: "currency",
          currency: "NTD",
        }).format(revenueOfAllTime)
      : "0";

    //建立三個月前至今逐月的觀看次數變化(底下的手風琴選單)

    //取得三個月前至今的時間範圍
    const now = dayjs();
    const startMonth = now.startOf("month").subtract(3, "month"); //取得三個月前，設定三個月前首日起始
    const endMonth = now.endOf("month"); //累計到本月底

    const startDate = startMonth.toDate();
    const endDate = endMonth.toDate();

    //取得特定課程前三個月至今每月的觀看紀錄
    const viewByLast3M = await viewRepo
      .createQueryBuilder("v")
      .leftJoin("v.CourseChapter", "cc")
      .select([
        "cc.id AS subchapter_id",
        "DATE_TRUNC('month', v.date) AS month",
        "SUM(v.view_count) AS monthly_views",
        "cc.chapter_number AS chapter_number",
        "cc.title AS title",
      ])
      .where("cc.course_id = :courseId", { courseId })
      .andWhere("v.date BETWEEN :startDate AND :endDate", { startDate, endDate })
      .groupBy("cc.id")
      .addGroupBy("cc.chapter_number")
      .addGroupBy("cc.title")
      .addGroupBy("month")
      .orderBy("cc.chapter_number", "ASC")
      .addOrderBy("month", "ASC")
      .getRawMany();

    //單獨取得章節的總收看次數
    const viewsOfAllTime = await viewRepo
      .createQueryBuilder("v")
      .leftJoin("v.CourseChapter", "cc")
      .select([
        "SUM(v.view_count) AS total_views",
        "cc.chapter_number AS chaptern_umber",
        "cc.title AS title",
      ])
      .where("cc.course_id = :courseId", { courseId })
      .groupBy("cc.chapter_number")
      .addGroupBy("cc.title")
      .orderBy("chapter_number", "ASC")
      .getRawMany();

    //建立依照章節名稱分組的觀看次數資料 : 三個月至今每個月、章節總觀看次數、本月新增次數、上個月新增次數
    const statsByChapter = new Map();

    //在陣列內建立每個月的資料架構
    for (const stat of viewByLast3M) {
      const title = stat.title;
      const chNumber = stat.chapter_number;
      const month = dayjs(stat.month).format("YYYY-MM");
      const viewCount = Number(stat.monthly_views);

      if (!statsByChapter.has(title)) {
        statsByChapter.set(title, {
          chapterNumber: chNumber,
          title,
          monthly: {},
          totalViews: 0,
          currentMonth: 0,
          lastMonth: 0,
        });
      }
      const chapter = statsByChapter.get(title);
      chapter.monthly[month] = viewCount;
    }
    //將特定章節的總觀看次數賦予到每章節的totalViews上
    for (const stat of viewsOfAllTime) {
      const title = stat.title;
      if (statsByChapter.has(title)) {
        statsByChapter.get(title).totalViews = Number(stat.total_views);
      }
    }
    //轉成陣列
    const chapterStats = Array.from(statsByChapter.values());

    //計算統計資料
    const currentMonthStr = now.format("YYYY-MM");
    const lastMonthStr = now.subtract(1, "month").format("YYYY-MM");

    for (const chapter of chapterStats) {
      chapter.currentMonth = chapter.monthly[currentMonthStr] || 0;
      chapter.lastMonth = chapter.monthly[lastMonthStr] || 0;

      //轉換觀看次數數字為千分位標註逗號的字串
      chapter.currentMonth = chapter.currentMonth
        ? new Intl.NumberFormat().format(chapter.currentMonth)
        : "0";
      chapter.lastMonth = chapter.lastMonth
        ? new Intl.NumberFormat().format(chapter.lastMonth)
        : "0";
      chapter.totalViews = chapter.totalViews
        ? new Intl.NumberFormat().format(chapter.totalViews)
        : "0";
      for (const m in chapter.monthly) {
        chapter.monthly[m] = chapter.monthly[m]
          ? new Intl.NumberFormat().format(chapter.monthly[m])
          : "0";
      }
    }

    //取得教練各人資訊
    const coachInfo = await coachRepo.findOneBy({ id: coachId });

    //組裝所有資料
    const analysisData = {
      coach: {
        coach_id: coachId,
        nickname: coachInfo.nickname,
        profile_image_url: coachInfo.profile_image_url,
      },
      summary: {
        total_income: revenueOfAllTime,
        total_views: totalViewsByCourse,
      },
      view_stats: {
        pie_chart,
        bar_chart: viewStats,
      },
      income_detail: revenueStats,
      chapter_report: statsByChapter,
    };

    res.status(200).json({
      status: true,
      message: "成功取得資料",
      data: analysisData,
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
    const coachSkillData = await coachSkillRepo.find({
      where: { coach_id: coachId },
      relations: ["Skill"],
    });
    // 取得教練技能資料
    const coachSkills = [];
    if (coachSkillData.length > 0) {
      coachSkillData.map((cs) => coachSkills.push(cs.Skill.name));
    }
    const coachData = {
      id: coach.id,
      email: coach.email,
      nickname: coach.nickname,
      skills: coachSkills || [], //技能陣列
      profile_image_url: coach.profile_image_url,
      profile_image_public_id: coach.profile_image_public_id,
      background_image_url: coach.background_image_url,
      background_image_public_id: coach.background_image_public_id,
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
      bankbook_copy_public_id: coach.bankbook_copy_public_id,
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
        file_public_id: cl.file_public_id,
        file_url: cl.file_url,
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
            //刪除cloudinary上的舊檔案，必須是id有更新，且原id不是null的情況
            if (isIdChanged && oldPublicId) {
              await cloudinary.uploader.destroy(oldPublicId);
            }
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
            throw generateError(400, "證照上傳檔案所需資料不足，應包含檔名、url、public_id。");
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
        bankbook_copy_public_id: finalCoachData.bankbook_copy_public_id,
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

    //取得教練所有課程(由於課程表單必須都填滿才送出，所以空殼課程要隱藏)
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
      .andWhere("c.name IS NOT NULL AND c.name <> '' ")
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

async function getEditingCourse(req, res, next) {
  try {
    const coachId = req.user.id;
    const courseId = req.params.courseId;
    if (isNotValidUUID(courseId)) {
      return next(generateError(400, "課程ID格式不正確"));
    }
    //取得對應課程表單資料
    const course = await courseRepo.findOne({
      where: { coach_id: coachId, id: courseId },
      relations: ["Skill", "Course_Chapter"],
    });
    if (!course) {
      return next(generateError(400, "找不到該課程"));
    }
    //組合呈現給前端的章節資料
    const chapters = course.Course_Chapter;
    const resChapters = [];

    chapters.forEach((item) => {
      //建構章節層的架構。檢查push目標resChapters內是否已有對應章節編號，若無，就新增一筆
      let chapter = resChapters.find((c) => c.chapter_number === item.chapter_number);
      if (!chapter) {
        chapter = {
          chapter_number: item.chapter_number,
          chapter_title: item.title,
          sub_chapter: [],
        };
        resChapters.push(chapter);
      }
      //推送小節層的架構到對應章節內
      chapter.sub_chapter.push({
        subchapter_id: item.id,
        sub_chapter_number: item.sub_chapter_number,
        subtitle: item.subtitle,
        filename: item.filename,
        status: item.status,
      });
    });
    //組合其他課程資料，並加入章節資料
    const data = {
      course_id: courseId,
      name: course.name,
      description: course.description,
      sports_type: course.Skill.name,
      image_url: course.image_url,
      image_public_id: course.image_public_id,
      chapters: resChapters,
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

//教練編輯課程API (教練建立新課程、編輯課程都用這個)
async function patchCourse(req, res, next) {
  try {
    const coachId = req.user.id;
    const courseId = req.params.courseId;
    if (isNotValidUUID(courseId)) {
      return next(generateError(400, "課程ID格式錯誤"));
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
    if (name.length < 2 || name.length > 50) {
      return next(generateError(400, `${name}超出字數限制`));
    }
    if (description.length < 2 || description.length > 2048) {
      return next(generateError(400, `${description}超出字數限制`));
    }
    if (sports_type.length > 20) {
      return next(generateError(400, `${sports_type}超出字數限制`));
    }

    //取得教練與技能相關資料
    const skillData = await skillRepo
      .createQueryBuilder("s")
      .leftJoin("s.CoachSkills", "cs")
      .select(["s.id AS skill_id", "s.name AS skill_name", "cs.coach_id AS coach_id"])
      .getRawMany();

    //驗證教練是否具有所填入表單的專長
    const hasSkill = skillData.filter(
      (item) => item.skill_name === sports_type && item.coach_id === coachId
    );
    if (hasSkill.length === 0) {
      return next(generateError(400, `您不具受認證的${sports_type}專長，無法開設此課程`));
    }

    //驗證教練是否的確是此課程表單的創建者
    let course = await courseRepo.findOne({
      where: { id: courseId, coach_id: coachId },
    });
    if (!course) {
      return next(generateError(400, "查無此課程表單"));
    }
    //驗證課程是否有撞名
    const sameCourseName = await courseRepo.find({
      where: { name: name },
    });
    if (sameCourseName.length > 1) {
      return next(generateError(409, `已有相同課程名稱 ${name}`));
    }

    //使用Joi驗證章節框架資料
    const { error } = chaptersArraySchema.validate(chapters, { abortEarly: false }); //abortEarly若為true，則發現錯誤就會中斷程式運行
    if (error) {
      const errors = error.details.map((detail) => {
        return {
          field: detail.path.join("."), // 錯誤發生的路徑，例如 chapters.0.sub_chapter.1.subtitle，與message一起存到errors裡並用logger印出
          message: detail.message,
        };
      });
      logger.warn(errors);
      return next(generateError(400, `章節格式驗證失敗，請檢查每個章節是否都有輸入內容並上傳影片`));
    }

    //將章節巢狀架構鋪平
    const chapterItems = [];
    chapters.forEach((ch) => {
      const { chapter_number, chapter_title, sub_chapter } = ch;

      sub_chapter.forEach((sub) => {
        const { subchapter_id, sub_chapter_number, subtitle, filename } = sub;
        chapterItems.push({
          id: subchapter_id,
          course_id: courseId,
          chapter_number,
          title: chapter_title,
          sub_chapter_number,
          subtitle,
          filename,
        });
      });
    });

    //檢查章節數字是否重複
    //使用set儲存唯一值，並跟章節數量比對是否一致
    const chNumbers = chapters.map((ch) => ch.chapter_number);
    const hasSameChNumbre = new Set(chNumbers).size !== chNumbers.length;
    if (hasSameChNumbre) {
      return next(generateError(400, "chapter_number有重複"));
    }
    //檢查章節跳號
    const sorted = [...chNumbers].sort((a, b) => a - b);
    const hasGap = sorted.some((num, i) => num !== i + 1);
    if (hasGap) {
      return next(generateError(400, "chapter_number有跳號"));
    }

    //檢查小節重複或跳號
    function checkSubNumbres(chapters) {
      const result = [];

      chapters.forEach((ch) => {
        const chNum = ch.chapter_number;
        const subs = ch.sub_chapter || [];

        const numbres = subs.map((sub) => sub.sub_chapter_number);
        const sorted = [...numbres].sort((a, b) => a - b);

        const hasSame = new Set(numbres).size !== numbres.length;
        const hasGap = sorted.some((num, i) => num !== i + 1);

        if (hasSame) {
          result.push(`第${chNum}章有重複的小節編號`);
        }
        if (hasGap) {
          result.push(`第${chNum}章有小節跳號`);
        }
      });
      return result;
    }

    const subSameOrGapChecking = checkSubNumbres(chapters);

    if (subSameOrGapChecking.length > 0) {
      return next(generateError(400, subSameOrGapChecking));
    }
    //構建Course資料表的更新內容
    let courseToUpdate = {
      id: courseId,
      coach_id: coachId,
      name: name,
      description: description,
      type_id: course.type_id,
      image_url: image_url,
      image_public_id: image_public_id,
      is_approved: course.is_approved,
    };

    //檢查req body送入的小節id是否一致屬於該課程id
    let subChapterIds = [];
    for (const sub of chapterItems) {
      subChapterIds.push(sub.id);
    }
    //查資料庫已存在的小節id
    const existingSubsArr = await courseChapterRepo
      .createQueryBuilder("cc")
      .select(["cc.id AS id"])
      .where("cc.id IN (:...ids)", { ids: subChapterIds })
      .getRawMany();
    const ids = existingSubsArr.map((obj) => obj.id);
    //再拿這些資料庫建過檔的id重新查詢是正確課程的id
    const subsOfRightCourse = await courseChapterRepo.find({
      where: {
        id: In(ids),
        course_id: courseId,
      },
      select: ["id"],
    });
    const rightIds = await subsOfRightCourse.map((obj) => obj.id);

    //過濾不屬於該課程的id
    let idsOfWrongCourse = ids.filter((id) => !rightIds.includes(id));

    if (idsOfWrongCourse.length > 0) {
      logger.warn(`課程編號${courseId}更新失敗，小節更新到錯誤課程`);
      return next(generateError(400, "章節小節未能正確儲存"));
    }

    //刪除更動後沒有使用到的小節id、影片
    //取得所有資料庫內的該課程id
    const allSubArr = await courseChapterRepo.find({
      where: { course_id: courseId },
      select: ["id", "mux_asset_id"],
    });
    const allSubIds = allSubArr.map((s) => s.id);

    //比對資料庫有，但req.body沒有的id，代表此次改動後該被刪除
    const subChapterToDeleteIds = allSubIds.filter((id) => !subChapterIds.includes(id));

    //找到要刪除的小節包含mux_asset_id
    const subChapterToDelete = allSubArr.filter((s) => subChapterToDeleteIds.includes(s.id));
    //刪除mux資源
    for (const sub of subChapterToDelete) {
      if (sub.mux_asset_id) {
        try {
          await mux.video.assets.delete(sub.mux_asset_id);
          logger.info(`刪除 Mux 資源: ${maskString(sub.mux_asset_id, 5)}`);
        } catch (err) {
          logger.error(`刪除失敗: ${maskString(sub.mux_asset_id, 5)}`, err);
        }
      }
    }
    //刪除小節資料
    if (subChapterToDeleteIds.length > 0) {
      await courseChapterRepo.delete(subChapterToDelete);
      logger.info(
        `刪除課程 ${maskString(courseId, 5)} 的棄用小節共 ${subChapterToDeleteIds.length}筆成功}`
      );
    }

    //判斷課程封面是否有更新(需url與public_id都有改變)
    const isUrlChanged = image_url !== course.image_url;
    const isPublicIdChange = image_public_id !== course.image_public_id;
    if (isUrlChanged !== isPublicIdChange) {
      return next(generateError(400, "檔案資訊不一致，必須同時更改 URL 與 Public ID"));
    }

    if (isUrlChanged && isPublicIdChange) {
      //若public id改變，且此前沒有上傳過檔案(public id為null)先存舊public id以備cloudinary刪除
      if (isPublicIdChange && course.image_public_id) {
        const oldPublicId = course.image_public_id;
        await cloudinary.uploader.destroy(oldPublicId);
      }
      //course更新一次欲存入資料庫的新資料
      courseToUpdate = {
        id: courseId,
        coach_id: coachId,
        name,
        description,
        type_id: hasSkill[0].skill_id,
        image_url,
        image_public_id,
        is_approved: course.is_approved,
      };
    }

    // 將改動存入Course、Course_Chapter資料表
    await courseChapterRepo.save(chapterItems);
    await courseRepo.save(courseToUpdate);

    res.status(200).json({
      status: true,
      message: "已儲存資料",
      data: { course: courseToUpdate, chapters: chapterItems },
    });
  } catch (error) {
    next(error);
  }
}
module.exports = {
  getCoachAnalysis,
  getProfile,
  patchProfile,
  getOwnCourses,
  getEditingCourse,
  patchCourse,
};
