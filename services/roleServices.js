// src/services/findRole.js
const AppDataSource = require("../db/data-source");
const User = require("../entities/User");
const Coach = require("../entities/Coach");
const Admin = require("../entities/Admin");

const findRoleAndRepoByEmail = async (email) => {
  const userRepo = AppDataSource.getRepository(User);
  const coachRepo = AppDataSource.getRepository(Coach);
  const adminRepo = AppDataSource.getRepository(Admin);

  const user = await userRepo.findOne({ where: { email } });
  if (user) {
    return { role: "USER", repo: userRepo };
  }

  const coach = await coachRepo.findOne({ where: { email } });
  if (coach) {
    return { role: "COACH", repo: coachRepo };
  }

  const admin = await adminRepo.findOne({ where: { email } });
  if (admin) {
    return { role: "ADMIN", repo: adminRepo };
  }

  return null;
}

const findRepoByRole = async (role) => {
  switch (role) {
    case "USER":
      return AppDataSource.getRepository(User);
    case "COACH":
      return AppDataSource.getRepository(Coach);
    case "ADMIN":
      return AppDataSource.getRepository(Admin);
    default:
      return null;
  }
};

module.exports = {
    findRoleAndRepoByEmail,
    findRepoByRole,
};
