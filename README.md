# 最小测试站（阶段 1 交付）

零依赖静态站点，源文件为两个 HTML 页面。`prepare.mjs` 只检查内联脚本语法并复制到 `dist/`，无需安装依赖。

| 文件 | 作用 |
|---|---|
| `index.html` | 能力自检页（六项检查 + 降级行为演示），逐项记录结论 |
| `tool-test.html` | 独立工具页模拟（参数直达/刷新保持、localStorage 持久化、复制/分享降级） |
| `测试记录.md` | 阶段 2 实测记录模板 |

## 本地验证

请使用 HTTP 服务验证，直接双击的 `file://` 环境不能代表部署后的路径、存储与剪贴板行为。在本目录执行：

```bash
node prepare.mjs
python3 -m http.server 8000 --directory dist
# 打开 http://localhost:8000/ 和 http://localhost:8000/tool-test.html?r=persona-01
```

## 部署到 ChatGPT Sites

1. `.openai/hosting.json` 声明 Site 标识与静态目录 `dist`，复用已有标识，不重复创建 Site。
2. 通过 Sites 工作流同步源文件，使用对应提交的静态产物打包，再保存 Site 版本。仅保存不等于已部署。
3. 阶段 1 停在可审阅版本；阶段 2 部署后，再测试公开访问与其余五项能力。
4. 按 `测试记录.md` 保存实际地址、测试环境及观察结果。未测试的项目保留“待实测”。

仅 `dist/` 中的两个 HTML 页面进入静态部署产物，README 与测试记录不作为公开网页发布。

独立工具页只有在带有效参数并完成刷新后才判定参数保持；无参数不判通过。切换到新的带参链接会重建基准；sessionStorage 不可用时改为人工核对，其他检查继续运行。

注意：Sites 的"保存版本"与"部署"是两个步骤；公开访问权限以账号实际界面为准。
