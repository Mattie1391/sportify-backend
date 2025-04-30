const bcrypt = require('bcrypt');
const { isUndefined, isNotValidString } = require('../utils/validators');
const appError = require('../utils/appError');
const AppDataSource = require('../db/data-source');
const generateJWT = require('../utils/generateJWT');
const config = require('../config/index');


async function postSignup(req, res, next) {
try {
    const { name, nickname, email, password, password_check } = req.body;
    const role = req.path.includes('/coaches') ? 'COACH' : req.path.includes('/users') ? 'USER' : null;
    const passwordPattern = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,16}/;

    if (!role) {
    return next(appError(400, '角色不正確，無法從路徑中判斷角色'));
    }

    const displayName = role === 'USER' ? name : nickname;
    if (isUndefined(displayName) || isNotValidString(displayName) || isUndefined(email) || isNotValidString(email) || isUndefined(password) || isNotValidString(password)) {
    return next(appError(400, '欄位未填寫正確'));
    }

    if (!passwordPattern.test(password)) {
    return next(appError(400, '密碼不符合規則，需要包含英文數字大小寫，最短8個字，最長16個字'));
    }

    if (password !== password_check) {
    return next(appError(400, '密碼確認錯誤'));
    }

    const repository = AppDataSource.getRepository(role === 'USER' ? 'User' : 'Coach');
    const existingUser = await repository.find({ where: { email } });

    if (existingUser.length > 0) {
      return next(appError(409, 'Email 已被使用'));
    }

    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);

    const newUser = repository.create({
    name: role === 'USER' ? displayName : undefined,
    nickname: role === 'COACH' ? displayName : undefined,
    email,
    password: hashPassword,
    role
    });

    const result = await repository.save(newUser);
    res.status(201).json({
    status: true,
    data: {
        user: {
        id: result.id,
        name: displayName
        }
    }
    });
} catch (error) {
    next(error);
}
}

async function postLogin(req, res, next) {
try {
    const { email, password } = req.body;
    const role = req.path.includes('/coaches') ? 'COACH' : req.path.includes('/users') ? 'USER' : null;
    const passwordPattern = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,16}/;

    if (!role) {
    return next(appError(400, '角色不正確，無法從路徑中判斷角色'));
    }

    if (isUndefined(email) || isNotValidString(email) || isUndefined(password) || isNotValidString(password)) {
    return next(appError(400, '欄位未填寫正確'));
    }

    if (!passwordPattern.test(password)) {
    return next(appError(400, '密碼不符合規則，需要包含英文數字大小寫，最短8個字，最長16個字'));
    }

    const repository = AppDataSource.getRepository(role === 'USER' ? 'User' : 'Coach');
    const existingUser = await repository.findOne({
    select: ['id', role === 'USER' ? 'name' : 'nickname', 'password'],
    where: { email }
    });

    if (!existingUser) {
    return next(appError(400, '使用者不存在或密碼輸入錯誤'));
    }

    const isMatch = await bcrypt.compare(password, existingUser.password);
    if (!isMatch) {
    return next(appError(400, '使用者不存在或密碼輸入錯誤'));
    }

    const token = await generateJWT(
    { id: existingUser.id , role: role},
    config.get('secret.jwtSecret'),
    { expiresIn: `${config.get('secret.jwtExpiresDay')}` }
    );

    res.status(200).json({
    status: true,
    data: {
        token,
        user: {
        id: existingUser.id,
        name: role === 'USER' ? existingUser.name : existingUser.nickname
        }
    }
    });
} catch (error) {
    next(error);
}
}


module.exports = {
    postSignup,
    postLogin
};