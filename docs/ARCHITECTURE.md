# 模块与扩展

## 运行结构

`src/main.ts` 创建 Game。core 提供 WebGL 渲染、输入、事件和音效；gameplay 负责移动、碰撞、镜头、攻击、AI、特效与任务；content 保存机体、武器和地图定义；ui 提供菜单和 HUD。

HTML 只负责画布、界面根节点和模块入口，游戏逻辑不写在 HTML 中。

Game 负责生命周期与模块编排，固定 60 Hz 推进模拟，独立渲染。暂停、页面失焦、鼠标解锁时停止模拟并清空输入。伤害、击破、射击与波次由 EventBus 传递给音效和 HUD。

## 添加机体

1. 在 content/mechas 新建机体模型工厂，返回 MechaRig。局部前方为 -Z，脚底为 y=0。
2. 提供 head、torso、leftArm、rightArm、leftLeg、rightLeg 关节，muzzle 与 bladeTip 挂点，以及 setWeapon、animate、dispose。
3. 创建 MechaDefinition，填写属性和武器 ID，在 MECHA_DEFINITIONS 注册。
4. 在地图波次中使用机体 ID。Actor 使用定义构建机体，攻击逻辑不依赖模型内部网格。

绿色和夏亚扎古复用同一模型工厂；配色、角和属性独立配置。GeometryResources 在单个机体内共享并按材质合并静态分件，释放一台机体不会影响其他实例。所有动画从绑定姿态计算，避免逐帧累加漂移。

## 添加武器

在 content/weapons 的 WEAPON_DEFINITIONS 注册武器：ID、类型、伤害、冷却、射程、速度、颜色和过热/弹匣属性。武器模型为独立模块，通过机体的挂点装配。

远程武器使用有限寿命弹丸；每个模拟步检查完整移动线段，最先遇到的建筑或敌方机体阻挡弹丸。步枪先从镜头取得瞄准点，再从枪口发射，枪口被掩体遮挡时弹丸撞击掩体。近战结合有效攻击阶段、扇形距离、遮挡和命中集合。

## 添加地图

在 content/maps 新建 MapDefinition，包括 bounds、playerSpawn、enemySpawns、waves 和 createWorld，并加入 mapRegistry。将注册的定义作为 Game 的第三个构造参数传入即可切换地图；省略时默认城市。createWorld 返回场景根节点、矩形建筑碰撞体和 dispose。

地图布局和碰撞共享同一建筑尺寸数据。AI 的 A* 导航网格保留机体半径与额外安全间距；移动按小步分轴处理，以防推进穿墙并允许沿墙滑动。首版不实现可破坏建筑或楼顶攀登。

新地图的 GLB、纹理和音效放入 public/assets；保留来源与原始许可。GLTF 及其纹理加载失败会触发明确的重试界面。

## 资源与性能

楼宇和道路按原型实例化；机体内部复用几何与材质；弹丸和粒子为固定容量对象池。结束/重开释放旧机体、清空弹丸/特效；离开页面释放地图的几何、材质、纹理、实例缓冲、音频和 WebGL 资源。

浏览器本地存储只保存画质、静音偏好及最佳积分；拒绝 localStorage 不影响作战。地图和音效不依赖外部 CDN。
