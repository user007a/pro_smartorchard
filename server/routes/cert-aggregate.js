/**
 * 证书模块聚合读写接口
 * --------------------------------------------------------------
 * 支撑前端 CertStore 的「策略 A 出入口映射」：store 聚合对象 ↔ sf_cert 表。
 *
 *   GET  /api/cert/aggregate   一次性拉取证书台账全部数据（load 用）
 *   POST /api/cert/aggregate   批量保存（按 cert_no 唯一键 upsert / 删除，save 用）
 *
 * 覆盖表（1 张）：
 *   主表： sf_cert（证书台账，含企业资质 + 批次凭证两类）
 *
 * 说明：
 *   - sf_enterprise_cert（企业资质旧表）为冗余表，本接口不接管，
 *     证书权威数据源统一收敛到 sf_cert，避免「一张表被两个聚合接口重复写」。
 *   - 派生字段（computeStatus() 的「即将到期/已过期」展示状态）不入库，
 *     仅落库人工状态 status（draft/pending/active/revoked）。
 *   - auditLogs（审计日志数组）本轮不入库，后续由全局 sf_operation_log 统一承载。
 *
 * 设计约定（与 device/enterprise-aggregate 一致）：
 *   - store 字段（camelCase）↔ 表字段（snake_case），映射由前端负责，后端只透传表行；
 *   - 主键语义：store item.id（CERT-Q001/CERT-B001）仅作前端标识，
 *     落库以 cert_no（唯一键 uk_cert_no）为准 upsert。
 */
const express = require('express');
const { query, execute } = require('../config/db');
const { hasSoftDelete, softDeleteByCode } = require('../utils/table-meta');

const router = express.Router();

/* ---------- 工具 ---------- */

/** 空值归一：空字符串 → null（避免 DATE 列报错） */
function norm(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  return v;
}

/** 从对象中剔除系统托管字段，返回可写数据 */
function cleanRow(row) {
  const data = { ...row };
  delete data.id;
  delete data.created_at;
  delete data.updated_at;
  delete data.is_deleted;
  return data;
}

/* ---------- GET：聚合读取 ---------- */

router.get('/aggregate', async (req, res, next) => {
  try {
    const where = (await hasSoftDelete('sf_cert')) ? ' WHERE `is_deleted` = 0' : '';
    const certs = await query(
      'SELECT * FROM `sf_cert`' + where + ' ORDER BY `id` ASC'
    );

    res.json({
      ok: true,
      data: {
        certs,
      },
    });
  } catch (e) {
    next(e);
  }
});

/* ---------- POST：聚合保存 ---------- */

/**
 * 请求体结构（字段已由前端映射成 snake_case 表行）：
 * {
 *   certs:   [{ ...sf_cert 表行, _cert_no }],   // 全量证书（含企业资质 + 批次凭证）
 *   deleted: { certs: [...cert_no] }
 * }
 */
router.post('/aggregate', async (req, res, next) => {
  const body = req.body || {};
  try {
    const summary = {};

    summary.certs = await upsertByCertNo('sf_cert', body.certs);

    const deleted = body.deleted || {};
    summary.deleted = await applyDeletes(deleted);

    res.json({ ok: true, data: { summary } });
  } catch (e) {
    next(e);
  }
});

/** 按 cert_no 唯一键 upsert：cert_no 存在则更新，否则插入 */
async function upsertByCertNo(table, rows) {
  if (!Array.isArray(rows) || !rows.length) return 0;
  let n = 0;
  for (const row of rows) {
    const certNo = norm(row.cert_no);
    if (!certNo) continue;
    const data = cleanRow(row);
    delete data.cert_no; // cert_no 是唯一键，不进 UPDATE SET
    const existing = await query(
      'SELECT `id` FROM `' + table + '` WHERE `cert_no` = ? LIMIT 1', [certNo]
    );
    if (existing.length) {
      const id = existing[0].id;
      const sets = [];
      const vals = [];
      for (const [k, v] of Object.entries(data)) {
        sets.push('`' + k + '` = ?');
        vals.push(norm(v));
      }
      if (await hasSoftDelete(table)) {
        sets.push('`is_deleted` = ?');
        vals.push(0);
      }
      if (sets.length) {
        await execute('UPDATE `' + table + '` SET ' + sets.join(', ') + ' WHERE `id` = ?', [...vals, id]);
        n++;
      }
    } else {
      const keys = Object.keys(data);
      if (keys.length) {
        await execute(
          'INSERT INTO `' + table + '` (' + keys.map((c) => '`' + c + '`').join(', ') + ', `cert_no`) VALUES (' +
            keys.map(() => '?').join(', ') + ', ?)',
          [...keys.map((c) => norm(data[c])), certNo]
        );
        n++;
      }
    }
  }
  return n;
}

/** 逻辑删除（按 cert_no 软删） */
async function applyDeletes(deleted) {
  let n = 0;
  const certNos = deleted.certs;
  if (Array.isArray(certNos) && certNos.length) {
    n += await softDeleteByCode('sf_cert', 'cert_no', certNos);
  }
  return n;
}

module.exports = router;
