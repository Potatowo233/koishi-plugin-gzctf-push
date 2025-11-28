import get from 'axios'

export async function getGameFromUrl(url: string): Promise<any[]>{
  try {
    const res = await get(url+"/api/game/recent",  {
    headers: {
        "X-Requested-With": "XMLHttpRequest",
        "Accept": "*/*",
        "Origin": "https://ctf.rois.team",
        "Referer": "https://ctf.rois.team/games/2/challenges",
        "User-Agent": "Mozilla/5.0"
      },
      timeout: 5000
    });

    // console.log(Array.isArray(res.data))
    return res.data

  }catch (e) {
    console.log("Error:",e)
    return []
  }
}

