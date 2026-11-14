/**
 * 移动端运营模块聚合读写接口
 * --------------------------------------------------------------
 * 保存策略（V7 修复）：「按业务键 upsert + 显式逻辑删除」（utils/aggregate-sync），
 * 取代旧的「整表 DELETE + 重灌」，保留物理 id / created_at 与未映射列，删除改逻辑删除。
 * 删除由前端 deleted 载荷显式声明，不做「快照缺失即删」（严格模式内存镜像可能不全，会误删）。
 * 表（10 张）见 TABLES；键见 KEY_COLUMN：
 *   staff 用唯一账号 account；aiCategories/aiQuestions/diseaseRules/faultKb 为原始行透传，
 *   按物理 id；feedbacks/expertQuestions/messages/news/syncQueue 无业务编号列，
 *   由 mapper 以 _dbId 回传物理 id 匹配。
 */
const express = require('express');
const { query } = require('../config/db');
const { hasSoftDelete } = require('../utils/table-meta');
const { syncTable, applyDeletes } = require('../utils/aggregate-sync');

const router = express.Router();

async function fetchAll(table) {
  const where = (await hasSoftDelete(table)) ? ' WHERE `is_deleted` = 0' : '';
  return query('SELECT * FROM `' + table + '`' + where + ' ORDER BY `id` ASC');
}

const TABLES = {
  feedbacks: 'sf_mb_feedback',
  expertQuestions: 'sf_mb_expert_consult',
  staff: 'sf_mb_staff_account',
  messages: 'sf_mb_message',
  news: 'sf_mb_news',
  syncQueue: 'sf_mb_sync_queue',
  aiCategories: 'sf_mb_ai_category',
  aiQuestions: 'sf_mb_ai_question',
  diseaseRules: 'sf_mb_disease_rule',
  faultKb: 'sf_mb_fault_kb',
};

const KEY_COLUMN = {
  feedbacks: null,
  expertQuestions: null,
  staff: ['account'],
  messages: null,
  news: null,
  syncQueue: null,
  aiCategories: null,
  aiQuestions: null,
  diseaseRules: null,
  faultKb: null,
};

router.get('/aggregate', async (req, res, next) => {
  try {
    const results = {};
    await Promise.all(Object.keys(TABLES).map(async (key) => {
      results[key] = await fetchAll(TABLES[key]);
    }));
    res.json({ ok: true, data: results });
  } catch (e) { next(e); }
});

router.post('/aggregate', async (req, res, next) => {
  const body = req.body || {};
  const deleted = body.deleted || {};
  try {
    const summary = {};
    for (const [key, table] of Object.entries(TABLES)) {
      let upserted = 0, del = 0;
      if (Array.isArray(body[key])) upserted = (await syncTable(table, KEY_COLUMN[key], body[key])).upserted;
      if (Array.isArray(deleted[key])) del = await applyDeletes(table, KEY_COLUMN[key], deleted[key]);
      if (upserted || del) summary[key] = { upserted, deleted: del };
    }
    res.json({ ok: true, data: { summary } });
  } catch (e) { next(e); }
});

module.exports = router;