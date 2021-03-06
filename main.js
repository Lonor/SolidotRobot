const db = require('./utils/db');
const parser = require('./utils/rss-parser');
const fanfou = require('./utils/fanfou');
const URL = require('url');
const tableName = 'solidot';

function getSidFromLink(link) {
    let arg = URL.parse(link, true);
    return parseInt(arg.query.sid);
}

async function doRss() {
    let list = [];
    console.log("开始获取 RSS 资源");
    const feed = await parser.parseURL('https://www.solidot.org/index.rss');
    // todo: 判断是否有新文章后再调用 fanfou api 以优化，这里明显每次都要登录。
    let fanfouClient = await fanfou.authFan();
    await Promise.all(
        feed.items.map(async article => {
            let linkCount = await db.count(tableName, { link: article.link });
            let resFromFanfou = {};
            if (linkCount > 0) {
                console.log(`已发布: ${article.title}`)
                let beforeSid = getSidFromLink(article.link) - 30;
                let beforeLink = "https://www.solidot.org/story?sid=" + beforeSid;
                let beforeLinkCount = await db.count(tableName, { link: beforeLink });
                if (beforeLinkCount > 0) {
                    // console.log(`删除旧链接 ${beforeLink}`);
                    await db.deleteOne(tableName, { link: beforeLink });
                }
            } else {
                try {
                    console.log(`执行发布: ${article.title}`);
                    // todo：敏感词收集
                    let cleanTitle = article.title.replace(new RegExp("特朗普", "gm"), " Trump ")
                        .replace(new RegExp("监管", "gm"), " Jiān Guǎn ")
                        .replace(new RegExp("网信办", "gm"), " CAC ")
                        .replace(new RegExp("民众抗议", "gm"), " 民众 KàngYì");
                    resFromFanfou = await fanfouClient.post('/statuses/update', { status: `${cleanTitle} ${article.link}` });
                    await db.insertOne(tableName, { link: article.link });
                } catch (err) {
                    console.log(err);
                    fanfou.expireAuth();
                }
            }
            list.push(resFromFanfou);
        }));
    return list;
}

module.exports = doRss;

// const schedule = require('node-schedule');
// function main() {
//     schedule.scheduleJob('*/1 * * * * *', async () => {
//         await doRss();
//     });
// }