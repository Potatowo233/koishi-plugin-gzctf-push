import { Context, Schema } from 'koishi'

import zhCN from './locale/zh-CN.yml'
import * as gz from './gz'

export const name = 'gzctf-notice'
export const usage = zhCN._usage


export function apply(ctx: Context) {
  ctx.plugin(gz)
}
// 多平台、多game
// 查询比赛的game
