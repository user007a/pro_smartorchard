/**
 * 通用 CRUD 路由
 * --------------------------------------------------------------
 * 为 131 张同构业务表提供统一 REST 接口，替代原型中的 localStorage 读写。
 *
 * 接口规范：
 *   GET    /api/:resource           列表（分页 / 搜索 / 排序 / 筛选）
 *   GET    /api/:resource/:id       详情
 *   POST   /api/:resource           新增（单条或批量）
 *   PUT    /api/:resource/:id       更新
 *   DELETE /api/:resource/:id       逻辑删除（置 is_deleted=1）
 *
 * 查询参数（列表接口）：
 *   page    页码（从 1 开始，默认 1）
 *   size    每页条数（默认 20，最大 500）
 *   keyword 关键词（对字符串字段模糊匹配）
 *   sort    排序字段
 *   order   asc/desc
 *   <field> 任意字段精确筛选（如 ?status=active&base_id=3）
 *   fields  只返回指定字段（逗号分隔）
 */
const express = require('express');
const { query, execute } = require('../config/db');
const {
  resolveTable,
  isWritableField,
  isReadableField,
  READONLY_RESOURCES,
} = require('../resources');
const { getColumns: getTableColumns, hasSoftDelete } = require('../utils/table-meta');

const router = express.Router();

/**
 * 从请求体中过滤出可写字段，返回 { columns, values, placeholders }
 */
function buildInsert(table, body) {
  const columns = [];
  const values = [];
  const placeholders = [];
  for (const [key, value] of Object.entries(body)) {
    if (!isWritableField(table, key)) continue;
    columns.push('`' + key + '`');
    values.push(value === undefined ? null : value);
    placeholders.push('?');
  }
  return { columns, values, placeholders };
}

function buildUpdate(table, body) {
  const sets = [];
  const values = [];
  for (const [key, value] of Object.entries(body)) {
    if (!isWritableField(table, key)) continue;
    sets.push('`' + key + '` = ?');
    values.push(value === undefined ? null : value);
  }
  return { sets, values };
}

// ---------- 列表 ----------
router.get('/:resource', async (req, res, next) => {
  try {
    const table = resolveTable(req.params.resource);
    if (!table) return res.status(404).json({ ok: false, message: '资源不存在' });

    const allCols = await getTableColumns(table);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const size = Math.min(500, Math.max(1, parseInt(req.query.size, 10) || 20));
    const offset = (page - 1) * size;

    // 默认过滤逻辑删除；表若无 is_deleted 列（追加型子表）则不过滤
    const where = [];
    const params = [];
    if (await hasSoftDelete(table)) where.push('`is_deleted` = 0');

    // 关键词搜索：对字符串字段做模糊匹配
    if (req.query.keyword) {
      const kw = '%' + req.query.keyword + '%';
      const likeCols = allCols.filter(
        (c) => !['id', 'is_deleted'].includes(c) && !['password'].includes(c)
      );
      if (likeCols.length) {
        const clauses = likeCols.map((c) => '`' + c + '` LIKE ?');
        where.push('(' + clauses.join(' OR ') + ')');
        likeCols.forEach(() => params.push(kw));
      }
    }

    // 其他查询参数作为精确筛选（只接受表中存在的字段，且排除分页/排序保留字）
    const reserved = new Set(['page', 'size', 'keyword', 'sort', 'order', 'fields']);
    for (const [key, value] of Object.entries(req.query)) {
      if (reserved.has(key)) continue;
      if (!allCols.includes(key)) continue;
      if (!isReadableField(table, key)) continue;
      where.push('`' + key + '` = ?');
      params.push(value);
    }

    const whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';

    // 排序
    let orderSql = '';
    if (req.query.sort && allCols.includes(req.query.sort)) {
      const dir = String(req.query.order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
      orderSql = ' ORDER BY `' + req.query.sort + '` ' + dir;
    } else {
      orderSql = ' ORDER BY `id` DESC';
    }

    // 字段白名单（可选）
    let selectCols = allCols.filter((c) => isReadableField(table, c));
    if (req.query.fields) {
      const requested = String(req.query.fields).split(',').filter((f) => allCols.includes(f));
      if (requested.length) selectCols = requested.filter((c) => isReadableField(table, c));
    }
    const selectSql = selectCols.map((c) => '`' + c + '`').join(', ');

    const totalRows = await query('SELECT COUNT(*) AS cnt FROM `' + table + '`' + whereSql, params);
    const total = totalRows[0].cnt;

    const list = await query(
      'SELECT ' + selectSql + ' FROM `' + table + '`' + whereSql + orderSql + ' LIMIT ? OFFSET ?',
      [...params, size, offset]
    );

    res.json({ ok: true, data: { list, total, page, size } });
  } catch (e) {
    next(e);
  }
});

// ---------- 详情 ----------
router.get('/:resource/:id', async (req, res, next) => {
  try {
    const table = resolveTable(req.params.resource);
    if (!table) return res.status(404).json({ ok: false, message: '资源不存在' });

    const allCols = await getTableColumns(table);
    const selectCols = allCols.filter((c) => isReadableField(table, c));
    const selectSql = selectCols.map((c) => '`' + c + '`').join(', ');

    const rows = await query(
      'SELECT ' + selectSql + ' FROM `' + table + '` WHERE `id` = ?' +
        (await hasSoftDelete(table) ? ' AND `is_deleted` = 0' : ''),
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ ok: false, message: '记录不存在' });
    res.json({ ok: true, data: rows[0] });
  } catch (e) {
    next(e);
  }
});

