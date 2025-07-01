const OpenAI = require("openai");
const AppDataSource = require("../db/data-source");
const courseRepo = AppDataSource.getRepository("Course");
const planRepo = AppDataSource.getRepository("Plan");
const config = require("../config/index");
const apiKey = config.get("chat.apiKey");

const openai = new OpenAI({
  apiKey: apiKey,
});

/**
 * 處理 /api/chat 的 POST 請求
 */
async function chatWithGPT(req, res) {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "請提供訊息內容" });
    }

    // 取得課程與教練資訊
    const courseInfo = await courseRepo
    .createQueryBuilder("course")
    .leftJoinAndSelect("course.Skill", "skill")
    .leftJoinAndSelect("course.Coach", "coach")
    .select([
      "course.name AS course_name",
      "skill.name AS skill_name",
      "coach.nickname AS coach_nickname",
    ])
    .getRawMany();

    const courseInfoText = courseInfo.map((row, i) => {
      const courseName = row.course_name || "無資料";
      const skillName = row.skill_name || "無資料";
      const coachName = row.coach_nickname || "無資料";
      return `${i + 1}. 課程名稱：${courseName}｜課程類別：${skillName}｜教練：${coachName}`;
      }).join('\n');

    // 取得訂閱方案資訊
   const planInfo = await planRepo
      .createQueryBuilder("plan")
      .select([
        "plan.name AS plan_name",
        "plan.pricing AS plan_pricing",
        "plan.intro AS plan_intro",
        "plan.max_resolution AS plan_max_resolution",
      ])
      .getRawMany();

    planInfoText = planInfo.map((row, i) => {
      const planName = row.plan_name || "無資料";
      const planPricing = row.plan_pricing || "無資料";
      const planIntro = row.plan_intro || "無資料";
      const maxResolution = row.plan_max_resolution || "無資料";
      return `${i + 1}. 訂閱方案名稱：${planName}｜價格：${planPricing}｜簡介：${planIntro}｜最大解析度：${maxResolution}`;
    }).join('\n');
  
    const response = await openai.chat.completions.create({
      model: "gpt-4o", 
      messages: [
        {
          role: "system",
          content:
            `你是 SPORTIFY+ 的智慧客服助手，SPORTIFY+是一個訂閱制運動教學串流平台，提供用戶觀看線上運動教學影片，也可以評價課程，如果你是一個專業教練，我們平台也提供教練上傳影片開課，只要點選“我要開課”並通過資格審核就可以成為教練！請參考下面資訊回答用戶問題：\n${planInfoText}\n${courseInfoText}\n如果用戶問題與我們平台或是運動方面不相關則婉轉拒絕回答 `,
        },
        {
          role: "user",
          content: `使用者問：「${message}」。`
        },
      ],
      temperature: 0.7,
    });

    const reply = response.choices[0].message.content;

    res.json({ reply });
  } catch (error) {
    console.error("GPT 錯誤：", error);
    res.status(500).json({ error: "伺服器錯誤，請稍後再試" });
  }
}

module.exports = {
  chatWithGPT,
};
