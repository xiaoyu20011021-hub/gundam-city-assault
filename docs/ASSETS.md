# 本地素材与来源

本项目的城市模型、道路模型和音效来自 Kenney，均采用 **Creative Commons Zero (CC0-1.0)**。原始许可证保存在 `public/assets/licenses/`。游戏只请求本地素材，不使用 CDN、远程贴图或在线声音。

| 素材包 | 官方来源 | 本地内容 |
| --- | --- | --- |
| City Kit Commercial 2.1 | https://kenney.nl/assets/city-kit-commercial | 10 款 GLB 楼宇和原始颜色贴图 |
| City Kit Roads 2.1 | https://kenney.nl/assets/city-kit-roads | 7 款 GLB 道路、交通灯、路牌和原始颜色贴图 |
| Sci-fi Sounds 1.0 | https://kenney.nl/assets/sci-fi-sounds | 光束、枪声、军刀、推进、爆炸、波次提示 |
| Impact Sounds 1.0 | https://kenney.nl/assets/impact-sounds | 金属受击、热能斧、脚步 |

资源于 **2026-10-11** 从官方免费 ZIP 下载。`public/assets/manifest.json` 记录官方页面、下载地址、原始文件名、本地文件名以及完整 ZIP 的 SHA-256。仅保留实际使用的 GLB、贴图、音效和许可证；不发布整包 ZIP、多余格式或样例图。

## 音效映射

| 游戏文件（`public/assets/audio/`） | 原始文件 |
| --- | --- |
| `beam.ogg` | Sci-fi Sounds / `laserLarge_000.ogg` |
| `machinegun.ogg` | Sci-fi Sounds / `laserRetro_000.ogg` |
| `saber.ogg` | Sci-fi Sounds / `forceField_000.ogg` |
| `boost.ogg` | Sci-fi Sounds / `thrusterFire_000.ogg` |
| `explosion.ogg` | Sci-fi Sounds / `explosionCrunch_000.ogg` |
| `wave.ogg` | Sci-fi Sounds / `computerNoise_000.ogg` |
| `impact.ogg` | Impact Sounds / `impactMetal_medium_000.ogg` |
| `axe.ogg` | Impact Sounds / `impactMetal_heavy_000.ogg` |
| `step.ogg` | Impact Sounds / `impactMetal_light_000.ogg` |

`machinegun.ogg` 是经过事件选用的复古科幻枪声；`axe.ogg` 为金属重击声。所有文件保留原始音频数据，仅重命名。音量和播放速率由游戏音效模块控制。

## 地图素材接口

`src/content/maps/city.ts` 在 `CITY_BUILDINGS` 中定义楼宇模型、位置、宽深和高度，并从同一份数据生成 `CITY_COLLIDERS`，避免画面与碰撞范围漂移。地图边界为 X/Z `[-130, 130]`，高达出生点为 `(0, 55)`；主路宽 26，中央广场为 52×52，可容纳六单位高的 SD 机体和肩后镜头。

GLB 使用 `GLTFLoader` 从本地读取。重复模型按几何及材质建立 `InstancedMesh`；道路、绿化及边界细节也进行实例化。楼宇为实体掩体，路牌、灯杆和绿化为装饰。场外楼宇组成天际线，不加入战场碰撞。

地图加载逐项报告进度。必需 GLB/贴图失败会抛出中文错误，交给界面提示重试；不会用替代方块悄悄掩盖丢失资源。地图 `dispose()` 可重复调用，并释放几何、材质及贴图。

## 恢复或更新资源

首次检出已包含所有运行资源，不需要执行下载脚本。维护时可以运行：

```powershell
node scripts/download-assets.mjs
```

脚本从已记录的官方 ZIP 恢复选定文件并检查 SHA-256；发现 ZIP 内容变更时停止。升级素材版本应先检查官方包，再显式更新清单和对应校验值。Windows 使用系统 PowerShell 解压，macOS/Linux 需要 `unzip`。

机体、武器和动画为项目内可编辑的程序几何，城市铺装细节、树木和边界构件也由项目源码构造。

Three.js 运行时采用 MIT 许可证，原文另存于 `public/assets/licenses/three-MIT.txt`，构建时随本地资源一起保留。
