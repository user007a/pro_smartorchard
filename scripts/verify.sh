#!/usr/bin/env bash
# ============================================================
# 智慧果园后台 · 数据链路一键验证脚本
# 验证：登录 → 16 个 store 对应接口 GET 数据量 → POST 写读闭环
# 用法：bash scripts/verify.sh
# ============================================================
set -e
API="${API:-http://localhost:3000}"
USER="${USER:-admin}"
PASS="${PASS:-admin123}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
pass(){ echo -e "${GREEN}✓${NC} $1"; }
fail(){ echo -e "${RED}✗${NC} $1"; }
info(){ echo -e "${YELLOW}→${NC} $1"; }

# 自动探测 node（支持 PATH 缺失时回退到 WorkBuddy 内置 node / 常见安装路径）
NODE=""
if command -v node >/dev/null 2>&1; then
  NODE="node"
else
  for c in "$HOME/.workbuddy/binaries/node/versions"/*/node "/c/Program Files/nodejs/node.exe" "/c/Program Files (x86)/nodejs/node.exe"; do
    if [ -x "$c" ]; then NODE="$c"; break; fi
  done
fi
if [ -z "$NODE" ]; then
  fail "未找到 node，请安装 Node.js 或将 node 加入 PATH"
  info "（或者：无需手动跑本脚本——直接用浏览器验证 http://localhost:8080）"
  exit 1
fi

info "后端健康检查..."
curl -sf "$API/api/health" >/dev/null || { fail "后端 $API 未就绪"; exit 1; }
pass "后端 $API 正常"

info "登录获取 token..."
TOKEN=$(curl -s -X POST "$API/api/auth/login" -H "Content-Type: application/json" \
  -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}" \
  | "$NODE" -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{let j=JSON.parse(d);console.log((j.data&&j.data.token)||j.token||'')}catch(e){console.log('')}})")
if [ -z "$TOKEN" ]; then fail "登录失败（用户名/密码？）"; exit 1; fi
pass "登录成功（token 长度 ${#TOKEN}）"

# 各模块接口 + 期望最少数据量（key:条数）
declare -A EXPECT=(
  [sales/aggregate]="customers:20"
  [biz/aggregate]="revenueMix:5"
  [mall/aggregate]="members:20"
  [adoption/aggregate]="trees:20"
  [material/aggregate]="materials:20"
  [data/aggregate]="sources:5"
  [model/aggregate]="models:6"
  [soil/aggregate]="tests:10"
  [mobile-ops/aggregate]="expertQuestions:20"
  [alert/aggregate]="alerts:40"
  [trace/aggregate]="showTemplates:5"
  [vr/aggregate]="scenes:10"
  [enterprise/aggregate]="bases:8"
)

echo ""
info "逐接口验证 GET 数据量..."
for path in "${!EXPECT[@]}"; do
  key="${EXPECT[$path]%%:*}"; want="${EXPECT[$path]##*:}"
  got=$(curl -s "$API/api/$path" -H "Authorization: Bearer $TOKEN" \
    | "$NODE" -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{let j=JSON.parse(d);let v=j.data&&j.data['$key'];console.log(Array.isArray(v)?v.length:(v?1:0))}catch(e){console.log(0)}})")
  if [ "${got:-0}" -ge "$want" ]; then pass "/$path → $key = $got 条（≥$want）"
  else fail "/$path → $key = ${got:-0} 条（期望 ≥$want）"; fi
done

echo ""
info "验证 POST 写读闭环（写入→读回→清理）..."
TEST_CODE="VF-TEST-$RANDOM"
# 用 vr 接口做代表（最简单）
curl -sf -X POST "$API/api/vr/aggregate" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"scenes\":[{\"scene_code\":\"$TEST_CODE\",\"name\":\"验证用临时场景\",\"scene_type\":\"entrance\",\"scene_status\":\"draft\",\"views\":0}]}" >/dev/null
EXISTS=$(curl -s "$API/api/vr/aggregate" -H "Authorization: Bearer $TOKEN" \
  | "$NODE" -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{let j=JSON.parse(d);let s=j.data.scenes||[];console.log(s.some(x=>x.scene_code==='$TEST_CODE')?1:0)})")
if [ "$EXISTS" = "1" ]; then pass "写入 $TEST_CODE 并成功读回"
else fail "写入后未读回（$TEST_CODE）"; fi

# 清理
docker exec so-mysql sh -c "mysql -uroot -proot smartorchard -e \"DELETE FROM sf_vr_scene WHERE scene_code='$TEST_CODE';\"" >/dev/null 2>&1 \
  && pass "测试数据已清理" || info "（清理需手动：DELETE FROM sf_vr_scene WHERE scene_code='$TEST_CODE'）"

echo ""
echo -e "${GREEN}======== 后端数据链路验证完成 ========${NC}"
echo "前端页面请打开浏览器访问：http://localhost:8080"
echo "登录后逐页检查：列表有数据、新增/编辑/删除后刷新仍保留（已落库）"
