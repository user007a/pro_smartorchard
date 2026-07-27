var vrHotspotsData = {
    scenes: [
        {
            id: "scene_main",
            name: "园区主入口",
            image: "../applefarm_dataanlye/images/Aerial_view_of_a_lush_green_ap_2026-05-20T10-52-24.png",
            preview: "../applefarm_dataanlye/images/Aerial_view_of_a_lush_green_ap_2026-05-20T10-52-24.png",
            yaw: 180,
            pitch: 0,
            hfov: 100,
            hotSpots: [
                {
                    id: "hotspot_plot_a1",
                    type: "plot",
                    pitch: -5,
                    yaw: 45,
                    title: "A1地块",
                    content: "<div style='padding:8px;'><h4 style='margin:0 0 8px 0;color:#2b6e3c;font-size:14px;'>A1地块</h4><p style='margin:0 0 4px 0;font-size:12px;color:#64748b;'>品种：红富士</p><p style='margin:0 0 4px 0;font-size:12px;color:#64748b;'>树龄：8年</p><p style='margin:0;font-size:12px;color:#64748b;'>面积：25亩</p><div style='margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0;'><span style='font-size:11px;color:#22c55e;'>当前状态：正常</span></div></div>",
                    targetId: "plot_a1",
                    status: "normal"
                },
                {
                    id: "hotspot_device_water1",
                    type: "device",
                    pitch: -10,
                    yaw: 120,
                    title: "水肥设备A区",
                    content: "<div style='padding:8px;'><h4 style='margin:0 0 8px 0;color:#1890ff;font-size:14px;'>水肥设备A区</h4><p style='margin:0 0 4px 0;font-size:12px;color:#64748b;'>类型：滴灌系统</p><p style='margin:0 0 4px 0;font-size:12px;color:#64748b;'>状态：运行中</p><p style='margin:0;font-size:12px;color:#64748b;'>流量：2.5 m³/h</p><div style='margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0;'><span style='font-size:11px;color:#22c55e;'>在线</span></div></div>",
                    targetId: "device_water1",
                    status: "normal"
                },
                {
                    id: "hotspot_task_pruning",
                    type: "task",
                    pitch: 5,
                    yaw: -30,
                    title: "修剪任务",
                    content: "<div style='padding:8px;'><h4 style='margin:0 0 8px 0;color:#f59e0b;font-size:14px;'>夏季修剪</h4><p style='margin:0 0 4px 0;font-size:12px;color:#64748b;'>地块：A1-A3区</p><p style='margin:0 0 4px 0;font-size:12px;color:#64748b;'>负责人：李师傅</p><p style='margin:0;font-size:12px;color:#64748b;'>进度：75%</p><div style='margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0;'><span style='font-size:11px;color:#f59e0b;'>进行中</span></div></div>",
                    targetId: "task_pruning",
                    status: "warning"
                },
                {
                    id: "hotspot_building_office",
                    type: "building",
                    pitch: -15,
                    yaw: -90,
                    title: "办公楼",
                    content: "<div style='padding:8px;'><h4 style='margin:0 0 8px 0;color:#722ed1;font-size:14px;'>办公楼</h4><p style='margin:0 0 4px 0;font-size:12px;color:#64748b;'>建筑面积：1200㎡</p><p style='margin:0;font-size:12px;color:#64748b;'>用途：办公、会议室</p></div>",
                    targetId: "building_office",
                    status: "normal"
                },
                {
                    id: "hotspot_scene_b2",
                    type: "scene",
                    pitch: 0,
                    yaw: 180,
                    title: "B区全景",
                    content: "<div style='padding:8px;text-align:center;'><h4 style='margin:0 0 8px 0;color:#2b6e3c;font-size:14px;'>B区全景</h4><p style='margin:0;font-size:12px;color:#64748b;'>点击跳转查看B区全景</p><div style='margin-top:8px;padding:6px 12px;background:#2b6e3c;color:#fff;border-radius:12px;font-size:12px;'>进入 B区 →</div></div>",
                    targetId: "scene_b",
                    status: "normal"
                }
            ]
        },
        {
            id: "scene_b",
            name: "B区全景",
            image: "../applefarm_dataanlye/images/Aerial_view_of_a_lush_green_ap_2026-05-20T10-52-24.png",
            preview: "../applefarm_dataanlye/images/Aerial_view_of_a_lush_green_ap_2026-05-20T10-52-24.png",
            yaw: 0,
            pitch: 0,
            hfov: 100,
            hotspots: [
                {
                    id: "hotspot_plot_b1",
                    type: "plot",
                    pitch: -8,
                    yaw: 30,
                    title: "B1地块",
                    content: "<div style='padding:8px;'><h4 style='margin:0 0 8px 0;color:#2b6e3c;font-size:14px;'>B1地块</h4><p style='margin:0 0 4px 0;font-size:12px;color:#64748b;'>品种：嘎啦</p><p style='margin:0 0 4px 0;font-size:12px;color:#64748b;'>树龄：6年</p><p style='margin:0;font-size:12px;color:#64748b;'>面积：20亩</p><div style='margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0;'><span style='font-size:11px;color:#f59e0b;'>需关注：病虫害风险中等</span></div></div>",
                    targetId: "plot_b1",
                    status: "warning"
                },
                {
                    id: "hotspot_device_camera1",
                    type: "device",
                    pitch: -12,
                    yaw: -60,
                    title: "监控摄像头",
                    content: "<div style='padding:8px;'><h4 style='margin:0 0 8px 0;color:#1890ff;font-size:14px;'>监控摄像头</h4><p style='margin:0 0 4px 0;font-size:12px;color:#64748b;'>位置：B1区西北角</p><p style='margin:0;font-size:12px;color:#64748b;'>状态：在线</p><div style='margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0;'><span style='font-size:11px;color:#22c55e;'>实时监控中</span></div></div>",
                    targetId: "device_camera1",
                    status: "normal"
                },
                {
                    id: "hotspot_scene_main_back",
                    type: "scene",
                    pitch: 0,
                    yaw: 180,
                    title: "返回主入口",
                    content: "<div style='padding:8px;text-align:center;'><h4 style='margin:0 0 8px 0;color:#2b6e3c;font-size:14px;'>返回主入口</h4><p style='margin:0;font-size:12px;color:#64748b;'>点击返回主入口全景</p><div style='margin-top:8px;padding:6px 12px;background:#2b6e3c;color:#fff;border-radius:12px;font-size:12px;'>返回 →</div></div>",
                    targetId: "scene_main",
                    status: "normal"
                },
                {
                    id: "hotspot_plot_b2",
                    type: "plot",
                    pitch: -5,
                    yaw: 100,
                    title: "B2地块",
                    content: "<div style='padding:8px;'><h4 style='margin:0 0 8px 0;color:#2b6e3c;font-size:14px;'>B2地块</h4><p style='margin:0 0 4px 0;font-size:12px;color:#64748b;'>品种：金帅</p><p style='margin:0 0 4px 0;font-size:12px;color:#64748b;'>树龄：5年</p><p style='margin:0;font-size:12px;color:#64748b;'>面积：18亩</p><div style='margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0;'><span style='font-size:11px;color:#22c55e;'>当前状态：正常</span></div></div>",
                    targetId: "plot_b2",
                    status: "normal"
                }
            ]
        },
        {
            id: "scene_c",
            name: "C区全景",
            image: "../applefarm_dataanlye/images/Aerial_view_of_a_lush_green_ap_2026-05-20T10-52-24.png",
            preview: "../applefarm_dataanlye/images/Aerial_view_of_a_lush_green_ap_2026-05-20T10-52-24.png",
            yaw: 0,
            pitch: 0,
            hfov: 100,
            hotspots: [
                {
                    id: "hotspot_plot_c1",
                    type: "plot",
                    pitch: -5,
                    yaw: 45,
                    title: "C1地块",
                    content: "<div style='padding:8px;'><h4 style='margin:0 0 8px 0;color:#2b6e3c;font-size:14px;'>C1地块</h4><p style='margin:0 0 4px 0;font-size:12px;color:#64748b;'>品种：红富士</p><p style='margin:0 0 4px 0;font-size:12px;color:#64748b;'>树龄：10年</p><p style='margin:0;font-size:12px;color:#64748b;'>面积：30亩</p><div style='margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0;'><span style='font-size:11px;color:#22c55e;'>当前状态：正常</span></div></div>",
                    targetId: "plot_c1",
                    status: "normal"
                },
                {
                    id: "hotspot_device_meteor1",
                    type: "device",
                    pitch: -15,
                    yaw: -45,
                    title: "气象站",
                    content: "<div style='padding:8px;'><h4 style='margin:0 0 8px 0;color:#1890ff;font-size:14px;'>气象站</h4><p style='margin:0 0 4px 0;font-size:12px;color:#64748b;'>温度：26.5°C</p><p style='margin:0 0 4px 0;font-size:12px;color:#64748b;'>湿度：68%</p><p style='margin:0;font-size:12px;color:#64748b;'>风速：3.2 m/s</p><div style='margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0;'><span style='font-size:11px;color:#22c55e;'>在线</span></div></div>",
                    targetId: "device_meteor1",
                    status: "normal"
                },
                {
                    id: "hotspot_scene_main_c",
                    type: "scene",
                    pitch: 0,
                    yaw: 180,
                    title: "返回主入口",
                    content: "<div style='padding:8px;text-align:center;'><h4 style='margin:0 0 8px 0;color:#2b6e3c;font-size:14px;'>返回主入口</h4><p style='margin:0;font-size:12px;color:#64748b;'>点击返回主入口全景</p><div style='margin-top:8px;padding:6px 12px;background:#2b6e3c;color:#fff;border-radius:12px;font-size:12px;'>返回 →</div></div>",
                    targetId: "scene_main",
                    status: "normal"
                }
            ]
        }
    ],
    getSceneById: function(id) {
        return this.scenes.find(function(scene) {
            return scene.id === id;
        });
    },
    getAllSceneIds: function() {
        return this.scenes.map(function(scene) {
            return scene.id;
        });
    },
    getAllSceneNames: function() {
        var names = {};
        this.scenes.forEach(function(scene) {
            names[scene.id] = scene.name;
        });
        return names;
    }
};