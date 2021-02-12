/* eslint-disable camelcase */

// https://t.me/joinchat/ACtZWBdMm6xkL0mEVLgUCg

const config = require('./config');

const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const DetectLanguage = require('detectlanguage');
const { Sequelize, DataTypes, Model } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
	logging: false,
  dialect: 'sqlite',
  storage: path.join(__dirname, 'stats.sqlite3')
});

class Stats extends Model {}
Stats.init({
	chatId: {
		type: DataTypes.STRING,
		allowNull: false,
		primaryKey: true
	},
	memberId: {
		type: DataTypes.STRING,
		allowNull: false,
		primaryKey: true
	},
	lastSeen: {
		type: DataTypes.DATE,
		allowNull: false
	}
}, {
	sequelize,
	timestamps: false,
	modelName: 'Stats'
});

sequelize.sync();

const bot = new TelegramBot(config.TELEGRAM_TOKEN, { polling: true });
const detectLanguage = new DetectLanguage({
	key: config.DETECTLANGUAGE_TOKEN,
	ssl: false
});

const WATCH_URLS = false;

const chatNameById = {
	'-1001203773023': '@miniclubua',
	'-1001337527238': '@miniclubodesa',
	'-1001422187907': 'kiev',
	'-1001257154538': '@BEETLE_CLUB_UKRAINE'
};

const enableBansByChatId = {
	'-1001337527238': true,
	'-1001203773023': true
};

const adminsIdsByChatId = {
	'-1001203773023': [ '2840920', '16292769', '128480671' ],
	'-1001337527238': [ '2840920' ]
};

let templateByChatId = {};

const WELCOME_TIMEOUT_MS = 2000;

const HELLO_HELP =
`To see current welcome message for a channel:

\`/hello @channel\`

To change it:

\`/hello @channel blah blah\`

Make sure to put \`%NAME%\` somewhere in the hello message to mention the newcomer.
`;

const NOT_WELCOME_MESSAGE = [
	"Hi. I'm a private bot managing a count of specific Telegram channel.",
	"There is nothing I can do for you, so goodbye and have a nice day :-)\n\n",
	"Привет! Я частный бот, работающий только на парочке секретных телеграм каналов,",
	"поэтому ничем не могу вам быть полезен. До свидания и хорошего дня! :-)\n\n"
].join(" ");

const WHITE_PEOPLE = [
	16292769, // Ira Magnuna
	2840920, // kvazimbek
	128480671, // Artem Svitelskyi
	173231552, // Vova
	91153540 // Dmytro Homonuik
];

const NOTIFY_CHAT_ID = 2840920; // kvazimbek

const HELLO_PATH = path.join(__dirname, 'hello.json');

function loadHello() {
	const helloString = fs.readFileSync(HELLO_PATH).toString();
	templateByChatId = JSON.parse(helloString); // let it crash in case there's an error
}

function storeHello() {
	fs.writeFileSync(HELLO_PATH, JSON.stringify(templateByChatId, null, "\t"));
}

function chatIdByName(name) {
	for (const [ chatId, chatName ] of Object.entries(chatNameById)) {
		if (chatName.toLowerCase() == name.toLowerCase()) {
			return chatId;
		}
	}

	return null;
}

