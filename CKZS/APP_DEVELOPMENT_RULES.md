# App 开发规范

## 样式兼容性

- App（Uni-app）页面禁止新增 CSS `gap` 属性。部分移动端 WebView 对 `flex gap` 支持不一致，会导致间距丢失。
- 相邻元素的间距使用 `margin-left`、`margin-right`、`margin-top` 或 `margin-bottom` 明确实现；首尾元素按需用父容器或首尾选择器处理。
- 修改现有样式时，如发现 `gap`，优先在改动范围内替换为明确的 `margin`，不要为了清理而扩大修改范围。
