"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const postgres_1 = __importDefault(require("postgres"));
const sql = (0, postgres_1.default)(process.env.DATABASE_URL, {
    ssl: "require",
    max: 10,
    idle_timeout: 20,
    connect_timeout: 30,
});
exports.default = sql;
