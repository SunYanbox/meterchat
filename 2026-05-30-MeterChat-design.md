## 概述
MeterChat 是一款基于 Electron 的本地聊天软件，通过 OpenAI 兼容接口接入 DeepSeek 和硅基流动，提供对话、会话管理、消息级分叉、Token 消耗统计及本地数据加密保护。采用 TypeScript 全栈开发，渲染进程直接访问 Node.js 能力，SQLite 存储，Chart.js 绘制仪表盘图表，追求简单与实用。

---

## 一、整体架构
- **Electron**：主进程负责窗口创建与应用生命周期，所有业务逻辑运行在**渲染进程**中，通过预加载脚本暴露 Node.js 能力（模式 A）。
- **数据库**：SQLite + `better-sqlite3`，同步 API，数据本地存储。
- **前端界面**：纯 HTML/CSS/TypeScript，手动 DOM 操作，引入 Chart.js 绘制饼图和折线图。
- **API 调用**：渲染进程使用 `fetch` 发起请求，API Key 从加密存储中解密后使用。
- **加密**：Node.js 内置 `crypto`，AES-256-GCM，密钥由机器标识派生，基础保护级别。

### 项目结构
```
meterchat/
├── electron/            # 主进程代码
│   ├── main.ts
│   └── preload.ts
├── src/                 # 渲染进程业务逻辑
│   ├── db/              # 数据库层
│   ├── api/             # API 调用与 Token 计数
│   ├── encryption/      # 加密工具
│   ├── models/          # 数据模型定义
│   ├── ui/              # UI 模块（会话列表、对话区、仪表盘等）
│   └── renderer.ts      # 入口
├── static/              # HTML, CSS
│   └── index.html
├── package.json
└── tsconfig.json
```

---

## 二、数据库与数据模型设计

### 文件夹表 `folders`
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT (UUID) | 主键 |
| name | TEXT | 文件夹名称 |
| sort_order | INTEGER | 排序序号 |
| created_at | TEXT | ISO 时间 |
| updated_at | TEXT | ISO 时间 |

### 会话表 `conversations`
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT (UUID) | 主键 |
| folder_id | TEXT | 所属文件夹，可为 NULL（根目录） |
| title | TEXT | 会话标题 |
| system_prompt | TEXT | System Prompt 内容 |
| is_system_locked | INTEGER | 首次对话后置 1，禁止修改 |
| created_at | TEXT | ISO 时间 |
| updated_at | TEXT | ISO 时间 |

### 消息表 `messages`
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT (UUID) | 主键 |
| conversation_id | TEXT | 所属会话 |
| role | TEXT | user / assistant / system |
| content | TEXT | 消息内容 |
| model | TEXT | 使用的模型名称 |
| parent_id | TEXT | 父消息 ID，根消息为 NULL |
| branch_id | TEXT | 所属分支 ID |
| created_at | TEXT | ISO 时间 |

### Token 消耗记录表 `token_usage`
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT (UUID) | 主键 |
| message_id | TEXT | 关联的消息 |
| conversation_id | TEXT | 冗余，方便汇总查询 |
| model | TEXT | 模型名称 |
| prompt_tokens | INTEGER | 输入 Token |
| completion_tokens | INTEGER | 输出 Token |
| prompt_cache_hit_tokens | INTEGER | 输入缓存命中 |
| prompt_cache_miss_tokens | INTEGER | 输入缓存未命中 |
| created_at | TEXT | ISO 时间 |

### 提供商表 `providers`
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT (UUID) | 主键 |
| name | TEXT | 显示名称，如 "DeepSeek官方" |
| base_url | TEXT | API 接口地址 |
| is_enabled | INTEGER | 是否启用 |
| created_at | TEXT | ISO 时间 |

### 提供商密钥表 `provider_keys`
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT (UUID) | 主键 |
| provider_id | TEXT | 关联 providers.id |
| api_key | TEXT | **加密存储** |
| default_temperature | REAL | 默认温度参数（明文） |
| default_model | TEXT | 默认模型名（明文） |
| updated_at | TEXT | ISO 时间 |

- 预置两个提供商：DeepSeek (`https://api.deepseek.com/v1`) 和硅基流动 (`https://api.siliconflow.cn/v1`)。

---

## 三、消息分叉逻辑与分支管理

