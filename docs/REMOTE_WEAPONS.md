# 远隔武器复用说明

逻辑核心在 `src/gameplay/remote-weapons/`，不导入 Three.js、Actor、DOM 或机体 ID。`types.ts` 是主接口，`system.ts` 管理状态和伤害，`targeting.ts` 选敌，`motion.ts` 处理方向与站位。可变数量、多个所有者、不同阵营都通过数据配置。

## 给另一台可驾驶机体装浮游炮

1. 新建装备配置，类型使用 `RemoteWeaponConfig`；参考 `src/content/remote-weapons/nu-fin-funnel.ts`，指定装备 ID、模型键、挂点 ID 列表、生命/碰撞、武器 ID、移动和时序。数量由 `mountIds.length` 决定。
2. 在该机体的 `MechaDefinition.remoteWeapons` 中声明配置，在 Rig 的 `remoteMounts` 中提供对应的 Object3D 挂点。挂点随躯干更新，局部坐标前向为 -Z，Y 向上。
3. 若模型不同，新增工厂并注册到 `src/content/remote-weapons/view.ts` 的 `REMOTE_MODELS`。工厂接收调用方持有的 `GeometryResources`，返回 `{root,muzzle,setDeployment}`；内部不可释放共享资源。当前炮口约定为根节点沿局部 -Z 偏移 0.3。
4. 如需整备库完整收纳外观，提供 `stowedRemoteModels`；进入战斗时由 Runtime 隐藏这些展示副本，世界空间 View 渲染对应的真实装备。被击毁的炮不会显示副本。
5. 常规新增可驾驶机体还需注册机体、菜单元数据和武器模型工厂，见 `content/mechas/index.ts`、`playable.ts`。第一人称的手持模型与浮游炮逻辑独立。

不必修改 Game 中的浮游炮状态机，也不必复制牛高达类。屏障、线控牵引和自爆武器具有不同规则，需要额外行为设计。

## 核心 API

- `attach(ownerId, team, config)`：仅在新装备/新出击时生成完整单元；不要在暂停、切视角或换波次时调用。
- `step(dt, context)`：传入所有者、挂点、目标快照，以及视线、安全运动、实际发射回调。只有实际成功发射才消费发射预算。
- `applyDamage(id, damage)`：独立扣血，0 血转为本次 attach 内不可逆的 destroyed。
- `isAlive(id)`：无快照分配的实时可受击检查，用于同一步中多枚弹丸连续命中。
- `snapshot(ownerId?)`：返回脱离内部对象的状态副本，供显示和诊断使用。
- `drainEvents()`、`detachOwner(ownerId)`、`clear()`：消费事件、移除死亡母机装备、清理整场。

`adapter.ts` 把 Actor、挂点、导航和 ProjectileSystem 接到核心，并输出可受击目标和归位事件；`navigation.ts` 以膨胀建筑盒验证整个运动线段，失败时等待。`ai-targeting.ts` 负责敌人射击浮游炮，独立于敌机追击母机的移动决策。

## 生命期约束

回收和架上冷却保留血量；destroyed 不进入其他状态。一次战役多个波次使用同一个 Runtime，整场重开才销毁并重新创建。母机死亡同步 detach，炮损失不发送机体 defeated 事件，不改变任务敌机计数。View 在世界空间下独立渲染，第一人称隐藏母机时不隐藏离架炮；每个所有者/装备的模型资源独立引用计数，重复挂载和销毁可释放旧资源。

核心测试见 `tests/remote-weapons.test.ts`；真实弹丸、导航、AI、资源及游戏生命期测试分别位于 `remote-projectiles`、`remote-navigation`、`remote-ai-targeting`、`remote-adapter` 和 `nu-game` 测试文件。