// ---------- 新增 ----------
router.post('/:resource', async (req, res, next) => {
  try {
    const table = resolveTable(req.params.resource);
    if (!table) return res.status(404).json({ ok: false, message: '资源不存在' });
    if (READONLY_RESOURCES.has(req.params.resource)) {
      return res.status(403).json({ ok: false, message: '该资源只读' });
    }

    const body = req.body;
    const list = Array.isArray(body) ? body : [body];
    if (!list.length) return res.status(400).json({ ok: false, message: '请求体为空' });

    // 批量插入（每条生成各自的列，但列名需一致，取第一条为基准）
    const first = list[0];
    const { columns, values: firstValues, placeholders } = buildInsert(table, first);
    if (!columns.length) {
      return res.status(400).json({ ok: false, message: '无可写字段' });
    }

    // 统一校验所有条目的字段一致
    const rowsToInsert = [];
    for (const item of list) {
      const vals = [];
      for (const col of columns) {
        const rawCol = col.replace(/`/g, '');
        vals.push(item[rawCol] === undefined ? null : item[rawCol]);
      }
      rowsToInsert.push(vals);
    }

    const colSql = columns.join(', ');
    const placeholdersSql = list
      .map(() => '(' + placeholders.join(', ') + ')')
      .join(', ');
    const flatValues = rowsToInsert.flat();

    const result = await execute(
      'INSERT INTO `' + table + '` (' + colSql + ') VALUES ' + placeholdersSql,
      flatValues
    );

    res.status(201).json({ ok: true, data: { insertId: result.insertId, affectedRows: result.affectedRows } });
  } catch (e) {
    next(e);
  }
});

// ---------- 更新 ----------
router.put('/:resource/:id', async (req, res, next) => {
  try {
    const table = resolveTable(req.params.resource);
    if (!table) return res.status(404).json({ ok: false, message: '资源不存在' });
    if (READONLY_RESOURCES.has(req.params.resource)) {
      return res.status(403).json({ ok: false, message: '该资源只读' });
    }

    const { sets, values } = buildUpdate(table, req.body);
    if (!sets.length) return res.status(400).json({ ok: false, message: '无可更新字段' });

    values.push(req.params.id);
    const result = await execute(
      'UPDATE `' + table + '` SET ' + sets.join(', ') + ' WHERE `id` = ?' +
        (await hasSoftDelete(table) ? ' AND `is_deleted` = 0' : ''),
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: '记录不存在或未变更' });
    }
    res.json({ ok: true, data: { affectedRows: result.affectedRows } });
  } catch (e) {
    next(e);
  }
});

// ---------- 逻辑删除 ----------
router.delete('/:resource/:id', async (req, res, next) => {
  try {
    const table = resolveTable(req.params.resource);
    if (!table) return res.status(404).json({ ok: false, message: '资源不存在' });
    if (READONLY_RESOURCES.has(req.params.resource)) {
      return res.status(403).json({ ok: false, message: '该资源只读' });
    }

    // 逻辑删除是铁律：无 is_deleted 列的表（追加型子表）不允许删除
    if (!(await hasSoftDelete(table))) {
      return res.status(400).json({ ok: false, message: '该表不支持删除（无逻辑删除字段）' });
    }

    const result = await execute(
      'UPDATE `' + table + '` SET `is_deleted` = 1 WHERE `id` = ? AND `is_deleted` = 0',
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, message: '记录不存在或已删除' });
    }
    res.json({ ok: true, data: { affectedRows: result.affectedRows } });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
