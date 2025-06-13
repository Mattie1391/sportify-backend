//去掉字串前後空白的工具。適用於post、patch、put方法，對req.body使用

function trimStringFields(obj) {
  if (typeof obj !== "object" || obj === null) return;

  for (const key in obj) {
    const value = obj[key];

    if (typeof value === "string") {
      obj[key] = obj[key].trim();
    } else if (Array.isArray(value)) {
      value.forEach((item) => trimStringFields(item));
    } else if (typeof value === "object") {
      trimStringFields(value);
    }
  }
}
const strTrimmer = (req, res, next) => {
  if (req.body && typeof req.body === "object") {
    trimStringFields(req.body);
  }
  next();
};

module.exports = strTrimmer;
