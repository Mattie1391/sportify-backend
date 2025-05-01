const generateError = (status, errMessage, next) => {
    const error = new Error(errMessage || "驗證出現錯誤");
    error.status = status;
    return error;
}

module.exports = generateError;