# -*- coding: utf-8 -*-
"""从 device-store.js 提取 DEVICE_SEED + DEVICE_EXTRA，生成对齐新 sf_device 表结构的 INSERT"""
import re

with open('html/applefarm_backhand/js/shared/device-store.js', encoding='utf-8') as f:
    content = f.read()

# 提取 DEVICE_SEED 数组（第 529-560 行）
seed_block = re.search(r'var DEVICE_SEED = \[(.*?)\n  \];', content, re.DOTALL).group(1)

# 提取 DEVICE_EXTRA 对象
extra_block = re.search(r'var DEVICE_EXTRA = \{(.*?)\n  \};', content, re.DOTALL).group(1)

# 解析 DEVICE_SEED 每一行：['D-001', '东区气象监测站', ...]
rows = []
for line in seed_block.split('\n'):
    line = line.strip()
    if not line.startswith("['"):
        continue
    # 用正则提取所有单引号字符串和数字
    # 字段顺序: id, name, type, base, plotId, location, status, assetStatus,
    #          vendor, model, firmware, ip, protocol, power, owner,
    #          maintainCycle, calibrateCycle, installDate, enableDate,
    #          purchaseAmount, usefulYears, ?, faultCount, lastSeenAt,
    #          onlineRate, collectCount, uptimeRate, accessId, remark
    # 混合了字符串和数字，逐个解析
    vals = re.findall(r"'([^']*)'|([0-9]+(?:\.[0-9]+)?)", line)
    # 展平：每个匹配是 (str, num) 元组
    fields = []
    for s, n in vals:
        if s != '' or (s == '' and n == ''):
            fields.append(s)
        else:
            fields.append(n)
    # 更可靠的方式：手动按逗号+引号解析
    fields2 = re.findall(r"'((?:[^']|'')*)'|\b([0-9]+(?:\.[0-9]+)?)\b", line)
    flat = []
    for s, n in fields2:
        if s:
            flat.append(s)
        elif n:
            flat.append(n)
    if len(flat) >= 29:
        rows.append(flat)

# 解析 DEVICE_EXTRA：key -> { lastMaintain, lastCalibrate, warrantyUntil }
extra = {}
for m in re.finditer(r"'([A-Z]-\d+)':\s*\{([^}]*)\}", extra_block):
    code = m.group(1)
    body = m.group(2)
    lm = re.search(r"lastMaintain:\s*'([^']*)'", body)
    lc = re.search(r"lastCalibrate:\s*'([^']*)'", body)
    wu = re.search(r"warrantyUntil:\s*'([^']*)'", body)
    extra[code] = {
        'lastMaintain': lm.group(1) if lm else '',
        'lastCalibrate': lc.group(1) if lc else '',
        'warrantyUntil': wu.group(1) if wu else '',
    }

# 生成 INSERT
cols = ['device_code','device_name','device_type','base_id','plot_id','location','run_status','asset_status',
        'vendor','model','sn','firmware','ip','protocol','power','owner','supplier','disposal_way',
        'install_date','enable_date','warranty_until','purchase_amount','useful_years',
        'maintain_cycle','next_maintain','last_maintain_date','calibrate_cycle','last_calibrate_date',
        'running_hours','fault_count','online_rate','uptime_rate','collect_count','last_seen_at',
        'collect_time','remark','created_at','is_deleted']

def esc(s):
    return s.replace("'", "''")

lines = []
for r in rows:
    code = r[0]      # D-001
    name = r[1]
    dtype = r[2]
    base = r[3]
    plot = r[4]      # plotId（store 里存的是地块 code 或空）
    location = r[5]
    status = r[6]
    asset_status = r[7]
    vendor = r[8]
    model = r[9]
    firmware = r[10]
    ip = r[11]
    protocol = r[12]
    power = r[13]
    owner = r[14]
    maintain_cycle = r[15]   # 数字（月）
    calibrate_cycle = r[16]  # 数字（月），0 表示不校准
    install_date = r[17]
    enable_date = r[18]
    purchase_amount = r[19]  # 万元（注意 store 里是"万元"）
    useful_years = r[20]
    running_hours = r[21]    # 累计运行时长 h
    fault_count = r[22]
    last_seen_at = r[23]
    online_rate = r[24]
    collect_count = r[25]
    uptime_rate = r[26]
    access_id = r[27]
    remark = r[28]

    ex = extra.get(code, {})
    last_maintain = ex.get('lastMaintain', '')
    last_calibrate = ex.get('lastCalibrate', '')
    warranty_until = ex.get('warrantyUntil', '')

    # sn 生成规则（与 store buildDeviceSeed 一致）
    sn = 'SN' + code[2:] + '-' + re.sub(r'[^A-Za-z0-9]', '', model).upper()[:6]

    # 维护/校准周期转字符串（store 里 maintainCycle 是数字月，展示时加"个月"）
    mc = str(maintain_cycle) + '个月' if maintain_cycle and maintain_cycle != '0' else '不维保'
    cc = str(calibrate_cycle) + '个月' if calibrate_cycle and calibrate_cycle != '0' else '不校准'

    # 采购金额：store 里是"万元"，转成"元"
    purchase_yuan = round(float(purchase_amount) * 10000, 2)

    # base_id/plot_id：store 存的是名称/地块code，这里原型数据没有真正的数字外键，置 NULL
    base_id = 'NULL'
    plot_id = 'NULL'

    vals = [
        esc(code), esc(name), dtype, base_id, plot_id, esc(location), status, asset_status,
        esc(vendor), esc(model), esc(sn), esc(firmware), esc(ip), esc(protocol), esc(power), esc(owner),
        esc(vendor),  # supplier 与 vendor 相同（store 里 supplier=r[8]=vendor）
        '',  # disposal_way
        esc(install_date), esc(enable_date), esc(warranty_until),
        purchase_yuan, useful_years,
        mc, '', esc(last_maintain), cc, esc(last_calibrate),
        running_hours, fault_count, online_rate, uptime_rate, collect_count,
        last_seen_at, last_seen_at, esc(remark), esc(install_date), 0
    ]

    line = "('" + "','".join(str(v) for v in vals) + "')"
    lines.append(line)

print("INSERT INTO `sf_device` (`" + "`,`".join(cols) + "`) VALUES")
print(",\n".join(lines) + ";")
