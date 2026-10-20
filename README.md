# 脑洞研究所 · OddLab

**简体中文** | [English](README.en.md)

今天，来点不一样的。一个打开就能玩的小游戏与日常灵感小站，从十几秒的小抽签，到需要认真想一想的双龙送货谜题。

**[在线试玩](https://perry-lynn.github.io/oddlab/?lang=zh)** · [双龙调度局](https://perry-lynn.github.io/oddlab/dispatch/?lang=zh) · [1024 作品介绍](docs/showcase/1024Builder作品秀-脑洞研究所.md)

![脑洞研究所首页](1024Builder作品秀配图/01-home-desktop.png)

## 可以玩什么

| 玩法 | 内容 |
| --- | --- |
| 双龙调度局 | 为两条能力不同的龙分配货物、规划路线，在载重、天气、体力和期限限制下完成派送并回家。共五关，支持计划预演、撤回和逐回合执行。 |
| 你的离谱人格 | 六道趣味题，两套题库、16 种虚构人设，还能改变一个答案预览结果。纯属娱乐。 |
| 平行人生模拟器 | 五个故事世界，每次走过三幕，选择影响资源和结局；另有结局图鉴与 12 份人生档案。 |
| 今天听天由命 | 直接抽签，或让 2–16 个候选逐组比较；可以把结果收进本机抉择合集。 |
| 今日奇怪任务 | 每天一件小事，每件有两种做法，配有本机任务册、连续打卡和本周挑战。 |

页面底部还有 1024 小彩蛋「鸭子调试室」：检查三个用日常语言写的“程序”，找问题、选修复，生成趣味 commit 文案。

网站默认简体中文，也支持英文、日文和西班牙文。网址中的 `?lang=zh|en|ja|es` 优先于已保存的语言偏好；游戏中的语言切换会保留当前进度。README 的语言切换只切换说明文档。

## 本地运行

需要 **Node.js 24 或以上版本**。游戏运行时没有第三方包依赖，以下静态预览流程无需安装依赖。

```bash
npm test
npm run build:pages
npm run verify:pages
npm run preview:pages
```

浏览器打开 [http://127.0.0.1:8788/oddlab/](http://127.0.0.1:8788/oddlab/)。

`npm test` 包含内容、页面、Worker、调度规则和小游戏的六段校验；Worker 测试通过兼容 D1 的适配器使用真实内存 SQLite。

## 部署到 GitHub Pages

公开 Demo 使用独立静态构建，输出目录为 `dist-pages/`。推送到 `main` 后，GitHub Actions 会运行测试、构建、静态校验并部署。首次配置仓库时，在 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。

构建到当前正式地址时，使用相同参数完成构建和校验：

```bash
export ODDLAB_BASE=/oddlab/
export ODDLAB_ORIGIN=https://perry-lynn.github.io
export ODDLAB_PAGES=1
export ODDLAB_DEFAULT_LANG=zh
npm run build:pages
npm run verify:pages
```

部署到其他仓库时调整路径和域名；现有工作流会根据仓库信息自动推导它们。

- 每个公开路由生成独立的 `index.html`，支持直接访问、刷新和分享链接。
- 导航、图片、模块、语言包及 canonical 等地址均适配仓库子路径。
- `?level=first|return|market|festival|storm` 选择调度关卡；分享链接只包含公开关卡和语言，不包含玩家路线或货物分配。
- Pages 不提供 `/api/track`、管理后台或 D1 统计，也不发布 Worker、数据库和内部测试页面；浏览器统计上报在此构建中关闭。

## 语言、进度与隐私

公开小游戏不需要注册。人格答案、人生冒险和候选比较等进行中状态在页面内存中处理；自定义候选、答案和路线不会上传。任务记录、部分结局图鉴和抉择合集保存在当前浏览器，不跨设备同步。每日任务按 UTC+8 零点轮换。

分享链接可以恢复受支持的公开结果；冒险过程、候选比较进度和自定义候选不会编码进邀请链接。原生分享是否可用取决于设备和浏览器，复制失败时会选中文本供手动复制。

动效使用原生 CSS 和 Web Animations，不驱动游戏规则。撤回、重开或新的交互会取消正在播放的调度动画，并尊重系统的“减少动态效果”设置。

## 源码结构

```text
.
├── src/          应用源码与玩法模块
├── public/       页面模板、样式、图标、图片与四语内容包
├── tests/        回归校验与原始数据样本
├── scripts/      构建、校验和本地预览脚本
├── docs/         作品介绍、发布和测试记录
├── previews/     设计提案与旧诊断页面
├── worker/       独立 Worker 后端源码
├── db/           数据库定义
└── drizzle/      数据库迁移
```

已公开引用的作品截图保留在 `1024Builder作品秀配图/`，避免旧帖子图片链接失效。`dist/`、`dist-pages/` 和 `worker/index.js` 为构建产物，不纳入版本控制。

| 文件 | 职责 |
| --- | --- |
| `src/app.js`、`src/logic.mjs` | 路由、原有人格计分与档案恢复、每日任务和分享回退。 |
| `src/games-content.mjs`、`src/games-logic.mjs`、`src/games-ui.mjs` | 人生分支、人格预览、候选比较、每日任务的内容、规则和界面。 |
| `src/dispatch-logic.mjs` | 可独立验证的双龙调度规则、不可变状态推演、货物交接与载重检查。 |
| `src/dispatch-ui.mjs`、`src/dispatch-copy.mjs` | 调度地图、执行反馈和四语文案。 |
| `src/i18n.mjs`、`src/ui-catalog.mjs`、`public/locales/` | 语言选择、界面翻译和四语内容包。修改内容时同步维护各语言包。 |
| `src/hosting.mjs`、`src/page-content.mjs` | 部署路径适配，以及首屏 HTML、玩法说明和可抓取页面内容。 |
| `scripts/build-pages.mjs`、`tests/verify-pages-build.mjs` | Pages 静态构建与产物检查。 |
| `worker/runtime.mjs`、`db/`、`drizzle/` | 独立 Sites/Worker 版本的请求处理、数据库定义和迁移。 |

调度美术的来源、尺寸和体积约定见 [素材说明](public/assets/dispatch/README.md)；公开图片由 `src/dispatch-assets.mjs` 中的白名单控制。

## 独立 Sites / Worker 构建

仓库还保留原有 Sites 项目；它与 Pages 静态部署独立。使用现有 `.openai/hosting.json`，无需新建替代项目。

```bash
npm run build
npm run preview
```

构建输出 `dist/server/index.js` 与 `dist/.openai/hosting.json`；预览地址为 `http://127.0.0.1:8765`，本地 SQLite 文件位于 `/private/tmp`，不会随代码部署。打包时包含 `drizzle/` 迁移，由平台提供 `DB` 绑定并执行迁移；已经部署的迁移文件保持不变，后续变更新增迁移。仅开发用的数据库工具需要按 `pnpm-lock.yaml` 安装依赖。

此版本的统计只记录汇总页面访问和点击，不读取答案、候选文本或路线；汇总数据没有自动过期机制，平台可能另有访问日志。重复点击也会计数，因此不代表独立访客数。

`/admin`、旧 `/stats` 和 `/api/stats` 同时要求平台身份头及服务端 `ADMIN_EMAIL` 精确匹配。密钥由平台配置，不写入源码。公开游戏不要求登录。

## 页面与搜索

构建为公开路由生成首屏 HTML、独立标题、描述、canonical、四语 hreflang 和 sitemap。中文 canonical 省略 `lang=zh`；其他语言保留语言参数。受保护页面、API、结果链接和旧测试页不列入索引。搜索平台收录尚未确认。

欢迎通过 [GitHub Issues](https://github.com/Perry-Lynn/oddlab/issues) 反馈问题，附上玩法、复现步骤、设备和浏览器即可。
