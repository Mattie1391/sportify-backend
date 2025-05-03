const AppDataSource = require("../db/data-source");
const userRepo = AppDataSource.getRepository("User");
const {
	isUndefined,
	isNotValidString,
	isNotValidUUID,
	isNotValidUrl,
} = require("../utils/validators");
const generateError = require("../utils/generateError");
const bcrypt = require("bcrypt");

//取得使用者資料
async function getProfile(req, res, next) {
	try {
		const userId = req.params.userId;
		if (
			!userId ||
			isNotValidString(userId) ||
			userId.length === 0 ||
			isNotValidUUID(userId)
		) {
			return next(generateError(400, "使用者 ID 格式不正確"));
		}
		const user = await userRepo.findOneBy({ id: userId });
		if (!user) {
			return next(generateError(404, "使用者不存在"));
		}

		//檢查頭貼網址是否正確，不正確則設為null
		if (
			!user.profile_image_url ||
			typeof user.profile_image_url !== "string" ||
			isNotValidUrl(user.profile_image_url)
		) {
			user.profile_image_url = null;
		}
		const userData = {
			id: user.id,
			name: user.name,
			email: user.email,
			profile_image_url: user.profile_image_url,
		};
		res
			.status(200)
			.json({ status: true, message: "成功取得資料", data: userData });
	} catch (error) {
		next(error);
	}
}

//修改使用者資料
async function patchProfile(req, res, next) {
	try {
		const userId = req.params.userId;
		if (
			!userId ||
			isNotValidString(userId) ||
			userId.length === 0 ||
			isNotValidUUID(userId)
		)
			return next(generateError(400, "使用者 ID 格式不正確"));
		// email/id 無法修改,前端email欄位同步寫死，不能輸入
		const {
			name,
			profile_image_url,
			oldPassword,
			newPassword,
			newPassword_check,
		} = req.body;

		if (!name || isUndefined(name) || isNotValidString(name)) {
			return next(generateError(400, "欄位未填寫正確"));
		}
		if (name.length < 2 || name.length > 20) {
			return next(generateError(400, "用戶名長度需為 2~20 字"));
		}
		//檢查頭貼網址是否正確
		if (
			!profile_image_url ||
			typeof profile_image_url !== "string" ||
			isNotValidUrl(profile_image_url)
		) {
			return next(generateError(400, "頭貼網址格式不正確"));
		}

		// 密碼規則：至少8個字元，最多16個字元，至少一個數字，一個小寫字母和一個大寫字母
		const passwordPattern = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,16}/;
		if (!passwordPattern.test(newPassword)) {
			return next(
				generateError(
					400,
					"密碼不符合規則，需要包含英文數字大小寫，最短8個字，最長16個字"
				)
			);
		}
		if (newPassword === oldPassword) {
			return next(generateError(409, "新密碼不可與舊密碼相同"));
		}
		if (newPassword !== newPassword_check) {
			return next(generateError(400, "密碼確認錯誤"));
		}

		const user = await userRepo.findOneBy({ id: userId });

		//檢查舊密碼是否正確 (使用 bcrypt.compare比對加密後的密碼)
		const isMatch = await bcrypt.compare(oldPassword, user.password);
		if (!isMatch) {
			return next(generateError(400, "舊密碼錯誤"));
		}

		//替換原本資料
		user.name = name;
		user.profile_image_url = profile_image_url;
		user.password = await bcrypt.hash(newPassword, 10);
		await userRepo.save(user);

		const userData = {
			id: user.id,
			name: user.name,
			email: user.email,
			profile_image_url: user.profile_image_url,
			updated_at: user.updated_at,
		};
		res.status(200).json({ message: "成功更新資料", data: userData });
	} catch (error) {
		next(error);
	}
}

module.exports = {
	getProfile,
	patchProfile,
};
