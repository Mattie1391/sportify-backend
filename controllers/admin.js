const AppDataSource = require("../db/data-source");
const planRepo = AppDataSource.getRepository("Plan");
const generateError = require("../utils/generateError");
const {
  isUndefined,
  isNotValidString,
  isNotValidInteger,
  isNotValidUUID,
  isNotValidUrl,
} = require("../utils/validators");

//新增訂閱方案，目前管理員沒有相應UI
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
    if (existingPlan) {
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

module.exports = {
  postPlan,
};
