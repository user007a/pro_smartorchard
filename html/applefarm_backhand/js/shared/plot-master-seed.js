/**
 * 地块主数据兜底种子
 * --------------------------------------------------------------
 * 后台「地块管理」（enterprise_plot.html）首次进入时会用页面内 mockPlotData
 * 播种 smartorchard_plot_master；本文件供生产指挥大屏在尚未打开地块管理时兜底播种，
 * 二者字段与取值保持一致，落库后所有页面统一读取 smartorchard_plot_master。
 * 后续新增 / 编辑 / 删除均回写该 key，不再读本文件。
 */
(function (global) {
  'use strict';
  global.PLOT_MASTER_SEED = [
    { id:'PLOT001', code:'D-001', name:'东区1号地', enterprise:'天水麦积区基地', area:85, trees:3825, variety:'花牛苹果', year:2018, status:'normal', statusText:'正常', manager:'惠加宁', lng:105.7177, lat:34.5715 },
    { id:'PLOT002', code:'D-002', name:'东区2号地', enterprise:'天水麦积区基地', area:92, trees:4140, variety:'花牛苹果', year:2016, status:'normal', statusText:'正常', manager:'黄忠坚', lng:105.7269, lat:34.5715 },
    { id:'PLOT003', code:'D-003', name:'西区1号地', enterprise:'天水麦积区基地', area:78, trees:3510, variety:'金帅', year:2020, status:'warning', statusText:'需施肥', manager:'徐水应', lng:105.7334, lat:34.5714 },
    { id:'PLOT004', code:'D-004', name:'北区1号地', enterprise:'天水秦州区基地', area:65, trees:2925, variety:'花牛苹果', year:2014, status:'normal', statusText:'正常', manager:'朱泉龙', lng:105.7344, lat:34.5686 },
    { id:'PLOT005', code:'D-005', name:'南区1号地', enterprise:'天水甘谷县基地', area:88, trees:3960, variety:'花牛苹果', year:2021, status:'danger', statusText:'病虫害', manager:'陈小忠', lng:105.7267, lat:34.5647 },
    { id:'PLOT006', code:'D-006', name:'中区1号地', enterprise:'天水秦安县基地', area:65, trees:2925, variety:'花牛苹果', year:2020, status:'normal', statusText:'正常', manager:'廖春亮', lng:105.7175, lat:34.5610 },
    { id:'PLOT007', code:'D-007', name:'南区2号地', enterprise:'天水清水县基地', area:88, trees:3960, variety:'花牛苹果', year:2018, status:'normal', statusText:'正常', manager:'李建明', lng:105.7343, lat:34.5609 },
    { id:'PLOT008', code:'D-008', name:'西区2号地', enterprise:'天水武山县基地', area:110, trees:4950, variety:'花牛苹果', year:2017, status:'warning', statusText:'需施肥', manager:'李根', lng:105.7269, lat:34.5567 },
    { id:'PLOT009', code:'D-009', name:'北区2号地', enterprise:'天水张家川县基地', area:92, trees:4140, variety:'花牛苹果', year:2016, status:'normal', statusText:'正常', manager:'张才孙', lng:105.7269, lat:34.5533 },
    { id:'PLOT010', code:'D-010', name:'东区3号地', enterprise:'天水麦积区基地', area:78, trees:3510, variety:'金帅', year:2021, status:'danger', statusText:'病虫害', manager:'刘全国', lng:105.7389, lat:34.5715 },
    { id:'PLOT011', code:'D-011', name:'南区3号地', enterprise:'天水秦州区基地', area:105, trees:4725, variety:'花牛苹果', year:2019, status:'normal', statusText:'正常', manager:'毛定卫', lng:105.7400, lat:34.5687 },
    { id:'PLOT012', code:'D-012', name:'西区3号地', enterprise:'天水甘谷县基地', area:82, trees:3690, variety:'秦冠', year:2022, status:'normal', statusText:'正常', manager:'叶三东', lng:105.7342, lat:34.5646 },
    { id:'PLOT013', code:'D-013', name:'北区3号地', enterprise:'天水清水县基地', area:75, trees:3375, variety:'花牛苹果', year:2018, status:'warning', statusText:'需施肥', manager:'周才贵', lng:105.7176, lat:34.5567 },
    { id:'PLOT014', code:'D-014', name:'中区2号地', enterprise:'天水武山县基地', area:98, trees:4410, variety:'花牛苹果', year:2017, status:'normal', statusText:'正常', manager:'程名高', lng:105.7370, lat:34.5567 },
    { id:'PLOT015', code:'D-015', name:'东区4号地', enterprise:'天水张家川县基地', area:68, trees:3060, variety:'花牛苹果', year:2020, status:'normal', statusText:'正常', manager:'邓小华', lng:105.7371, lat:34.5532 },
    { id:'PLOT016', code:'D-016', name:'南区4号地', enterprise:'天水麦积区基地', area:115, trees:5175, variety:'金帅', year:2015, status:'danger', statusText:'病虫害', manager:'周成友', lng:105.7176, lat:34.5687 },
    { id:'PLOT017', code:'D-017', name:'西区4号地', enterprise:'天水秦州区基地', area:89, trees:4005, variety:'花牛苹果', year:2019, status:'normal', statusText:'正常', manager:'危红卫', lng:105.7176, lat:34.5647 },
    { id:'PLOT018', code:'D-018', name:'北区4号地', enterprise:'天水甘谷县基地', area:96, trees:4320, variety:'花牛苹果', year:2021, status:'warning', statusText:'需施肥', manager:'方超', lng:105.7399, lat:34.5645 },
    { id:'PLOT019', code:'D-019', name:'中区3号地', enterprise:'天水秦安县基地', area:72, trees:3240, variety:'花牛苹果', year:2018, status:'normal', statusText:'正常', manager:'曹红英', lng:105.7269, lat:34.5609 },
    { id:'PLOT020', code:'D-020', name:'东区5号地', enterprise:'天水清水县基地', area:102, trees:4590, variety:'秦冠', year:2016, status:'normal', statusText:'正常', manager:'崔新根', lng:105.7400, lat:34.5609 },
    { id:'PLOT021', code:'D-021', name:'南区5号地', enterprise:'天水武山县基地', area:86, trees:3870, variety:'花牛苹果', year:2022, status:'normal', statusText:'正常', manager:'惠加宁', lng:105.7175, lat:34.5533 },
    { id:'PLOT022', code:'D-022', name:'西区5号地', enterprise:'天水张家川县基地', area:93, trees:4185, variety:'花牛苹果', year:2017, status:'danger', statusText:'病虫害', manager:'黄忠坚', lng:105.7222, lat:34.5484 },
    { id:'PLOT023', code:'D-023', name:'北区5号地', enterprise:'天水麦积区基地', area:81, trees:3645, variety:'金帅', year:2020, status:'normal', statusText:'正常', manager:'徐水应', lng:105.7270, lat:34.5686 }
  ];
})(window);
