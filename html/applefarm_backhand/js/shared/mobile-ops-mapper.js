/**
 * mobile-ops-mapper.js — 移动端运营模块「子集合 ↔ sf_mb_* 表」映射层
 * --------------------------------------------------------------
 * 入库：feedbacks/expertQuestions/staff/messages/news/syncQueue
 *      + aiConfig(categories/hotQuestions) + diseaseRules/faultKb
 * 不入库：audit（操作审计，无权威表）
 */
(function (global) {
  'use strict';

  function num(v, def) { var n = parseFloat(v); return isNaN(n) ? (def === undefined ? 0 : def) : n; }
  function nval(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }
  function dstr(v) { return v ? String(v).replace('T', ' ').slice(0, 19) : ''; }
  /* 写库 datetime 统一为 'YYYY-MM-DD HH:MM:SS'（MySQL STRICT 拒绝 ISO 的 'T'/'Z'） */
  function sqlDt(v) {
    if (!v) return null;
    var d = (v instanceof Date) ? v : new Date(v);
    if (isNaN(d.getTime())) return null;
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  function b2i(v) { return v ? 1 : 0; }
  function i2b(v) { return v === 1 || v === '1' || v === true; }

  /* ---------- 反馈 ---------- */
  function rowToFeedback(row) {
    return {
      id: String(row.id), title: row.title, content: row.content, feedbackType: row.feedback_type, source: row.source,
      submitter: row.submitter, submitTime: dstr(row.submit_time), status: row.status, conclusion: row.conclusion,
      reply: row.reply || '', rejectReason: row.reject_reason || '', operator: row.operator || '',
      operatorId: row.operator_id || '', contact: row.contact || '', reviewTime: dstr(row.review_time),
    };
  }
  function feedbackToRow(item) {
    return {
      _dbId: item.id,
      title: item.title, content: item.content, feedback_type: item.feedbackType, source: item.source,
      submitter: item.submitter, submit_time: sqlDt(item.submitTime), status: item.status,
      conclusion: item.conclusion || null, reply: item.reply || null, reject_reason: item.rejectReason || null,
      operator: item.operator || null, operator_id: item.operatorId || null, contact: item.contact || null,
      review_time: sqlDt(item.reviewTime),
    };
  }

  /* ---------- 专家咨询 ---------- */
  function rowToQuestion(row) {
    return {
      id: String(row.id), title: row.title, content: row.content, questioner: row.questioner, questionTime: dstr(row.question_time),
      expertId: row.expert_id ? String(row.expert_id) : '', expertReply: row.expert_reply || '', status: row.status,
      source: row.source || '', operator: row.operator || '', replyTime: dstr(row.reply_time),
    };
  }
  function questionToRow(item) {
    return {
      _dbId: item.id,
      title: item.title, content: item.content, questioner: item.questioner, question_time: sqlDt(item.questionTime),
      expert_reply: item.expertReply || null, status: item.status, source: item.source || null,
      operator: item.operator || null, reply_time: sqlDt(item.replyTime),
    };
  }

  /* ---------- 员工 ---------- */
  function rowToStaff(row) {
    return {
      id: row.account, account: row.account, password: row.password || '', pwdHash: row.password || '',
      realName: row.real_name || '', phone: row.phone || '', role: row.role || '果农',
      baseId: row.base_id ? String(row.base_id) : '', isExpert: i2b(row.is_expert), expertise: row.expertise || '',
      status: row.status || 'active',
    };
  }
  function staffToRow(item) {
    return {
      account: item.account, password: item.pwdHash || item.password || null, real_name: item.realName || null,
      phone: item.phone || null, role: item.role || '果农',
      base_id: item.baseId != null && item.baseId !== '' ? Number(item.baseId) : null,
      is_expert: b2i(item.isExpert),
      expertise: item.expertise || null, status: item.status || 'active',
    };
  }

  /* ---------- 消息 ---------- */
  function rowToMessage(row) {
    return {
      id: String(row.id), title: row.title, content: row.content, category: row.category, target: row.target,
      publisher: row.publisher, publishTime: dstr(row.publish_time), enabled: row.status === 'active',
      source: row.source || '', status: row.status,
    };
  }
  function messageToRow(item) {
    return {
      _dbId: item.id,
      title: item.title, content: item.content, category: item.category, target: item.target || 'mobile',
      publisher: item.publisher || '系统管理员', publish_time: sqlDt(item.publishTime),
      status: item.enabled === false ? 'inactive' : 'active', source: item.source || null,
    };
  }

  /* ---------- 资讯 ---------- */
  function rowToNews(row) {
    return {
      id: String(row.id), category: row.category, title: row.title, summary: row.summary || '', content: row.content,
      /* 封面存 sf_mb_news.cover_file_id（铁律 4：图片存 file_id） */
      cover: row.cover_file_id != null ? String(row.cover_file_id) : '',
      author: row.author || '', source: row.source || '', publishTime: dstr(row.publish_time),
      publisher: row.publisher || '', status: row.status, top: i2b(row.is_top), viewCount: num(row.read_count),
    };
  }
  function newsToRow(item) {
    return {
      _dbId: item.id,
      category: item.category, title: item.title, summary: item.summary || null, content: item.content,
      cover_file_id: item.cover != null && item.cover !== '' ? Number(item.cover) : null,
      author: item.author || null, source: item.source || null, read_count: nval(item.viewCount),
      publisher: item.publisher || null, publish_time: sqlDt(item.publishTime), is_top: b2i(item.top),
      status: item.status || 'published',
    };
  }

  /* ---------- 同步队列 ---------- */
  function rowToSync(row) {
    return {
      id: String(row.id), syncType: row.sync_type, recordId: row.record_id, payload: row.payload || '',
      enqueueTime: dstr(row.enqueue_time), status: row.status, retry: num(row.retry), queuedAt: dstr(row.enqueue_time),
    };
  }
  function syncToRow(item) {
    return {
      _dbId: item.id,
      sync_type: item.syncType, record_id: item.recordId, payload: item.payload || null,
      enqueue_time: sqlDt(item.enqueueTime || item.queuedAt), status: item.status, retry: nval(item.retry),
    };
  }

  /* ---------- 聚合 ---------- */
  function toAggregate(data) {
    var ai = data.aiConfig || {};
    return {
      feedbacks: (data.feedbacks || []).map(rowToFeedback),
      expertQuestions: (data.expertQuestions || []).map(rowToQuestion),
      staff: (data.staff || []).map(rowToStaff),
      messages: (data.messages || []).map(rowToMessage),
      news: (data.news || []).map(rowToNews),
      syncQueue: (data.syncQueue || []).map(rowToSync),
      aiCategories: (data.aiCategories || []),
      aiQuestions: (data.aiQuestions || []),
      diseaseRules: (data.diseaseRules || []),
      faultKb: (data.faultKb || []),
    };
  }

  function fromAggregate(agg) {
    return {
      feedbacks: (agg.feedbacks || []).map(feedbackToRow),
      expertQuestions: (agg.expertQuestions || []).map(questionToRow),
      staff: (agg.staff || []).map(staffToRow),
      messages: (agg.messages || []).map(messageToRow),
      news: (agg.news || []).map(newsToRow),
      syncQueue: (agg.syncQueue || []).map(syncToRow),
      aiCategories: agg.aiCategories || [],
      aiQuestions: agg.aiQuestions || [],
      diseaseRules: agg.diseaseRules || [],
      faultKb: agg.faultKb || [],
      deleted: agg.deleted || {},
    };
  }

  global.MobileOpsMapper = { toAggregate: toAggregate, fromAggregate: fromAggregate };
})(window);
