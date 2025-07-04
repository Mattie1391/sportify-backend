//排程在每月最初計算分潤池，然後分配給每位教練多少額度

const AppDataSource = require("../db/data-source");
const coachRepo = AppDataSource.getRepository("Coach");
const paymentTransferRepo = AppDataSource.getRepository("Payment_Transfer");
const subscriptionRepo = AppDataSource.getRepository("Subscription");

//模組
const dayjs = require("dayjs");
const cron = require("node-cron"); //導入cron，純javascript的排程工具
const logger = require("../config/logger");

// 設定每日排程，當月1日(utc+8)早上0點30分開始，從左到右每個*對應分、時、日...
function scheduleShareProfit() {
  cron.schedule("30 8 1 * *", async () => {
    await updateCoachShareProfit();
  });
}

async function updateCoachShareProfit() {
  try {
    //取得上個月的日期區間
    const lastMonth = dayjs().month() - 1;
    const monthBegin = dayjs().set("month", lastMonth).startOf("month").toDate();
    const monthEnd = dayjs(monthBegin).endOf("month").toDate();

    //加總、計算上個月的收益教練分潤池，預設70%分潤

    const lastMonthIncome = await subscriptionRepo
      .createQueryBuilder("s")
      .select(["SUM(s.price) AS income"])
      .where("s.is_paid = :is_paid", { is_paid: true })
      .andWhere("s.purchased_at BETWEEN :monthBegin AND :monthEnd", { monthBegin, monthEnd })
      .getRawOne();

    if (lastMonthIncome.length === 0) {
      //避免無收益導致計算錯誤，直接終止運行
      logger.info("上月分無可分配收益");
      return;
    }

    //由於分潤四捨五入可能造成金額誤差，這邊採取差額一率從平台收益做加減平衡，也就是平台收益等於減去所有教練分潤後的剩餘金額。
    const incomeTotal = lastMonthIncome.income;
    const coachShareRate = 0.7;

    //取得有人觀看其影片的教練列表及其觀看時長

    let ableToShareCoaches = await coachRepo
      .createQueryBuilder("coach")
      .leftJoin("coach.Course", "course")
      .leftJoin("course.ViewStat", "vs")
      .select(["coach.id AS coach_id", "SUM(vs.total_playing_time) AS total_playing_time"])
      .where("vs.date BETWEEN :monthBegin AND :monthEnd", { monthBegin, monthEnd })
      .groupBy("coach.id")
      .getRawMany();

    if (ableToShareCoaches.length === 0) {
      //若無教練滿足可分潤條件，就終止運行
      return;
    }

    //計算每位教練的觀看次數占比

    const sumOfPlayingTime = ableToShareCoaches.reduce((acc, current) => {
      return acc + parseInt(current.total_playing_time);
    }, 0);
    if (isNaN(sumOfPlayingTime)) {
      //若非可轉變為數字的字串導致加總是NaN，直接停止並回報錯誤
      logger.warn("[ShareProfit] 觀看時數加總有誤，摻入了非數值導致計算為NaN。直接終止計算");
      return;
    }
    ableToShareCoaches.map((coach) => {
      coach.shareProportion = coach.total_playing_time / sumOfPlayingTime;
    });
    //將分潤池金額依比例分配給每位教練
    ableToShareCoaches.map((coach) => {
      coach.amount = Math.floor(incomeTotal * coachShareRate * coach.shareProportion);
    });

    //加總教練分潤總額，並計算減去後做為平台抽成的金額
    const coachProfitPool = ableToShareCoaches.reduce((acc, current) => {
      return acc + parseInt(current.amount);
    }, 0);
    const platformShare = incomeTotal - coachProfitPool;
    logger.info(`[ShareProfit] 平台 ${lastMonth + 1} 月份抽成總額為NTD ${platformShare}元`);

    //將分潤更新到payment transfer資料表，標示為未匯款狀態
    for (const coachShareDetail of ableToShareCoaches) {
      coachShareDetail.is_transfered = false;
      coachShareDetail.month = `${dayjs().year()}-${lastMonth + 1}`;
      await paymentTransferRepo.save(coachShareDetail);
    }
  } catch (error) {
    console.error(error);
  }
}

module.exports = { scheduleShareProfit, updateCoachShareProfit };
