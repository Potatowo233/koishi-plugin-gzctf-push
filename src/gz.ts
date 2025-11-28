import { h, Context, Session } from 'koishi'
import zhCN from './locale/zh-CN.yml'
import { getGameFromUrl } from "./utils";
import { gameMap, urlMap, wsMap, heartbeatMap} from "./common/map";
import { stoppedGroups, autoStoppedGroups } from "./common/set";
import WebSocketNode from 'ws';
import {} from 'koishi-plugin-puppeteer'
import axios from 'axios';
import dayjs from "dayjs";
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

export const name = 'gzUrl'
export const inject = ['puppeteer']

const HEARTBEAT_INTERVAL = 15000;


export function apply(ctx: Context) {

  dayjs.extend(utc)
  dayjs.extend(timezone)

  ctx
    .i18n.define('zh-CN', zhCN)


  ctx
    .command('gz <message:text>')
    .option('url', '-u', {authority: 4})
    .option('start','-s',{authority: 4})
    .option('status','-x', {authority: 4})
    .option('game', '-g',{authority: 4})
    .option('process','-p',{authority: 4})
    .action(async ({options, session}, message) => {

      // console.log(options)
      // 当前群聊的赛事url、赛事信息
      if (options.status){
        const groupId = session.channelId
        // if (!urlMap.has(groupId)) return session.text('.url-not-set')
        // if (!gameMap.has(groupId)) return session.text('.game-not-set')

        const url = urlMap.has(groupId) && gameMap.has(groupId) ? `${urlMap.get(groupId)}/games/${gameMap.get(groupId)}` : '暂未设置，请通过-u参数进行设置'
        return session.text('.current-status',[urlMap.has(groupId) ? '是' : '否', gameMap.has(groupId) ? '是' : '否', url, wsMap.has(groupId) ? '是' : '否'])
        // return session.text(`URL设置：${urlMap.has(groupId) ? '是' : '否'}\nGAME设置：${gameMap.has(groupId) ? '是' : '否'}\n当前群聊订阅赛事：${url}\n赛事推送是否开启：${ wsMap.has(groupId) ? '是' : '否' }`)
      }


      //赛事进展
      if (options.process){
        const groupId = session.channelId
        if (!urlMap.has(groupId) || !gameMap.has(groupId)) return session.text('.url-or-game-not-set')
        const url = `${urlMap.get(groupId)}/games/${gameMap.get(groupId)}/scoreboard`
        let loaded = false
        try {
          const page = await ctx.puppeteer.page()

          await page.goto(url, { waitUntil: 'domcontentloaded' , timeout: 15000})

          await page.waitForSelector('div.mantine-TableScrollContainer-scrollContainer',{
            visible: true,
            timeout: 15000
          })


          await page.waitForFunction(() => {
            const rows = document.querySelectorAll("table tbody tr")
            return rows.length > 0
          }, { timeout: 15000 })

          //等待所有图片加载（如果表格里有头像等）
          await page.evaluate(async () => {
            const imgs = Array.from(document.images)
            await Promise.all(imgs.map(img => {
              if (img.complete) return
              return new Promise(resolve => img.onload = img.onerror = resolve)
            }))
          })

          const target = await page.$("div.mantine-TableScrollContainer-scrollContainer.mantine-ScrollArea-root");
          if (!target){
            const buffer = await page.screenshot({
              type: "png",
              fullPage: true
            })

            return h.image(buffer,'image/png')
          }

          const box = await target.boundingBox()
          console.log(Math.ceil(box.width))
          console.log(Math.ceil(box.height))
          await page.setViewport({
            width: 2000,
            height: 2000,
            deviceScaleFactor: 1
          })

          const buffer = await target.screenshot({
            type: "png",
            captureBeyondViewport: true
          })
          await session.send([
            `截至北京时间${dayjs().tz('Asia/Shanghai').format('MM-DD HH:mm')}，赛况参考 ${url}`,
            h.image(buffer, 'image/png'),
          ])

        } catch (err) {
          console.error(err)
          return '截图失败！'
        }


      }

      // 开启推送
      if (options.start){

        const groupId = session.channelId
        if (!urlMap.has(groupId)) return session.text('.url-not-set')
        if (!gameMap.has(groupId)) return session.text('.game-not-set')

        if (!message) return session.text('.expect-flag')
        const flag = message.toLowerCase()

        if (flag === 'on'){
          if (wsMap.has(groupId)) return session.text('.push-started')
          await session.send(session.text('.push-starting'));
          startPush(groupId, urlMap.get(groupId), gameMap.get(groupId), session);

          return session.text('.push-start')
        }
        else if (flag === 'off') {
          // console.log(wsMap)
          if (wsMap.has(groupId)) {
            stopPush(groupId);
            return session.text('.push-stop');
          } else {
            return session.text('.push-not-started');
          }
        }
        else {
          return session.text('.invalid-option')
        }

      }


      // 设置赛事
      if (options.game){
        const groupId = session.channelId
        const url = urlMap.get(groupId)
        if (!url) return session.text('.url-not-set')
        const games = await getGameFromUrl(url)
        const gameIds = games.map(game => game.id);
        let gameId
        if (!message){

          const gamesText = games.map(game => `${game.id}、${game.title}`).join('\n')
          await session.send(`当前URL下有赛事如下：\n${gamesText}`)
          await session.send("请选择你要订阅的赛事id")

          // console.log(gameIds)
          gameId = Number(await session.prompt());
        }

        if (!gameId) gameId = Number(message)


        if (!gameIds.includes(gameId)) return session.text('.invalid-game-id')
        if (!gameMap.has(groupId)){
          gameMap.set(groupId, gameId)
          //换赛事了先前的推送自然就要停下
          stopPushAuto(groupId, session)
          return session.text('.success-set-game')
        }
        await session.send('本群已绑定赛事id: ' + gameMap.get(groupId) + '，请确认是否覆盖[y/n]')
        const answer = await session.prompt();
        const c = answer.toLowerCase();
        if (c === 'y') {
          gameMap.set(groupId, gameId)
          stopPushAuto(groupId, session)
          return session.text('.success-set-game')
        } else if (c === 'n') {
          return session.text('.cancel-set-game')
        } else {
          return session.text('.invalid-option')
        }

      }

      // 为每个群组设置订阅url
      if (options.url) {
        const url = message
        if (!url) return session.text(".expect-url")

        if (!isValidUrl(url)) return session.text(".invalid-url")

        const groupId = session.channelId
        // console.log(groupId)
        if (!urlMap.has(groupId)) {
          urlMap.set(groupId, url)
          //同理，换url推送也得停下
          stopPushAuto(groupId, session)
          return session.text('.success-set-url')
        }

        await session.send('本群已绑定平台url: ' + urlMap.get(groupId) + '，请确认是否覆盖[y/n]')
        const answer = await session.prompt();
        const c = answer.toLowerCase();

        if (c === 'y') {
          urlMap.set(groupId, url)
          stopPushAuto(groupId, session)
          return session.text('.success-set-url')
        } else if (c === 'n') {
          return session.text('.cancel-set-url')
        } else {
          return session.text('.invalid-option')
        }
      }


    })
}