### 核心概念
- **分支**：从某条消息处分叉出的独立对话路径，一个会话可有多条分支。
- **分叉点**：用户选择“从此处分叉”的消息节点。
- **活跃分支**：当前查看/对话的分支，可切换。

### 数据结构
- `messages.branch_id` 标识消息所属分支，同一分支的消息共享相同 `branch_id`。
- 分叉点之前的消息被多个分支共享，它们的 `branch_id` 保持原分支 ID。

### 关键操作
**新会话**
- UI 展示两个输入框：System Prompt（默认“你是一位有帮助的助手”，可编辑）和 User 消息。
- 发送后，System Prompt 写入 `conversations.system_prompt`，`is_system_locked = 1`。
- API 请求 `messages` 数组 = `[system_prompt, 首条 user 消息]`。

**首次对话后**
- System Prompt 显示在对话区顶部（浅灰底色，不可编辑）。
- 所有后续请求均在 `messages` 第 0 位携带相同的 System Prompt。

**分叉**
- 在某条消息处选择“分叉” → 生成新的 `branch_id`，用户输入新消息作为新分支起点。
- System Prompt 沿用原会话，不可修改（`is_system_locked = 1`）。

**分支切换**
- UI 分支切换器列出所有可切换的分支，每个分支旁显示 Token 消耗概要（总输入/输出/缓存命中/未命中）。
- 切换后对话区刷新为该分支的消息链。

**构建 API 请求**
- `messages = [system_prompt] + 当前分支完整消息链（按 created_at 升序）`
- 长对话不手动截断，由 DeepSeek 分段缓存机制优化。
- System Prompt 始终第 0 位，内容不变，保证缓存前缀稳定。

**分支 Token 概要**
- 查询 `token_usage` 按 `branch_id` 聚合，显示在该分支切换器旁。

---

## 四、UI 布局与交互设计

### 整体布局（单窗口）
```
┌────────────────────────────────────────────────────┐
│  菜单栏  MeterChat                                  │
├──────────────┬─────────────────────────────────────┤
│  侧边栏      │  主内容区                            │
│ ┌──────────┐ │  ┌───────────────────────────────┐  │
│ │搜索框    │ │  │ 对话区 / 仪表盘               │  │
│ └──────────┘ │  └───────────────────────────────┘  │
│ ┌──────────┐ │                                     │
│ │文件夹树  │ │                                     │
│ │ 📁 工作  │ │                                     │
│ │ 📁 学习  │ │                                     │
│ │ 📄 会话1 │ │                                     │
│ └──────────┘ │                                     │
│ + 新建会话   │                                     │
│ [仪表盘]     │                                     │
└──────────────┴─────────────────────────────────────┘
```
- 左侧栏（~260px）：文件夹树 + 会话列表 + 搜索框，底部“仪表盘”按钮切换主内容区。
- 主内容区：默认显示对话界面，点击仪表盘则展示仪表盘页面。

### 左侧栏细节
- 搜索框：实时过滤会话，区分文件夹范围（文件夹内搜索仅限该文件夹，根目录搜全部）。
- 文件夹树：折叠/展开，右键菜单（新建、重命名、删除）。
- 会话列表：显示标题，右键菜单（重命名、移动至文件夹、删除）。
- 新建会话按钮：主内容区显示新会话界面（两个输入框）。

### 对话视图
```
┌──────────────────────────────────────────────┐
│ 会话标题 [可编辑]              [分支切换器▾] │
├──────────────────────────────────────────────┤
│  ┌─ System Prompt ─────────────────────┐     │
│  │ 你是一位有帮助的助手 (不可编辑)       │     │
│  └──────────────────────────────────────┘     │
│  ┌─ User ──────────────────────────────┐     │
│  │ 你好...                             │     │
│  └──────────────────────────────────────┘     │
│  ┌─ Assistant (deepseek-chat) ─────────┐     │
│  │ 好的...       [从此处分叉]           │     │
│  └──────────────────────────────────────┘     │
├──────────────────────────────────────────────┤
│  输入框                              [发送]   │
└──────────────────────────────────────────────┘
```
- System Prompt 顶部显示，不可编辑。
- 消息悬停时显示“从此处分叉”按钮。
- 分支切换器：下拉列出分支及 Token 概要，切换后刷新对话区。
- 新会话界面：两个输入框，发送后锁定 System Prompt。

