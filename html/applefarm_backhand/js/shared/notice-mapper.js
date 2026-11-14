/**
 * notice-mapper.js — 系统通知模块「notices ↔ sf_system_notice」映射层
 */
(function (global) {
  'use strict';

  function dstr(v) { return v ? String(v).replace('T', ' ').slice(0, 19) : ''; }

  function rowToNotice(row) {
    return {
      id: row.notice_code || String(row.id),
      code: row.notice_code || '',
      title: row.title || '',
      content: row.content || '',
      type: row.notice_type || '',
      status: row.notice_status || 'active',
      createdAt: dstr(row.created_at),
      updatedAt: dstr(row.updated_at),
    };
  }
  function noticeToRow(item) {
    return {
      notice_code: item.code || item.id,
      title: item.title,
      content: item.content || null,
      notice_type: item.type || null,
      notice_status: item.status || 'active',
    };
  }

  function toAggregate(data) { return { notices: (data.notices || []).map(rowToNotice) }; }
  function fromAggregate(agg) { return { notices: (agg.notices || []).map(noticeToRow), deleted: agg.deleted || {} }; }

  global.NoticeMapper = { toAggregate: toAggregate, fromAggregate: fromAggregate };
})(window);