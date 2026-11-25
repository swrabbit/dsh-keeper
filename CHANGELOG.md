# 更新日志

DSH 管家（`dsh-keeper-plugin`）的版本变更记录。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)。

## [0.1.4] - 2026-11-25

### 新增

- 设置页新增「删除会话行为」二选一：`移入回收站`（默认，可恢复）或 `永久删除`；列表里的「删除会话」按钮按此设置执行。
- 永久删除模式下，列表删除会先弹二次确认（可在设置中关闭确认）。

### 变更

- 回收站的「彻底删除」和「清空回收站」补齐与永久删除相同的清理步骤：会话日志目录、官方投影缓存、spill 目录、工作区挂载、归档/置顶标记与索引记录，并广播 `api-session/removed` 事件。
- 永久删除会级联删除 `origin: "subagent"` 且 `parentSession` 指向该会话的子会话；fork 会话不级联。

### 修复

- 修复 DSH 管家自身在「插件管理」中可被卸载的问题：客户端隐藏自身的卸载入口，服务端 `uninstallPlugin` 对自身返回 `PROTECTED`。

## [0.1.3] - 2026-11-14

### 变更

- 放宽 DSH 版本要求为 `engines.dsh: ">=0.2.2-rc.1"`；0.3 及之后未逐版验证。

## [0.1.2] - 2026-11-13

### 变更

- README 移除本地开发日志相关说明（`docs/DEVELOPMENT.md` 不随仓库发布）。

## [0.1.1] - 2026-11-13

### 变更

- README 与仓库实际内容同步。

## [0.1.0] - 2026-11-12

### 新增

- 首个公开版本：工作区会话管理、通知管理、插件与侧栏入口管理、回收站。
- 发布到 npm（`dsh-keeper-plugin`）与 GitHub（`swrabbit/dsh-keeper`）。
