var VRAPI = {
    baseUrl: '/api',

    // ========== 地块数据 ==========
    plots: [
        {
            id: 'plot_a1',
            name: 'A1地块（花牛苹果核心区）',
            variety: '花牛苹果',
            varietyCode: 'R Fuji',
            age: 8,
            plantingYear: 2018,
            area: 25,
            areaUnit: '亩',
            status: 'normal',
            growthStage: '膨大期',
            yield: 12000,
            yieldUnit: 'kg',
            expectedHarvest: '2026-10-15',
            fertilizationDate: '2026-09-15',
            fertilizationType: '有机复合肥',
            diseaseRisk: 'low',
            soilMoisture: 45,
            soilPH: 6.8,
            soilNitrogen: 82,
            soilPhosphorus: 35,
            soilPotassium: 120,
            lastInspection: '2026-09-10',
            inspector: '张农艺师',
            image: 'https://images.unsplash.com/photo-1568702846914-96b305d2ead1?w=400&h=300&fit=crop'
        },
        {
            id: 'plot_a2',
            name: 'A2地块（新品种试验区）',
            variety: '花牛苹果',
            varietyCode: 'R Fuji',
            age: 8,
            plantingYear: 2018,
            area: 22,
            areaUnit: '亩',
            status: 'normal',
            growthStage: '膨大期',
            yield: 10500,
            yieldUnit: 'kg',
            expectedHarvest: '2026-10-18',
            fertilizationDate: '2026-09-14',
            fertilizationType: '水溶肥',
            diseaseRisk: 'low',
            soilMoisture: 42,
            soilPH: 6.5,
            soilNitrogen: 78,
            soilPhosphorus: 32,
            soilPotassium: 115,
            lastInspection: '2026-09-09',
            inspector: '李农艺师',
            image: 'https://images.unsplash.com/photo-1594489428504-5c0c480a15fd?w=400&h=300&fit=crop'
        },
        {
            id: 'plot_b1',
            name: 'B1地块（花牛苹果早熟区）',
            variety: '花牛苹果',
            varietyCode: 'Gala',
            age: 6,
            plantingYear: 2020,
            area: 20,
            areaUnit: '亩',
            status: 'warning',
            growthStage: '转色期',
            yield: 8000,
            yieldUnit: 'kg',
            expectedHarvest: '2026-09-05',
            fertilizationDate: '2026-09-12',
            fertilizationType: '有机肥',
            diseaseRisk: 'medium',
            diseaseName: '轻微蚜虫',
            soilMoisture: 38,
            soilPH: 6.6,
            soilNitrogen: 75,
            soilPhosphorus: 30,
            soilPotassium: 108,
            lastInspection: '2026-09-11',
            inspector: '王农艺师',
            image: 'https://images.unsplash.com/photo-1471943311424-646960669fbc?w=400&h=300&fit=crop'
        },
        {
            id: 'plot_b2',
            name: 'B2地块（金帅区）',
            variety: '金帅',
            varietyCode: 'Golden',
            age: 5,
            plantingYear: 2021,
            area: 18,
            areaUnit: '亩',
            status: 'normal',
            growthStage: '膨大期',
            yield: 7200,
            yieldUnit: 'kg',
            expectedHarvest: '2026-09-25',
            fertilizationDate: '2026-09-16',
            fertilizationType: '复合肥',
            diseaseRisk: 'low',
            soilMoisture: 48,
            soilPH: 6.7,
            soilNitrogen: 80,
            soilPhosphorus: 34,
            soilPotassium: 118,
            lastInspection: '2026-09-08',
            inspector: '张农艺师',
            image: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=400&h=300&fit=crop'
        },
        {
            id: 'plot_c1',
            name: 'C1地块（有机种植区）',
            variety: '花牛苹果',
            varietyCode: 'R Fuji',
            age: 10,
            plantingYear: 2016,
            area: 30,
            areaUnit: '亩',
            status: 'normal',
            growthStage: '膨大期',
            yield: 15000,
            yieldUnit: 'kg',
            expectedHarvest: '2026-10-20',
            fertilizationDate: '2026-09-13',
            fertilizationType: '有机生物肥',
            diseaseRisk: 'low',
            soilMoisture: 50,
            soilPH: 6.9,
            soilNitrogen: 88,
            soilPhosphorus: 38,
            soilPotassium: 125,
            lastInspection: '2026-09-10',
            inspector: '赵农艺师',
            image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop'
        },
        {
            id: 'plot_c2',
            name: 'C2地块（花牛苹果区）',
            variety: '花牛苹果',
            varietyCode: 'Guoguang',
            age: 12,
            plantingYear: 2014,
            area: 25,
            areaUnit: '亩',
            status: 'error',
            growthStage: '膨大期',
            yield: 9000,
            yieldUnit: 'kg',
            expectedHarvest: '2026-10-28',
            fertilizationDate: '2026-09-10',
            fertilizationType: '有机肥',
            diseaseRisk: 'high',
            diseaseName: '轮纹病预警',
            soilMoisture: 35,
            soilPH: 6.4,
            soilNitrogen: 70,
            soilPhosphorus: 28,
            soilPotassium: 105,
            lastInspection: '2026-09-12',
            inspector: '王农艺师',
            image: 'https://images.unsplash.com/photo-1519621543014-cfe26a3be9a2?w=400&h=300&fit=crop'
        }
    ],

    // ========== 设备数据 ==========
    devices: [
        {
            id: 'device_water1',
            name: '水肥一体化设备A区',
            type: '滴灌系统',
            typeCode: 'DRIP_SYSTEM',
            status: 'online',
            location: 'A1/A2区智能灌溉中心',
            flowRate: 2.5,
            flowRateUnit: 'm³/h',
            pressure: 0.35,
            pressureUnit: 'MPa',
            waterConsumption: 125.8,
            waterConsumptionUnit: 'm³',
            battery: 100,
            signalStrength: -45,
            lastMaintenance: '2026-09-01',
            nextMaintenance: '2026-09-01',
            maintenanceCycle: '30天',
            runningTime: 2847,
            runningTimeUnit: 'h',
            firmwareVersion: 'v2.4.1'
        },
        {
            id: 'device_water2',
            name: '水肥一体化设备B区',
            type: '滴灌系统',
            typeCode: 'DRIP_SYSTEM',
            status: 'online',
            location: 'B1/B2区智能灌溉中心',
            flowRate: 2.2,
            flowRateUnit: 'm³/h',
            pressure: 0.32,
            pressureUnit: 'MPa',
            waterConsumption: 98.5,
            waterConsumptionUnit: 'm³',
            battery: 95,
            signalStrength: -52,
            lastMaintenance: '2026-09-05',
            nextMaintenance: '2026-09-05',
            maintenanceCycle: '30天',
            runningTime: 2156,
            runningTimeUnit: 'h',
            firmwareVersion: 'v2.4.1'
        },
        {
            id: 'device_camera1',
            name: '高清监控摄像头-B1区东北角',
            type: '监控设备',
            typeCode: 'CAMERA',
            status: 'online',
            location: 'B1区东北角',
            resolution: '4K UHD',
            viewingAngle: 120,
            viewingAngleUnit: '°',
            nightVision: true,
            lastMaintenance: '2026-09-20',
            nextMaintenance: '2026-09-20',
            maintenanceCycle: '90天',
            storageUsed: 256,
            storageTotal: 512,
            storageUnit: 'GB',
            lastSnapshot: '2026-09-13 10:30:00'
        },
        {
            id: 'device_camera2',
            name: '高清监控摄像头-C1区西南角',
            type: '监控设备',
            typeCode: 'CAMERA',
            status: 'warning',
            location: 'C1区西南角',
            resolution: '4K UHD',
            viewingAngle: 120,
            viewingAngleUnit: '°',
            nightVision: true,
            warningReason: '画面遮挡告警',
            lastMaintenance: '2026-09-15',
            nextMaintenance: '2026-09-15',
            maintenanceCycle: '90天',
            storageUsed: 480,
            storageTotal: 512,
            storageUnit: 'GB',
            lastSnapshot: '2026-09-13 10:28:00'
        },
        {
            id: 'device_meteor1',
            name: '农业气象站-C区',
            type: '气象设备',
            typeCode: 'WEATHER_STATION',
            status: 'online',
            location: 'C1区中心位置',
            temperature: 26.5,
            temperatureUnit: '°C',
            humidity: 68,
            humidityUnit: '%',
            windSpeed: 3.2,
            windSpeedUnit: 'm/s',
            windDirection: '西南风',
            precipitation: 0,
            precipitationUnit: 'mm',
            atmosphericPressure: 1012,
            atmosphericPressureUnit: 'hPa',
            uvIndex: 6,
            lightIntensity: 45000,
            lightIntensityUnit: 'lux',
            lastMaintenance: '2026-09-10',
            nextMaintenance: '2026-09-10',
            dataInterval: 5,
            dataIntervalUnit: 'min'
        },
        {
            id: 'device_sensor1',
            name: '土壤监测传感器-A1区',
            type: '传感器',
            typeCode: 'SOIL_SENSOR',
            status: 'online',
            location: 'A1区中心',
            moisture: 45,
            moistureUnit: '%',
            temperature: 24.8,
            temperatureUnit: '°C',
            ph: 6.8,
            ec: 1.2,
            ecUnit: 'mS/cm',
            depth: 30,
            depthUnit: 'cm',
            lastMaintenance: '2026-09-08',
            nextMaintenance: '2026-09-08',
            calibrationDate: '2026-09-15'
        },
        {
            id: 'device_sensor2',
            name: '土壤监测传感器-C2区',
            type: '传感器',
            typeCode: 'SOIL_SENSOR',
            status: 'offline',
            location: 'C2区东南角',
            lastOffline: '2026-09-12 14:30:00',
            offlineDuration: 720,
            offlineDurationUnit: 'min',
            lastMaintenance: '2026-09-20',
            nextMaintenance: '2026-09-20',
            calibrationDate: '2026-09-20'
        },
        {
            id: 'device_env1',
            name: '环境监测终端-包装车间',
            type: '环境监测',
            typeCode: 'ENV_MONITOR',
            status: 'online',
            location: '包装车间入口',
            temperature: 22.5,
            humidity: 55,
            co2: 420,
            pm25: 15,
            lastMaintenance: '2026-09-15',
            nextMaintenance: '2026-09-15'
        }
    ],

    // ========== 农事任务数据 ==========
    tasks: [
        {
            id: 'task_pruning',
            name: '夏季修剪工作',
            type: 'pruning',
            typeName: '修剪',
            plots: ['A1', 'A2', 'A3'],
            plotIds: ['plot_a1', 'plot_a2'],
            area: 47,
            areaUnit: '亩',
            responsible: '李师傅',
            responsibleTel: '138****1234',
            assistants: ['王师傅', '张师傅'],
            laborHours: 32,
            laborHoursUnit: 'h',
            progress: 75,
            status: 'in_progress',
            statusName: '进行中',
            priority: 'high',
            priorityName: '高',
            startTime: '2026-09-01',
            endTime: '2026-09-30',
            actualStart: '2026-09-01',
            description: '夏季修剪主要包括疏果、拉枝、摘心等工作，控制树势，促进花芽分化',
            materialsUsed: [
                { name: '修枝剪', quantity: 5, unit: '把' },
                { name: '梯子', quantity: 3, unit: '架' }
            ],
            equipmentUsed: ['device_camera1'],
            notes: 'A1区已完成80%，A2区完成70%'
        },
        {
            id: 'task_spray',
            name: '病虫害防治作业',
            type: 'spray',
            typeName: '植保',
            plots: ['B1', 'C2'],
            plotIds: ['plot_b1', 'plot_c2'],
            area: 45,
            areaUnit: '亩',
            responsible: '王师傅',
            responsibleTel: '139****5678',
            assistants: ['赵师傅'],
            laborHours: 24,
            laborHoursUnit: 'h',
            progress: 40,
            status: 'in_progress',
            statusName: '进行中',
            priority: 'urgent',
            priorityName: '紧急',
            startTime: '2026-09-18',
            endTime: '2026-09-25',
            actualStart: '2026-09-18',
            description: '针对蚜虫和红蜘蛛进行防治，使用生物农药进行喷施',
            materialsUsed: [
                { name: '苦参碱水剂', quantity: 45, unit: 'L' },
                { name: '助剂', quantity: 10, unit: 'L' }
            ],
            sprayMethod: '无人机喷施',
            dosagePerMu: 1.5,
            dosageUnit: 'L/亩',
            notes: 'C2区需重点防治，注意轮纹病扩散'
        },
        {
            id: 'task_irrigation',
            name: '智能灌溉作业',
            type: 'irrigation',
            typeName: '灌溉',
            plots: ['A1', 'A2', 'B1', 'B2'],
            plotIds: ['plot_a1', 'plot_a2', 'plot_b1', 'plot_b2'],
            area: 85,
            areaUnit: '亩',
            responsible: '张师傅',
            responsibleTel: '137****9012',
            assistants: [],
            laborHours: 4,
            laborHoursUnit: 'h',
            progress: 100,
            status: 'completed',
            statusName: '已完成',
            priority: 'normal',
            priorityName: '普通',
            startTime: '2026-09-15',
            endTime: '2026-09-16',
            actualStart: '2026-09-15',
            actualEnd: '2026-09-16',
            description: '春季灌溉作业已完成，根据土壤墒情自动控制灌溉量',
            waterUsed: 125.5,
            waterUsedUnit: 'm³',
            energyUsed: 45.2,
            energyUsedUnit: 'kWh',
            notes: '土壤湿度提升至55%，达到最佳含水量'
        },
        {
            id: 'task_fertilizer',
            name: '膨大期追肥作业',
            type: 'fertilizer',
            typeName: '施肥',
            plots: ['C1', 'C2'],
            plotIds: ['plot_c1', 'plot_c2'],
            area: 55,
            areaUnit: '亩',
            responsible: '赵师傅',
            responsibleTel: '136****3456',
            assistants: ['李师傅'],
            laborHours: 16,
            laborHoursUnit: 'h',
            progress: 60,
            status: 'in_progress',
            statusName: '进行中',
            priority: 'high',
            priorityName: '高',
            startTime: '2026-09-20',
            endTime: '2026-09-28',
            actualStart: '2026-09-20',
            description: '苹果膨大期追肥，以钾肥为主，配合氮磷肥，提高果实品质',
            materialsUsed: [
                { name: '硫酸钾', quantity: 550, unit: 'kg' },
                { name: '尿素', quantity: 110, unit: 'kg' },
                { name: '过磷酸钙', quantity: 165, unit: 'kg' }
            ],
            fertilizationMethod: '水肥一体化',
            notes: 'C1区已完成，C2区进行中'
        }
    ],

    // ========== 基地/楼宇数据 ==========
    buildings: [
        {
            id: 'building_office',
            name: '综合办公楼',
            type: 'office',
            typeName: '办公',
            area: 1200,
            areaUnit: 'm²',
            floors: 3,
            usage: '办公、会议室、监控中心',
            status: 'normal',
            staffCount: 28,
            image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=300&fit=crop'
        },
        {
            id: 'building_storage',
            name: '智能仓储中心',
            type: 'storage',
            typeName: '仓储',
            area: 800,
            areaUnit: 'm²',
            floors: 1,
            usage: '农资存放、设备存放、分拣包装',
            status: 'normal',
            capacity: 500,
            capacityUnit: '吨',
            currentStock: 320,
            stockUnit: '吨',
            temperature: 18,
            humidity: 45,
            image: 'https://images.unsplash.com/photo-1506484381205-f7945b51d469?w=400&h=300&fit=crop'
        },
        {
            id: 'building_workshop',
            name: '水果分选加工车间',
            type: 'workshop',
            typeName: '加工',
            area: 1500,
            areaUnit: 'm²',
            floors: 1,
            usage: '苹果分拣、清洗、包装、预冷',
            status: 'normal',
            processingCapacity: 10,
            processingCapacityUnit: '吨/h',
            currentUtilization: 65,
            equipmentCount: 8,
            image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=400&h=300&fit=crop'
        },
        {
            id: 'building_cold',
            name: '冷链保鲜库',
            type: 'cold_storage',
            typeName: '冷库',
            area: 600,
            areaUnit: 'm²',
            floors: 1,
            usage: '水果预冷、保鲜储存',
            status: 'normal',
            temperature: 2,
            temperatureUnit: '°C',
            humidity: 90,
            humidityUnit: '%',
            capacity: 300,
            capacityUnit: '吨',
            currentStock: 180,
            stockUnit: '吨',
            energyConsumption: 850,
            energyConsumptionUnit: 'kWh/天'
        }
    ],

    // ========== 农资库存数据 ==========
    materials: [
        {
            id: 'mat_fertilizer_001',
            name: '有机复合肥（NPK≥45%）',
            category: '肥料',
            categoryCode: 'FERTILIZER',
            unit: '吨',
            stock: 25.5,
            minStock: 10,
            maxStock: 50,
            price: 3200,
            priceUnit: '元/吨',
            supplier: '甘肃金正大股份有限公司',
            contactTel: '0531-8****888',
            expirationDate: '2027-09-15',
            storageLocation: '仓库A区-01号货架',
            lastCheckDate: '2026-09-01',
            status: 'normal'
        },
        {
            id: 'mat_fertilizer_002',
            name: '硫酸钾（K₂O≥50%）',
            category: '肥料',
            categoryCode: 'FERTILIZER',
            unit: '吨',
            stock: 8.2,
            minStock: 5,
            maxStock: 30,
            price: 4500,
            priceUnit: '元/吨',
            supplier: '青海盐湖化工有限公司',
            contactTel: '0971-6****666',
            expirationDate: '2028-09-20',
            storageLocation: '仓库A区-02号货架',
            lastCheckDate: '2026-09-01',
            status: 'warning',
            warningReason: '库存不足预警'
        },
        {
            id: 'mat_pesticide_001',
            name: '苦参碱水剂（0.5%）',
            category: '农药',
            categoryCode: 'PESTICIDE',
            unit: 'L',
            stock: 120,
            minStock: 50,
            maxStock: 300,
            price: 45,
            priceUnit: '元/L',
            supplier: '南京红太阳股份有限公司',
            contactTel: '025-8****999',
            expirationDate: '2026-12-30',
            storageLocation: '仓库B区-03号柜',
            lastCheckDate: '2026-09-01',
            status: 'normal'
        },
        {
            id: 'mat_material_001',
            name: '苹果包装箱（10kg装）',
            category: '包装材料',
            categoryCode: 'PACKAGING',
            unit: '个',
            stock: 2500,
            minStock: 1000,
            maxStock: 5000,
            price: 8.5,
            priceUnit: '元/个',
            supplier: '天水裕华包装有限公司',
            contactTel: '0535-6****111',
            expirationDate: '2029-09-30',
            storageLocation: '仓库C区-平面堆放',
            lastCheckDate: '2026-09-01',
            status: 'normal'
        }
    ],

    // ========== 追溯数据 ==========
    traceBatches: [
        {
            id: 'trace_20260601_001',
            batchCode: 'SF20260601001',
            variety: '花牛苹果',
            grade: '一级果',
            weight: 5000,
            weightUnit: 'kg',
            boxCount: 500,
            harvestDate: '2026-09-01',
            harvestPlot: 'A1地块',
            packDate: '2026-09-02',
            validUntil: '2026-09-15',
            storageTemp: 2,
            storageTempUnit: '°C',
            traceCode: '69 123456 789012 8',
            qrCodeUrl: '/trace/qr/SF20260601001.png',
            blockchainHash: '0x7f2e8a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f',
            status: 'in_stock',
            statusName: '库存中'
        },
        {
            id: 'trace_20260528_003',
            batchCode: 'SF20260528003',
            variety: '花牛苹果',
            grade: '特级果',
            weight: 2000,
            weightUnit: 'kg',
            boxCount: 200,
            harvestDate: '2026-09-28',
            harvestPlot: 'B1地块',
            packDate: '2026-09-29',
            validUntil: '2026-09-10',
            storageTemp: 3,
            storageTempUnit: '°C',
            traceCode: '69 123456 789012 9',
            qrCodeUrl: '/trace/qr/SF20260528003.png',
            blockchainHash: '0x8e3f9b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0',
            status: 'sold',
            statusName: '已售',
            soldDate: '2026-09-02',
            soldTo: '天水振华商厦'
        }
    ],

    // ========== 预警数据 ==========
    alerts: [
        {
            id: 'alert_001',
            type: 'device',
            typeName: '设备预警',
            level: 'error',
            levelName: '紧急',
            title: '土壤传感器离线告警',
            content: 'C2区土壤监测传感器离线超过30分钟，请及时检查设备供电和网络连接',
            deviceId: 'device_sensor2',
            deviceName: '土壤监测传感器-C2区',
            location: 'C2区东南角',
            createTime: '2026-09-12 14:30:00',
            duration: 720,
            durationUnit: '分钟',
            status: 'pending',
            statusName: '待处理',
            handler: '',
            handleTime: null
        },
        {
            id: 'alert_002',
            type: 'plot',
            typeName: '农事预警',
            level: 'warning',
            levelName: '警告',
            title: '病虫害风险预警',
            content: 'C2地块轮纹病风险指数升至80%，已达到防治阈值，建议3天内进行防治作业',
            plotId: 'plot_c2',
            plotName: 'C2地块（花牛苹果区）',
            diseaseName: '轮纹病',
            riskLevel: 80,
            createTime: '2026-09-11 09:15:00',
            status: 'pending',
            statusName: '待处理',
            handler: '王师傅',
            handleTime: null,
            suggestion: '建议使用多菌灵或甲基托布津进行喷雾防治'
        },
        {
            id: 'alert_003',
            type: 'material',
            typeName: '库存预警',
            level: 'warning',
            levelName: '警告',
            title: '农资库存不足告警',
            content: '硫酸钾库存仅剩8.2吨，低于安全库存10吨，请及时采购',
            materialId: 'mat_fertilizer_002',
            materialName: '硫酸钾',
            currentStock: 8.2,
            minStock: 5,
            unit: '吨',
            createTime: '2026-09-10 16:00:00',
            status: 'pending',
            statusName: '待处理',
            handler: '',
            handleTime: null
        },
        {
            id: 'alert_004',
            type: 'device',
            typeName: '设备预警',
            level: 'warning',
            levelName: '警告',
            title: '监控摄像头画面异常',
            content: 'C1区西南角摄像头画面被遮挡，请检查设备状态',
            deviceId: 'device_camera2',
            deviceName: '高清监控摄像头-C1区西南角',
            location: 'C1区西南角',
            warningReason: '画面遮挡告警',
            createTime: '2026-09-12 08:00:00',
            status: 'pending',
            statusName: '待处理',
            handler: '',
            handleTime: null
        }
    ],

    // ========== 销售数据 ==========
    salesData: [
        {
            id: 'sale_001',
            orderNo: 'SO20260602001',
            batchCode: 'SF20260528003',
            variety: '花牛苹果',
            grade: '特级果',
            quantity: 2000,
            quantityUnit: 'kg',
            unitPrice: 12.5,
            unitPriceUnit: '元/kg',
            totalAmount: 25000,
            customerName: '天水振华商厦',
            customerTel: '0535-6****888',
            deliveryDate: '2026-09-02',
            deliveryAddress: '天水市芝罘区胜利路208号',
            traceCode: '69 123456 789012 9',
            status: 'completed',
            statusName: '已完成'
        },
        {
            id: 'sale_002',
            orderNo: 'SO20260605002',
            batchCode: 'SF20260601001',
            variety: '花牛苹果',
            grade: '一级果',
            quantity: 3000,
            quantityUnit: 'kg',
            unitPrice: 8.8,
            unitPriceUnit: '元/kg',
            totalAmount: 26400,
            customerName: '济南银座商城',
            customerTel: '0531-8****666',
            deliveryDate: '2026-09-06',
            deliveryAddress: '济南市历下区泺源大街99号',
            traceCode: '69 123456 789012 8',
            status: 'pending',
            statusName: '待发货'
        }
    ],
    
    getPlots: function(callback) {
        setTimeout(function() {
            callback(null, {
                code: 200,
                message: 'success',
                data: VRAPI.plots
            });
        }, 300);
    },
    
    getPlotById: function(id, callback) {
        setTimeout(function() {
            var plot = VRAPI.plots.find(function(p) { return p.id === id; });
            if (plot) {
                callback(null, {
                    code: 200,
                    message: 'success',
                    data: plot
                });
            } else {
                callback({ code: 404, message: 'Plot not found' }, null);
            }
        }, 200);
    },
    
    getDevices: function(callback) {
        setTimeout(function() {
            callback(null, {
                code: 200,
                message: 'success',
                data: VRAPI.devices
            });
        }, 300);
    },
    
    getDeviceById: function(id, callback) {
        setTimeout(function() {
            var device = VRAPI.devices.find(function(d) { return d.id === id; });
            if (device) {
                callback(null, {
                    code: 200,
                    message: 'success',
                    data: device
                });
            } else {
                callback({ code: 404, message: 'Device not found' }, null);
            }
        }, 200);
    },
    
    getTasks: function(callback) {
        setTimeout(function() {
            callback(null, {
                code: 200,
                message: 'success',
                data: VRAPI.tasks
            });
        }, 300);
    },
    
    getTaskById: function(id, callback) {
        setTimeout(function() {
            var task = VRAPI.tasks.find(function(t) { return t.id === id; });
            if (task) {
                callback(null, {
                    code: 200,
                    message: 'success',
                    data: task
                });
            } else {
                callback({ code: 404, message: 'Task not found' }, null);
            }
        }, 200);
    },
    
    getBuildings: function(callback) {
        setTimeout(function() {
            callback(null, {
                code: 200,
                message: 'success',
                data: VRAPI.buildings
            });
        }, 300);
    },
    
    getBuildingById: function(id, callback) {
        setTimeout(function() {
            var building = VRAPI.buildings.find(function(b) { return b.id === id; });
            if (building) {
                callback(null, {
                    code: 200,
                    message: 'success',
                    data: building
                });
            } else {
                callback({ code: 404, message: 'Building not found' }, null);
            }
        }, 200);
    },
    
    getAlerts: function(callback) {
        setTimeout(function() {
            var alerts = VRAPI.devices
                .filter(function(d) { return d.status === 'warning' || d.status === 'error'; })
                .map(function(d) {
                    return {
                        id: d.id,
                        type: 'device',
                        message: d.name + '状态异常',
                        level: d.status === 'warning' ? 'warning' : 'error',
                        time: new Date().toISOString()
                    };
                });
            
            var plotAlerts = VRAPI.plots
                .filter(function(p) { return p.status === 'warning' || p.status === 'error'; })
                .map(function(p) {
                    return {
                        id: p.id,
                        type: 'plot',
                        message: p.name + (p.status === 'warning' ? '病虫害风险中等' : '病虫害风险高'),
                        level: p.status,
                        time: new Date().toISOString()
                    };
                });
            
            callback(null, {
                code: 200,
                message: 'success',
                data: alerts.concat(plotAlerts)
            });
        }, 200);
    },
    
    getSceneData: function(sceneId, callback) {
        setTimeout(function() {
            var sceneData = vrHotspotsData.getSceneById(sceneId);
            if (sceneData) {
                callback(null, {
                    code: 200,
                    message: 'success',
                    data: sceneData
                });
            } else {
                callback({ code: 404, message: 'Scene not found' }, null);
            }
        }, 200);
    },
    
    getAllSceneIds: function(callback) {
        setTimeout(function() {
            callback(null, {
                code: 200,
                message: 'success',
                data: vrHotspotsData.getAllSceneIds()
            });
        }, 100);
    }
};