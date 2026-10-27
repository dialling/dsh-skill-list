# dsh-skill-list

> DeepSeek Harness 插件：会话顶部一个 chip，列出当前会话能用的**全部技能**，可搜索、按来源分类、点一下把 `/技能名` 插进输入框。
>
> A tiny DSH plugin that lists every skill available to the current session — search, group by source, click to insert the slash command.

## 它做什么

- **列出真实目录**：面板数据来自会话控制器的 `skills/list`，与模型看到的 `<available_skills>` 同源，不是插件自己扫目录猜出来的
- **搜索**：一个输入框同时匹配 `name` 与 `description`（大小写不敏感）
- **按来源分类**：内置 / 用户 / 项目，按技能文件路径推断 —— 路径含 `node_modules` 记作「内置」，落在当前工作区的 `.dsh/skills`、`.agents/skills` 记作「项目」，其余记作「用户」
- **一键插入**：点条目 → 输入框变成 `/技能名 `，回车即加载该技能（走 composer 的插入接口，不覆盖你已输入的内容）
- **只看主线**：`origin === "subagent"` 的会话不列，避免把子智能体的临时技能混进目录
- **键盘**：`Esc`、点背景、`✕` 都关闭；`↻` 重新读取

## 只读

插件不写任何状态、不改技能文件、不发网络请求：只读技能清单 + 渲染面板。启用或停用它，只影响这个面板本身。

## 安装（本地挂载）

本插件以本地目录挂进 DSH profile，不需要发布到 npm：

```bash
git clone https://github.com/dialling/dsh-skill-list.git ~/Projects/dsh-skill-list

# 链进 profile（<profile> 通常为 web）
ln -s ~/Projects/dsh-skill-list "$DSH_HOME/profiles/web/node_modules/dsh-skill-list"
```

然后在 `$DSH_HOME/profiles/web/cordis.patch.yml` 末尾追加：

```yaml
# dsh-skill-list: local chip that lists the session skill catalog
- insert:
    - id: dsh-skill-list
      name: 'dsh-skill-list'
```

重启 DSH（客户端 bundle 在启动时注入），会话顶部就会出现这个 chip。

## 结构

| 文件 | 作用 |
|---|---|
| `lib/index.js` | Node 侧，空 `apply()`：只为让插件出现在 profile Loader 里 |
| `client.js` | 浏览器侧：chip + 面板，CSS 沿用 DSH 主题令牌（`--dsw-alias-*`），明暗主题都自适配 |
| `check.mjs` | 离线自检：在 VM 沙箱里加载 `client.js`，断言模块契约、slot 注册、会话挑选、`skills/list` 数据路径、过滤与面板标记 |

自检需要本机装有 DSH Desktop（会借用它自带的 `react` / `react-dom`）：

```bash
DSH_PROFILE_DIR="$DSH_HOME/profiles/web" node check.mjs
```

## 兼容

- DSH `0.2.1-rc.2`
- 客户端注入：`connection`、`ui-slots`、`api-session-controller`、`api-remotes`

## License

MIT — 见 [LICENSE](LICENSE)。
