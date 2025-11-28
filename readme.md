# koishi-plugin-gzctf-push

[![npm](https://img.shields.io/npm/v/koishi-plugin-gzctf-push?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-gzctf-push)

适配GZCTF平台的赛事播报插件

## GZCTF赛事订阅插件

对接CTF平台 [GZCTF]，在赛事期间能够推送一二三血信息、上新题目等事件。

每个群聊/个人可独立设置赛事推送信息。

**使用过程中有任何bug请联系✉️potatowo233@qq.com**

<details>
<summary>使用说明</summary>

插件包含唯一指令gz

## 设置赛事URL（--url）

命令格式：`gz -u <url>`

示例：`gz -u https://ctf.rois.team`

需注意url末尾不可留有斜杠

## 设置赛事（--game）

命令格式：`gz -g [id]`

示例1：`gz -g`，会根据第一步设置的URL来获取所有正在举办中的赛事，bot会响应赛事id和赛事标题，选择对应的id即可

示例2：`gz -g 2`，直接设置订阅的赛事

## 赛事信息推送（--start）

命令格式：`gz -s <flag>`

示例：`gz -s on`，配置好url和game后，正式开启赛事信息推送

参数仅支持on/off


## 当前群聊配置情况（--status）

命令格式：`gz -x`

无需多余参数，bot会响应结果如下

```text
URL设置：否
GAME设置：否
当前群聊订阅赛事：暂未设置，请通过-u参数进行设置
赛事推送是否开启：否
```

## 赛事进展（--process）

命令格式：`gz -p`

无需多余参数，bot会响应实时积分榜截图

</details>

[GZCTF]: https://github.com/GZTimeWalker/GZCTF
