产品需求文档：https://my.feishu.cn/wiki/I8MHwSNPeigXhDksn3xcwf8vn2g?from=from_copylink

- DeepSeek
    - 常见的语义识别，前端搜索演出
    - 每一个演出生成一句话的推荐理由
    - 根据 OCR 识别的票根文字解析出演出场次，并根据演出场次生成回忆
- OCR
    - 接入腾讯云的“通用文字识别（高精度版）”，在腾讯云建立云函数解决跨域问题

后续实现：
- LangChain：一个开源的大模型应用开发框架，专门帮你把 LLM（比如 DeepSeek、GPT）和各种工具 / 数据 / 记忆能力组合起来，做成复杂的 AI 应用
- Dify：一个可视化的 LLM 应用开发平台（也开源），主打 “低代码 / 零代码” 做 AI Agent 和对话应用
