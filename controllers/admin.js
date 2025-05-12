const AppDataSource = require("../db/data-source");
const planRepo = AppDataSource.getRepository("Plan");
const skillRepo = AppDataSource.getRepository("Skill");
const coachRepo = AppDataSource.getRepository("Coach");
const generateError = require("../utils/generateError");
const {
  isUndefined,
  isNotValidString,
  isNotValidInteger,
} = require("../utils/validators");

//新增訂閱方案，目前沒有畫管理員相應UI的線稿
async function postPlan(req, res, next) {
  try {
    const { name, intro, pricing, max_resolution, livestream, sports_choice } =
      req.body;
    if (
      isUndefined(name) ||
      isNotValidString(name) ||
      isUndefined(intro) ||
      isNotValidString(intro) ||
      isUndefined(pricing) ||
      isNotValidInteger(pricing) ||
      isUndefined(max_resolution) ||
      isNotValidInteger(max_resolution) ||
      isUndefined(livestream) ||
      typeof livestream !== "boolean" ||
      isUndefined(sports_choice) ||
      isNotValidInteger(sports_choice)
    ) {
      return next(generateError(400, "欄位未填寫正確"));
    }
    const existingPlan = await planRepo.find({
      where: { name },
    });
    console.log(existingPlan);
    if (existingPlan.length > 0) {
      return next(generateError(409, "方案名稱不可重覆"));
    }
    const newPlan = await planRepo.create({
      name,
      intro,
      pricing,
      max_resolution,
      livestream,
      sports_choice,
    });
    const result = await planRepo.save(newPlan);
    res.status(201).json({
      status: true,
      message: "成功新增資料",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
//新增運動種類，目前沒有畫管理員相應UI的線稿
async function postSportsType(req, res, next) {
  try {
    const { name, activity_location_type } = req.body;
    if (
      isUndefined(name) ||
      isNotValidString(name) ||
      isUndefined(activity_location_type) ||
      isNotValidString(activity_location_type)
    ) {
      return next(generateError(400, "欄位未填寫正確"));
    }
    const existingSports = await skillRepo.find({
      where: { name },
    });
    if (existingSports.length > 0) {
      return next(generateError(409, "運動種類不可重複"));
    }
    const newSportsType = skillRepo.create({
      name,
      activity_location_type,
    });
    const result = await skillRepo.save(newSportsType);
    res.status(201).json({
      status: true,
      message: "成功新增資料",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

//取得教練列表
async function getCoaches(req, res, next) {
  try {
    const coaches = await coachRepo.find({
      relations: ["CoachSkills", "CoachSkills.Skill"], // 加入 CoachSkills 和 Skill 的關聯
    });

    if (!coaches || coaches.length === 0) {
      // 如果找不到教練，回傳 400 錯誤
      return res.status(400).json({
        status: false,
        message: "發生錯誤",
      });
    }  
    
    const formattedCoaches = coaches.map(coach => ({
      id: coach.id,
      name: coach.nickname, // 確認是否需要使用 nickname 或其他欄位作為名字
      email: coach.email,
      category: coach.CoachSkills.map(cs => cs.Skill.name).join(", "), // 將技能名稱組合為逗號分隔的字串
      createdAt: coach.created_at,
    }));
    console.log(coaches[1].CoachSkills);
    
    res.status(200).json({
      status: true,
      message: "成功取得資料",
      data: formattedCoaches, // 回傳格式化後的陣列
    });
  } catch (error) {
    next(error);
  }
}


module.exports = {
  postPlan,
  postSportsType,
  getCoaches,
};
