/* eslint-disable camelcase */

// https://t.me/joinchat/ACtZWBdMm6xkL0mEVLgUCg

const config = require('./config');

const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const DetectLanguage = require('detectlanguage');

const bot = new TelegramBot(config.TELEGRAM_TOKEN, { polling: true });
const detectLanguage = new DetectLanguage({
	key: config.DETECTLANGUAGE_TOKEN,
	ssl: false
});

const WELCOME_TIMEOUT_MS = 2000;
const NOT_WELCOME_MESSAGE = "Hi. I'm a private bot managing a single Telegram channel. There is nothing I can do for you, so goodbye and have a nice day :-)\n\n" +
	"Привет! Я частный бот, работающий только на одном телеграм канале, поэтому ничем не могу вам быть полезен. До свидания и хорошего дня! :-)";

const WHITE_PEOPLE = [
	16292769, // Ira Magnuna
	2840920, // kvazimbek
	128480671, // Artem Svitelskyi
	173231552, // Vova
	91153540 // Dmytro Homonuik
];

const NOTIFY_CHAT_ID = 2840920; // kvazimbek

function isAsian(name) {
	return new Promise((resolve, reject) => {
		detectLanguage.detect(name, (err, result) => {
			if (err) {
				reject(err);
				return;
			}

			if (!result || result.length == 0) {
				reject(new Error("No idea"));
				return;
			}

			const language = (result[0].language || '').toLowerCase();
			if (!language) {
				reject(new Error("no language"));
				return;
			}

			resolve(
				language.startsWith('zh') || language.startsWith('za') ||
				language.startsWith('vi') || language.startsWith('ko') ||
				language.startsWith('ja')
			);
		});
	});
}

async function banMembers(chatId, members) {
	const date = Date.now();
	const logStructure = JSON.stringify({ date, chatId, members });
	fs.appendFileSync('banList.json', logStructure + "\n");

	for (const member of members) {
		try {
			const result = await bot.kickChatMember(chatId, member.id);
			console.log(result);
		} catch (e) {
			console.log(e);
		}
	}

	const notificationMembers = members.map(member => {
		const result = [ member.id ];
		if (member.username) {
			result.push('@' + member.username);
		}
		result.push(renderFullname(member));
		return result.join(' ');
	});

	const notificationString = notificationMembers.join("\n\n") + "\n";

	bot.sendMessage(NOTIFY_CHAT_ID, notificationString, {
		disable_notification: true
	});
}

function renderWelcomeMessage({ template, memberId, mention }) {
	return template.replace(/%MEMBER_ID%/g, memberId).replace(/%MENTION%/g, mention);
}

function createWelcomeMessageByChatId({ chatId, member }) {
	let template = null;
	if (chatId == '-1001203773023') {
		template = 'Привет, [%MENTION%](tg://user?id=%MEMBER_ID%), MINI Club UA 🇺🇦 приветствует тебя! Расскажи нам что-то о себе и своем автомобиле.';
	} else {
		template = 'Таки да: ви в Одессе, [%MENTION%](tg://user?id=%MEMBER_ID%)! Обратите внимание на закрепленное сообщение, и расскажите нам все о себе и своем автомобиле. А еще мы таки очень будем рады видеть вас на сходках и покатушках!';
	}

	const mention = renderFullname(member);

	return renderWelcomeMessage({
		template,
		memberId: member.id,
		mention
	});
}

function welcomeMembers(chatId, members) {
	const promises = [];
	for (const member of members) {
		const message = createWelcomeMessageByChatId({ chatId, member });
		// const mention = renderFullname(member);
		// const message = `Привет, [${mention}](tg://user?id=${member.id}), MINI Club UA 🇺🇦 приветствует тебя! Расскажи нам что-то о себе и своем автомобиле.`;
		promises.push(bot.sendMessage(chatId, message, { parse_mode: 'Markdown' }));
	}
	return Promise.all(promises);
}

function renderFullname({ first_name, last_name }) {
	let name = (first_name || '').trim();
	if (last_name) {
		name += ' ' + last_name.trim();
	}
	return name;
}

/**********************************/

bot.on('message', msg => {
	if (msg.text == '/say_hello') {
		welcomeMembers(msg.chat.id, [msg.from]);
		return;
	}

	fs.appendFileSync('msg.json', JSON.stringify(msg) + "\n");

	if (msg.text == '/start') {
		bot.sendMessage(msg.chat.id, NOT_WELCOME_MESSAGE, { parse_mode: 'Markdown' });
	}
});

bot.on('new_chat_members', async msg => {
	fs.appendFileSync('newMembers.json', JSON.stringify(msg) + "\n");

	const toBeBanned = [], toWelcome = [];

	for (const member of msg.new_chat_members) {
		if (member.is_bot) {
			continue;
		}

		const name = renderFullname(member);

		try {
			const shouldBan = await isAsian(name);
			member.shouldBan = shouldBan;
		} catch (e) {
			console.log(e);
			member._error = e.toString();
		}

		if (WHITE_PEOPLE.includes(member.id)) {
			member.shouldBan = false;
		}

		if (member.shouldBan) {
			toBeBanned.push(member);
		} else {
			toWelcome.push(member);
		}
	}

	if (toBeBanned.length > 0) {
		await banMembers(msg.chat.id, toBeBanned);
		if (toBeBanned.length == 1) {
			bot.deleteMessage(msg.chat.id, msg.message_id);
		}
	}

	if (toWelcome.length > 0) {
		// let them see something
		setTimeout(() => welcomeMembers(msg.chat.id, toWelcome), WELCOME_TIMEOUT_MS);
	}
});

/*
{
  message_id: 3,
  from: {
    id: 2840920,
    is_bot: false,
    first_name: 'Vartan',
    last_name: 'Egorov',
    username: 'kvazimbek'
  },
  chat: {
    id: -390896556,
    title: 'test',
    type: 'group',
    all_members_are_administrators: true
  },
  date: 1566649477,
  new_chat_participant: {
    id: 2840920,
    is_bot: false,
    first_name: 'Vartan',
    last_name: 'Egorov',
    username: 'kvazimbek'
  },
  new_chat_member: {
    id: 2840920,
    is_bot: false,
    first_name: 'Vartan',
    last_name: 'Egorov',
    username: 'kvazimbek'
  },
  new_chat_members: [
    {
      id: 2840920,
      is_bot: false,
      first_name: 'Vartan',
      last_name: 'Egorov',
      username: 'kvazimbek'
    }
  ]
}
*/
