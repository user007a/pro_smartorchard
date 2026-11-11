/**
 * 鉴权路由
 * --------------------------------------------------------------
 * 三种登录体系：
 *   1. 后台管理  POST /api/auth/login          body: { username, password }
 *      → 校验 sf_user（bcrypt）
 *   2. 移动端    POST /api/auth/mobile-login   body: { account, password }
 *      → 校验 sf_mb_staff_account（SHA-256）
 *   3. H5 会员   POST /api/auth/member-login   body: { phone, password }
 *      → 校验 sf_mall_member（手机号 + bcrypt）
 *
 * 密码算法说明：
 *   - bcryptjs 用于 sf_user / sf_mall_member（与 seed 中 bcrypt 哈希一致）
 *   - crypto SHA-256 用于 sf_mb_staff_account（与 seed 中 SHA-256 摘要一致）
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query } = require('../config/db');
const { sign } = require('../middleware/auth');

const router = express.Router();

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// ---------- 后台登录 ----------
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ ok: false, message: '请输入账号和密码' });
    }

    const rows = await query(
      'SELECT * FROM `sf_user` WHERE `username` = ? AND `is_deleted` = 0',
      [username]
    );
    if (!rows.length) {
      return res.status(401).json({ ok: false, message: '账号或密码错误' });
    }

    const user = rows[0];
    if (user.user_status !== 'active') {
      return res.status(403).json({ ok: false, message: '账号已停用' });
    }

    const matched = bcrypt.compareSync(password, user.password);
    if (!matched) {
      return res.status(401).json({ ok: false, message: '账号或密码错误' });
    }

    // 更新最后登录时间
    await query('UPDATE `sf_user` SET `last_login_at` = NOW() WHERE `id` = ?', [user.id]);

    const token = sign({
      id: user.id,
      username: user.username,
      realName: user.real_name,
      roleId: user.role_id,
      type: 'admin',
    });

    res.json({
      ok: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          realName: user.real_name,
          phone: user.phone,
          roleId: user.role_id,
          baseId: user.base_id,
        },
      },
    });
  } catch (e) {
    next(e);
  }
});

// ---------- 移动端登录 ----------
router.post('/mobile-login', async (req, res, next) => {
  try {
    const { account, password } = req.body || {};
    if (!account || !password) {
      return res.status(400).json({ ok: false, message: '请输入账号和密码' });
    }

    const rows = await query(
      'SELECT * FROM `sf_mb_staff_account` WHERE `account` = ? AND `is_deleted` = 0',
      [account]
    );
    if (!rows.length) {
      return res.status(401).json({ ok: false, message: '账号或密码错误' });
    }

    const staff = rows[0];
    if (staff.status !== 'active') {
      return res.status(403).json({ ok: false, message: '账号已停用' });
    }

    // 兼容历史明文密码 + SHA-256 摘要
    const pwdHash = sha256(password);
    const matched = staff.password === pwdHash || staff.password === password;
    if (!matched) {
      return res.status(401).json({ ok: false, message: '账号或密码错误' });
    }

    const token = sign({
      id: staff.id,
      account: staff.account,
      realName: staff.real_name,
      role: staff.role,
      type: 'mobile',
    });

    res.json({
      ok: true,
      data: {
        token,
        user: {
          id: staff.id,
          account: staff.account,
          realName: staff.real_name,
          phone: staff.phone,
          role: staff.role,
          baseId: staff.base_id,
          isExpert: staff.is_expert,
        },
      },
    });
  } catch (e) {
    next(e);
  }
});

// ---------- H5 会员登录 ----------
router.post('/member-login', async (req, res, next) => {
  try {
    const { phone, password } = req.body || {};
    if (!phone || !password) {
      return res.status(400).json({ ok: false, message: '请输入手机号和密码' });
    }

    const rows = await query(
      'SELECT * FROM `sf_mall_member` WHERE `phone` = ? AND `is_deleted` = 0',
      [phone]
    );
    if (!rows.length) {
      return res.status(401).json({ ok: false, message: '手机号或密码错误' });
    }

    const member = rows[0];
    if (member.status !== 'active') {
      return res.status(403).json({ ok: false, message: '账号已停用' });
    }

    const matched = bcrypt.compareSync(password, member.password);
    if (!matched) {
      return res.status(401).json({ ok: false, message: '手机号或密码错误' });
    }

    const token = sign({
      id: member.id,
      phone: member.phone,
      nickname: member.nickname,
      level: member.level,
      type: 'member',
    });

    res.json({
      ok: true,
      data: {
        token,
        user: {
          id: member.id,
          memberCode: member.member_code,
          nickname: member.nickname,
          phone: member.phone,
          level: member.level,
          points: member.points,
        },
      },
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
