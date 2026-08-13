# PC 管理端接口

PC 管理端与 APP 共用 `CKZS_API`、MySQL 和 MQTT。登录继续使用 APP 的登录接口，管理员业务使用 `/api/admin` 路由。

## 鉴权

```http
Authorization: Bearer <token>
```

管理员接口会实时校验数据库中用户的 `role` 是否为 `admin`。普通 APP 用户访问时返回 `403`。

## 接口列表

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| POST | `/api/users/login` | APP 与 PC 共用登录 |
| GET | `/api/admin/dashboard` | 全平台统计和最近更新设备 |
| GET | `/api/admin/users` | 用户分页、账号和角色搜索 |
| GET | `/api/admin/users/:id/devices` | 查看指定用户绑定设备 |
| GET | `/api/admin/devices` | 全部设备分页与状态筛选 |
| POST | `/api/admin/devices` | 登记未绑定硬件 |
| PUT | `/api/admin/devices/:id` | 修改设备名称和类型 |
| DELETE | `/api/admin/devices/:id` | 永久删除未绑定设备 |
| POST | `/api/admin/devices/:id/bind` | 将设备分配给 APP 用户 |
| POST | `/api/admin/devices/:id/unbind` | 解除设备与 APP 用户绑定 |
| POST | `/api/users/resetPassword` | 管理员重置用户密码 |
| POST | `/api/devices/command` | 单设备指令及回执 |
| POST | `/api/devices/batchCommand` | 多设备异步批量指令 |

设备分配、解绑会直接修改 APP 所读取的 `devices.userId`、`status` 和 `bindAt` 字段，因此两端数据一致，不需要复制或同步两份设备数据。

删除设备前必须先解绑。删除成功后，设备记录及其设备分组关联将被永久移除。
