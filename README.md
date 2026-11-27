# 看图学英语（Scene English）

面向中国成年英语零基础学习者的纯前端英语学习网站。用户可以在卧室、厨房和超市三个完整生活场景中点击物品，学习单词、听发音、收藏或标记掌握，并完成三种练习。

## 功能

- 4 个统一风格的生活场景，共 140 个基础词汇
- JSON 驱动的词汇和独立热点坐标
- 点击热点打开单词卡片
- 浏览器 SpeechSynthesis 英语发音
- 听音选图、看图拼词、单词选择题
- 未学习、学习中、待复习、已掌握四级熟练度
- 1、3、7、15 天间隔复习与自动错题本
- 场景连续学习、普通/慢速发音和拼写提示
- 32 个生活短语与常见搭配
- 今日复习专页和复习日程
- 学习数据导出、导入和安全重置
- 首批独立透明物品插图及可扩展图片接口
- 收藏、学习进度、练习结果和最近学习记录
- localStorage 本地保存，刷新页面后进度不丢失
- 桌面、平板和手机响应式布局

## 本地运行

由于浏览器直接用 `file://` 打开页面时通常会拦截 JSON 请求，请在项目目录启动一个静态服务器。

### 使用 Python

```bash
python -m http.server 8000
```

然后访问：

```text
http://localhost:8000
```

也可以使用 VS Code Live Server 或任意静态文件服务器。

## 项目结构

```text
.
├── index.html                 # 首页
├── scene.html                 # 场景学习页（通过 ?scene= 切换）
├── practice.html              # 三类练习
├── review.html                # 今日复习和记忆日程
├── vocabulary.html            # 我的词汇
├──              # 纯场景插画，不含 UI
├──               # 独立透明物品插图
├── styles.css             # 统一设计系统与响应式样式
├── vocabulary.json       # 140 个词汇
├── hotspots.json         # 四个场景的热点百分比坐标
├── phrases.json          # 生活短语与关联词汇
└── 
    ├── app.js                 # 数据、进度、发音、弹窗等公共逻辑
    ├── home.js                # 首页
    ├── scene.js               # 场景学习
    ├── practice.js            # 练习
    ├── review.js              # 今日复习
    └── vocabulary.js          # 我的词汇
```

## 数据扩展

词汇记录包含 `id`、`scene`、`word`、`phonetic`、`meaning`、`example`、`exampleTranslation`、`image` 和 `hotspot`。其中 `hotspot` 是坐标配置键，实际 `x`、`y` 百分比坐标存放在 `hotspots.json`，因此替换背景图时只需调整热点文件。

新增场景时：

1. 将纯场景图片放进 ``。
2. 在 `app.js` 的 `SCENES` 中注册场景。
3. 在 `vocabulary.json` 添加词汇。
4. 在 `hotspots.json` 添加对应坐标。

## 数据保存

学习进度保存在浏览器 localStorage 的 `sceneEnglishProgressV1` 键中。新版会自动兼容并迁移旧版收藏、掌握、待复习和练习记录。每个单词会记录答题次数、正确次数、连续正确次数、错题次数、记忆阶段和下次复习时间；连续通过四个记忆阶段后进入“已掌握”。清除该站点的浏览器数据会重置学习记录。

## 兼容性说明

发音使用浏览器内置 Web Speech API。不同系统的英语语音音色可能略有差异；建议使用最新版 Chrome、Edge 或 Safari。
