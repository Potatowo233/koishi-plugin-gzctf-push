import {Schema} from "koishi";

export interface Config {
  url: string
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    url: Schema.string().required().description("赛事平台的基地址(url结尾不要包含/，如 https://ctf.rois.team)")
  })
])