const regex = /^https?:\/\/((([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,})|((\d{1,3}\.){3}\d{1,3}))(:\d{1,5})?(\/[^\?#]*)?$/;

function isValidUrl(url) {
  if (!regex.test(url)) return false;
  const host = url.replace(/^https?:\/\//, "").split("/")[0].split(":")[0];

  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    if (!host.split(".").every(n => Number(n) >= 0 && Number(n) <= 255)) {
      return false;
    }
  }
  // 结尾不能是/
  return !url.endsWith("/");
}

function isValidGameId(str) {
  return /^[1-9]\d*$/.test(str);
}

function startPush(groupId: string, url: string, gameId: number, session: Session) {
  autoStoppedGroups.delete(groupId)
  // let heartbeatTimer: ReturnType<typeof setInterval>;

  const negotiate = async () => {
    try {
      const res = await axios.post(`https://ctf.rois.team/hub/user/negotiate?game=${gameId}&negotiateVersion=1`, null, {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          "Accept": "*/*",
          "Origin": "https://ctf.rois.team",
          "Referer": `https://ctf.rois.team/games/${gameId}/challenges`,
          "User-Agent": "Mozilla/5.0"
        }
      });

      return res.data.connectionToken;
    } catch (err) {
      console.error("Negotiate Error:", err);
      throw err;
    }
  };

  const wsConnect = async () => {
    //如果存在连接就先断开
    // if (wsMap.has(groupId)) stopPush(groupId)

    const token = await negotiate();
    const wsUrl = `wss://ctf.rois.team/hub/user?game=${gameId}&id=${encodeURIComponent(token)}`;
    const ws = new WebSocketNode(wsUrl, {
      headers: {
        "Origin": "https://ctf.rois.team",
        "User-Agent": "Mozilla/5.0"
      }
    });

    wsMap.set(groupId, ws);

    let handshakeDone = false;

    const sendHandshake = () => ws.send(JSON.stringify({ protocol: "json", version: 1 }) + "\u001e");
    const sendType6 = () => ws.send(JSON.stringify({ type: 6 }) + "\u001e");
    const sendType7 = () => ws.send(JSON.stringify({ type: 7 }) + "\u001e");

    const startHeartbeat = (groupId: string) => {
      const timer = heartbeatMap.get(groupId)
      if (timer) clearInterval(timer)
      const newTimer: NodeJS.Timeout = setInterval(() => sendType6(), HEARTBEAT_INTERVAL);
      heartbeatMap.set(groupId, newTimer)

      //前面傻了timer用全局的来了结果不同群聊的全乱套了
      // if (heartbeatTimer) clearInterval(heartbeatTimer);
      // heartbeatTimer = setInterval(() => sendType6(), HEARTBEAT_INTERVAL);
      // heartbeatMap.set(groupId, heartbeatTimer);
    };

    const stopHeartbeat = (groupId: string) => {
      const timer = heartbeatMap.get(groupId)
      if (timer) clearInterval(timer);
      heartbeatMap.delete(groupId);
    };

    ws.on("open", () => sendHandshake());

    ws.on("message", (msg) => {
      const data = msg.toString().split("\u001e").filter(Boolean);
      for (const m of data) {
        try {
          const json = JSON.parse(m);

          if (!handshakeDone && m.includes("{}")) {
            handshakeDone = true;
            sendType6();
            startHeartbeat(groupId);
          } else if (json.type === 1) {
            console.log("Received event:", json.target, json.arguments);

            //TODO
            const eventData = json.arguments[0];
            if (eventData){
              const type = eventData.type
              const values = eventData.values
              switch (type){
                case 'NewChallenge':{
                  session.send(`赛题 【${values[0]}】 已开启`)
                  break
                }
                case 'NewHint':{
                  session.send(`赛题 【${values[0]}】 更新提示`)
                  break
                }
                case 'FirstBlood':{
                  session.send(`恭喜 ${values[0]} 战队获得赛题 【${values[1]}】的一血！`)
                  break
                }
                case 'SecondBlood':{
                  session.send(`恭喜 ${values[0]} 战队获得赛题 【${values[1]}】的二血！`)
                  break
                }
                case 'ThirdBlood':{
                  session.send(`恭喜 ${values[0]} 战队获得赛题 【${values[1]}】的三血！`)
                  break
                }

              }
            }
            sendType7();
          } else if (json.type === 7) {
            sendHandshake();
          }
        } catch (err) {
          console.error("Failed to parse message:", err, m);
        }
      }
    });

    ws.on("close", () => {
      stopHeartbeat(groupId);
      wsMap.delete(groupId);
      // console.log(wsMap)
      // console.log(stoppedGroups)
      // console.log(autoStoppedGroups)
      if (!stoppedGroups.has(groupId) && !autoStoppedGroups.has(groupId)) {
        setTimeout(() => wsConnect(), 1000);
      }
    });

    ws.on("error", (err) => {
      console.error("WebSocket Error:", err);
      stopHeartbeat(groupId);
      try { ws.close(); } catch {}
    });

  };

  wsConnect().catch(console.error);
}

function stopPush(groupId: string) {
  stoppedGroups.add(groupId);
  const ws = wsMap.get(groupId);
  if (ws) {
    ws.close();
    wsMap.delete(groupId);
  }

  const timer = heartbeatMap.get(groupId) as ReturnType<typeof setInterval> | undefined;
  if (timer) {
    clearInterval(timer);
    heartbeatMap.delete(groupId);
  }
}

function stopPushAuto(groupId: string, session: Session){
  //这里要区别开手动关停的，不然出大问题，不会轮训播报了
  autoStoppedGroups.add(groupId)
  const ws = wsMap.get(groupId);
  if (ws) {
    // console.log('stop!!')
    ws.close();
    wsMap.delete(groupId);
    session.send('配置发生变动，已停止正在运行的推送，请重新通过gz -s on开启')
  }

  const timer = heartbeatMap.get(groupId) as ReturnType<typeof setInterval> | undefined;
  if (timer) {
    clearInterval(timer);
    heartbeatMap.delete(groupId);
  }

}


