// SubscriptionSkill.js
const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
  name: "Subscription_Skill",
  tableName: "subscription_skill",

  columns: {
    id: {
      primary: true,
      type: "uuid",
      generated: "uuid",
    },
    subscription_id: {
      type: "uuid",
    },
    skill_id: {
      type: "uuid",
    },
  },

  relations: {
    Subscription: {
      target: "Subscription",
      type: "many-to-one",
      joinColumn: {
        name: "subscription_id",
        referencedColumnName: "id",
        foreignKeyConstraintName: "fk_subscription_skill_subscription_id",
      },
      onDelete: "CASCADE",
    },
    Skill: {
      target: "Skill",
      type: "many-to-one",
      joinColumn: {
        name: "skill_id",
        referencedColumnName: "id",
        foreignKeyConstraintName: "fk_subscription_skill_skill_id",
      },
      onDelete: "CASCADE",
    },
  },
});