function touch({ chatId, memberId }) {
	return sequelize.models.Stats.upsert(
		{
			chatId,
			memberId,
			lastSeen: new Date()
		}
	);
}

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
	if (!enableBansByChatId[chatId]) {
		return;
	}

	const date = Date.now();
	const logStructure = JSON.stringify({ date, chatId, members });
	fs.appendFileSync('banList.json', logStructure + "\n");

	for (const member of members) {
		try {
			await bot.kickChatMember(chatId, member.id);
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
	return template
		.replaceAll('%NAME%', '[%MENTION%](tg://user?id=%MEMBER_ID%)')
		.replaceAll('%MEMBER_ID%', memberId)
		.replaceAll('%MENTION%', mention);
}

function createWelcomeMessageByChatId({ chatId, member }) {
	const template = templateByChatId[chatId];
	if (!template) {
		return null;
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
		if (!message) {
			console.log("No message to reply for chat %d", chatId);
			continue;
		}

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

function possiblyHandleUrl(msg) {
	if (!msg.entities) {
		return false;
	}

	const shouldNotify = msg.entities.filter(entity => entity.type == 'url').length > 0;
	if (!shouldNotify) {
		return false;
	}

	const chatName = chatNameById[String(msg.chat.id)];

	const notificationString = [
		chatName,
		`[${renderFullname(msg.from)}](tg://user?id=${msg.from.id})`,
		msg.text
	].join(' ');

	bot.sendMessage(NOTIFY_CHAT_ID, notificationString, { parse_mode: 'Markdown' });

	return true;
}

function authorizeAdmin(fromId, channelChatId) {
	const admins = adminsIdsByChatId[channelChatId];
	if (!admins) {
		return false;
	}

	return admins.includes(String(fromId));
}

function processHelloConfigurations({ text, fromId, chatId }) {
	const s = text.split(/\s+/);
	if (s.length == 0) { // can't be, but still
		return;
	}

	if (s.length == 1) {
		bot.sendMessage(chatId, HELLO_HELP, { parse_mode: 'Markdown' });
		return;
	}

	// s.length > 1

	const channelName = s[1];
	const channelChatId = chatIdByName(channelName);
	if (!channelChatId) {
		bot.sendMessage(chatId, "I don't know that channel, sorry.", { parse_mode: 'Markdown' });
		return;
	}

	if (!authorizeAdmin(fromId, channelChatId)) {
		bot.sendMessage(chatId, "You don't have permission to change the hello message for that channel.", { parse_mode: 'Markdown' });
		return;
	}

	if (s.length == 2) {
		const template = templateByChatId[channelChatId];
		if (!template) {
			bot.sendMessage(chatId, "No hello for that channel", { parse_mode: 'Markdown' });
			return;
		}

		bot.sendMessage(chatId, template, { parse_mode: 'Markdown' });
		return;
	}

	templateByChatId[channelChatId] = s.slice(2).join(' ');
	bot.sendMessage(
		chatId,
		`Сохранил вот такое приветствие для ${chatNameById[channelChatId]}:\n\n` + templateByChatId[channelChatId],
		{ parse_mode: 'Markdown' }
	);

	storeHello();
}

function processSay({ text, fromId, chatId }) {
	const s = text.split(/\s+/);
	if (s.length == 0) { // can't be, but still
		return;
	}

	if (s.length == 1) {
		bot.sendMessage(chatId, "/say @channel text", { parse_mode: 'Markdown' });
		return;
	}

	// s.length > 1

	const channelName = s[1];
	const channelChatId = chatIdByName(channelName);
	if (!channelChatId) {
		bot.sendMessage(chatId, "I don't know that channel, sorry.", { parse_mode: 'Markdown' });
		return;
	}

	if (!authorizeAdmin(fromId, channelChatId)) {
		bot.sendMessage(chatId, "You don't have permission to say in that channel.", { parse_mode: 'Markdown' });
		return;
	}

	bot.sendMessage(
		channelChatId,
		s.slice(2).join(' '),
		{ parse_mode: 'Markdown' }
	);
}

function processPrivateMessage(msg) {
	const text = (msg.text || '').trim();
	const fromId = String(msg.from.id);
	const chatId = String(msg.chat.id);

	if (text == '/start') {
		bot.sendMessage(chatId, NOT_WELCOME_MESSAGE, { parse_mode: 'Markdown' });
		return;
	}

	if (text.startsWith('/hello')) {
		processHelloConfigurations({ text, fromId, chatId });
		return;
	}

	if (text.startsWith('/say')) {
		processSay({ text, fromId, chatId });
		return;
	}

	if (text == '/ping') {
		bot.sendMessage(chatId, "Pong!");
		return;
	}
}

/**********************************/

loadHello();

bot.on('message', msg => {
	fs.appendFileSync('msg.json', JSON.stringify(msg) + "\n");

	const isPrivate = msg.chat?.type != 'supergroup';
	const fromId = String(msg.from.id);
	const chatId = String(msg.chat.id);

	if (isPrivate) {
		processPrivateMessage(msg);
		return;
	}

	if (WATCH_URLS) {
		possiblyHandleUrl(msg);
	}

	touch({
		chatId,
		memberId: fromId
	});
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
		setTimeout(() => welcomeMembers(String(msg.chat.id), toWelcome), WELCOME_TIMEOUT_MS);
	}
});

bot.on('polling_error', error => {
  console.log('polling_error');
  console.log(error);
});
