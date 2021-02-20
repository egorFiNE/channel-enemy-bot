/* eslint-disable camelcase */
const fs = require('fs');
const path = require('path');

const dayjs = require('dayjs');
require('dayjs/locale/ru');
const relativeTime = require('dayjs/plugin/relativeTime');
const LocalizedFormat = require('dayjs/plugin/localizedFormat');
dayjs.locale('ru');
dayjs.extend(relativeTime);
dayjs.extend(LocalizedFormat);

const emojiCollectionMoney1 = '💰 💸 🤑 💹 👀 ⚡️ 💡 ‼️ 😳 🙄 💤'.split(' ');
const emojiCollectionMoney2 = '💵 💹 ❤️ 😍 💪 😇 😊 😜 🥰 😻 ✊ 🤘 👌 ❣️ 💕 💞 💓 💗 💖 💘 💝 ✨ 🌟 🔥 💥 ⭐️ 💫 🏆 🥇 🎖 🏅 🔝'.split(' ');
const emojiCollectionSad = '🥺 🤬 😡 😠 🥶 😱 😭 😬 🤮 ☠️ 🤡 💩 🔚 🤣 😂 😅 🤌 🖕 🙈 🙊 💔 🆘 📛 🚫 🚷 😭 😢 😔 ☹️ 😞 🙁 😥 😪 😟 😿'.split(' ');

const roundCurrencyFormatter = new Intl.NumberFormat('en-US', {
  useGrouping: true
});

function generateRandomEmojiString(collection, upToLength) {
  const lineLength = 1 + Math.floor(Math.random() * upToLength);
  const selectedEmoji = collection[Math.floor(Math.random() * collection.length)];

  const a = new Array(lineLength);
  a.fill(selectedEmoji);
  return a.join('');
}

function readDesperations(filename) {
	return fs.readFileSync(path.join(__dirname, filename)).toString().split('\n').filter(l => Boolean(l));
}

function generate(currentRate, randomRate, randomDate, desperations) {
  const dateRelativeHr = dayjs(randomDate).from(new Date());
  const dateAbsoluteHr = dayjs(randomDate).format('LL').replace(' г.', '');

  const originalAmountUSD = (3 + Math.round(Math.random() * 30)) * 100;
  const amountBTC = originalAmountUSD / randomRate;

  const currentAmountUSD = amountBTC * currentRate;

  const originalBTCAmountHr = amountBTC.toFixed(4);
  const originalAmountUSDHr = roundCurrencyFormatter.format(originalAmountUSD);
  const currentAmountUSDHr = roundCurrencyFormatter.format(Math.round(currentAmountUSD));

	const emojiMoney1 = generateRandomEmojiString(emojiCollectionMoney1, 1);
	const emojiMoney2 = generateRandomEmojiString(emojiCollectionMoney2, 3);
	const emojiSad1 = generateRandomEmojiString(emojiCollectionSad, 2);

  const line = `%NAME%, если бы ты ${dateRelativeHr} (${dateAbsoluteHr}) вложил ${emojiMoney1} *$${originalAmountUSDHr}* в биткоин, то сегодня бы у тебя было ${emojiMoney2} *$${currentAmountUSDHr}* (около ${originalBTCAmountHr} BTC).`;
	const desperation = desperations[Math.floor(Math.random() * desperations.length)];
	return (line + '\n\n' + desperation + ' ' + emojiSad1);
}

function parseTargetUsernameFromMsg(msg) {
	const m = msg.text.trim().replace(/\s+/g, ' ').split(' ');
	if (m.length > 1 && m[1].startsWith('@')) {
		return m[1];
	}

  return null;
}

function renderFullname({ first_name, last_name }) {
	let name = (first_name || '').trim();
	if (last_name) {
		name += ' ' + last_name.trim();
	}
	return name;
}

function getRandomBTCPriceDay(days) {
  return days[Math.floor(Math.random() * days.length)];
}

async function send(bot, msg, bitcoinPriceHelper, desperationsFilename) {
	const targetUsername = parseTargetUsernameFromMsg(msg);

	const days = await bitcoinPriceHelper.getDailyRate();
	if (!days) {
		console.error("CANNOT GET DAYS");
		return;
	}

	const rate = await bitcoinPriceHelper.getRate();

	const name = renderFullname(msg.from);

	const randomDay = getRandomBTCPriceDay(days);
	const randomDate = randomDay.date;
	const randomRate = randomDay.usd;

	const desperations = readDesperations(desperationsFilename);

	const template = generate(rate, randomRate, randomDate, desperations);

	let message = null;

	if (targetUsername) {
		message = template.replaceAll('%NAME%', targetUsername);
	} else {
		message = template
			.replaceAll('%NAME%', '[%MENTION%](tg://user?id=%MEMBER_ID%)')
			.replaceAll('%MEMBER_ID%', msg.from.id)
			.replaceAll('%MENTION%', name);
	}

  const options = {
		parse_mode: 'Markdown'
  };

  if (!targetUsername) {
    options.reply_to_message_id = msg.message_id;
  }

	bot.sendMessage(msg.chat.id, message, options);
}

module.exports = {
  generate,
	readDesperations,
  parseTargetUsernameFromMsg,
  send
};