### 仪表盘页面
```
┌──────────────────────────────────────────────┐
│ 仪表盘                    [返回对话] [关闭]   │
├──────────────────┬───────────────────────────┤
│ 统计卡片         │  饼图：按模型分布          │
│ 总会话数         │  (输入 Token 占比)         │
│ 总输入 Token     │                           │
│ 总输出 Token     │                           │
│ 缓存命中率       │                           │
├──────────────────┴───────────────────────────┤
│ 折线图：7天/30天/全部 Token 消耗趋势          │
├──────────────────────────────────────────────┤
│ 明细列表（分页）                             │
│ 日期 | 会话 | 模型 | 输入 | 输出 | 缓存命中   │
└──────────────────────────────────────────────┘
```
- 使用 Chart.js，饼图按模型统计，折线图可切换时间范围。
- 明细可点击跳转到对应会话。

---

## 五、加密与安全设计

### 加密目标
- 保护 API Key 防止明文泄露（基础保护），应用重启后无需手动解锁。

### 密钥派生
- 采集机器特征值：`hostname` + `username` + 固定盐值（硬编码）。
- 使用 `crypto.scrypt` 派生 256 位密钥。
- 每次加密生成随机 12 字节 IV（GCM 推荐）。

### 存储格式
- `provider_keys.api_key` 存储字符串：`base64(iv):base64(ciphertext):base64(authTag)`。

### 加密流程
1. 用户保存 API Key。
2. 生成随机 IV。
3. AES-256-GCM 加密。
4. 拼接并存入数据库。
5. 解密时从数据库读取，拆分，派生密钥解密。

### 安全边界
- 不防内存 dump、代码逆向、物理攻击，仅防止直接复制数据库文件获取明文 Key。

---

## 六、API 调用与 Token 计数

### 请求构建
- 使用 OpenAI Chat Completions 兼容格式：`POST {base_url}/chat/completions`
- `messages` 构建：`[system_prompt, ...branch_messages]`，严格按 `created_at` 升序。
- 参数：`model`、`temperature`（从 `provider_keys` 读取）、`stream: true`。

### 流式响应
- 使用 `fetch` + `ReadableStream` 逐块读取 SSE 数据。
- 实时更新 UI 中的 assistant 消息 content。
- 流结束时提取 `usage` 数据。

### Token 计数提取
- 从最后一个 chunk 的 `usage` 字段提取 `prompt_tokens`、`completion_tokens`、`prompt_cache_hit_tokens`、`prompt_cache_miss_tokens`。
- 非 DeepSeek 提供商缓存字段存 0。
- 缺失 usage 时记录警告，存 0。

### 缓存友好策略
- System Prompt 始终第 0 位且内容不变。
- 消息顺序严格保持，不手动截断。
- 分支切换时共享前缀仍可命中缓存。

### 错误处理
| 场景 | 处理 |
|------|------|
| 网络错误 | 提示“网络连接失败”，消息不保存 |
| 401/403 | 提示“API Key 无效” |
| 429 | 提示“请求过于频繁”并读取 Retry-After |
| 5xx | 提示“服务端错误” |
| 流中断 | 保留已接收内容，标记消息不完整 |
| usage 缺失 | 记录 0，不报错 |

---

## 七、技术选型与依赖清单

### 运行时
- Electron + TypeScript + Node.js (Electron 内置)

### 核心依赖
- `better-sqlite3`：SQLite 同步操作
- `chart.js`：仪表盘图表（饼图、折线图）

### 内置能力（无额外依赖）
- HTTP/SSE：`fetch` + `ReadableStream`
- 加密：`crypto` (AES-256-GCM, scrypt)
- UUID：`crypto.randomUUID()`
- UI：原生 HTML/CSS/TS，手动 DOM 操作
- 构建：`tsc` 编译

### 构建工具
- `typescript`、`electron-builder`

### package.json 依赖概览
```json
{
  "dependencies": {
    "better-sqlite3": "^11.x",
    "chart.js": "^4.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "electron": "^33.x",
    "electron-builder": "^25.x",
    "@types/better-sqlite3": "^7.x"
  }
}
```

---

## 八、规格自检
1. **占位符扫描**：无“待定”、“待办”等占位符。
2. **内部一致性**：架构描述与功能章节一致，加密存储字段与提供商表设计匹配，分叉逻辑与缓存策略不冲突。
3. **范围检查**：覆盖了所有需求（对话、会话管理、分叉、Token 计数、加密），单一实现计划可处理。
4. **歧义检查**：需求清晰，无二义性表述。
