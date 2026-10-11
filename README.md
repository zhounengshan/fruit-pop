# 消灭水果

适配 iPhone、Android 和桌面浏览器的持续闯关水果消除游戏。

**在线试玩：** https://zhounengshan.github.io/fruit-pop/

## 玩法

- 点击两个或更多相邻的同类水果进行消除。
- 经典清盘、水果订单、宝箱营救、丰收接力、步数挑战轮换，每10关挑战巨兽。
- 20种水果逐步解锁至第200关，之后仍轮换出场；每盘4～6种，兼顾变化与可消性。
- 一次消除6/10/20/30个分别生成十字火箭、炸弹、超级炸弹、彩虹；波及特效会接力引爆。
- 每关两次破局锤子和三次重排，帮助处理单个水果与障碍。订单等任务关持续补充水果。
- 积分跨关累计，经典清盘剩余越少奖励越高，有限步数关提前完成有额外奖励。
- 支持音效、通关鼓励、主屏幕安装和离线缓存。

## 开发验证

运行 `node tests/game.test.cjs`，检查1000关配置、20种水果轮换、旧存档兼容、下落数量守恒、特殊水果生成、连锁、关卡目标、步数和过期回调。

## 玩法研究参考

借鉴公开项目的机制思路，未复制其代码或美术资源：

- [samegame-engine](https://github.com/triqui/samegame-engine)：同色连片、重力整理与持续补充思路。
- [Match-3-Game](https://github.com/bakasladjan/Match-3-Game)：特殊方块、队列式连锁和分关目标。
- [Spring-Festival-Crush](https://github.com/banghuazhao/Spring-Festival-Crush)：目标与障碍的多样化组合。
